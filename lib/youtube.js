// lib/youtube.js
// Helpers for working with YouTube: parse the link, get the title + thumbnail,
// and download the video's captions (transcript).
//
// Transcript fetching is deliberately RESILIENT. YouTube changes its internals
// often, and any single method breaks periodically — which used to surface to
// users as a misleading "this video has no captions" even when it clearly did.
// We now try several strategies in order and only report NO_CAPTIONS when we can
// actually confirm the video exposes zero caption tracks. Anything else is
// reported as a transient fetch failure (so the message is honest).

const { YoutubeTranscript } = require("youtube-transcript");

// A recent desktop UA — some YouTube endpoints behave differently for old/blank UAs.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// Accepts youtube.com/watch?v=..., youtu.be/..., shorts, embeds, and bare IDs.
function extractVideoId(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (/^[\w-]{11}$/.test(raw)) return raw;
  let url;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
  if (host.endsWith("youtube.com")) {
    if (url.searchParams.get("v")) return url.searchParams.get("v");
    const m = url.pathname.match(/^\/(shorts|embed|live)\/([\w-]{11})/);
    if (m) return m[2];
  }
  return null;
}

// Title + thumbnail without any API key, via YouTube's public oEmbed endpoint.
async function fetchVideoMeta(videoId) {
  const fallback = {
    title: "YouTube video",
    author: "",
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    return {
      title: data.title || fallback.title,
      author: data.author_name || "",
      thumbnail: data.thumbnail_url || fallback.thumbnail,
    };
  } catch {
    return fallback;
  }
}

// Reject a promise if it doesn't settle in time — so no single strategy (or the
// no-timeout library) can hang the whole deck-creation request.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => {
        const e = new Error("TRANSCRIPT_FETCH_FAILED");
        e.detail = "timeout_" + (label || "") + "_" + ms + "ms";
        reject(e);
      }, ms)
    ),
  ]);
}

function cleanText(s) {
  return String(s || "")
    .replace(/&amp;#39;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;quot;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// ---- Strategy 1: the youtube-transcript library ----
async function viaLibrary(videoId) {
  const items = await YoutubeTranscript.fetchTranscript(videoId);
  if (!items || !items.length) return null;
  return cleanText(items.map((i) => i.text).join(" "));
}

// ---- Strategy 2: direct InnerTube (youtubei) player API ----
// This is the same endpoint the official web player uses. It returns the caption
// track list; we then fetch the track as json3 (robust) and fall back to XML.
const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"; // public web key baked into youtube.com
async function fetchCaptionTracks(videoId) {
  const body = {
    context: {
      client: { clientName: "WEB", clientVersion: "2.20240501.00.00", hl: "en" },
    },
    videoId,
  };
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}&prettyPrint=false`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "User-Agent": UA },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) return { tracks: null, reason: "player_http_" + res.status };
  const data = await res.json().catch(() => null);
  const status = data && data.playabilityStatus && data.playabilityStatus.status;
  if (status && status !== "OK" && status !== "LIVE_STREAM_OFFLINE") {
    // e.g. LOGIN_REQUIRED, ERROR, UNPLAYABLE — not a "no captions" case
    return { tracks: null, reason: "playability_" + status };
  }
  const tracks =
    data &&
    data.captions &&
    data.captions.playerCaptionsTracklistRenderer &&
    data.captions.playerCaptionsTracklistRenderer.captionTracks;
  return { tracks: Array.isArray(tracks) ? tracks : [], reason: null };
}

function pickTrack(tracks, lang) {
  if (!tracks || !tracks.length) return null;
  const want = lang === "es" ? "es" : "en";
  // Prefer a manual track in the desired language, then any in that language,
  // then any English, then the first available (including auto-generated).
  return (
    tracks.find((t) => t.languageCode === want && t.kind !== "asr") ||
    tracks.find((t) => t.languageCode === want) ||
    tracks.find((t) => t.languageCode === "en") ||
    tracks[0]
  );
}

async function fetchTrackText(track) {
  if (!track || !track.baseUrl) return null;
  // Ask for json3 — cleaner to parse and less likely to be empty than default XML.
  const url = track.baseUrl + (track.baseUrl.includes("fmt=") ? "" : "&fmt=json3");
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const raw = await res.text();
  // json3 shape: { events: [ { segs: [ { utf8: "..." } ] } ] }
  try {
    const j = JSON.parse(raw);
    if (j && Array.isArray(j.events)) {
      const text = j.events
        .map((e) => (e.segs || []).map((s) => s.utf8 || "").join(""))
        .join(" ");
      const cleaned = cleanText(text);
      if (cleaned) return cleaned;
    }
  } catch {
    /* not json3 — fall through to XML parsing */
  }
  // XML fallback: <text ...>content</text> or srv3 <p ...><s>word</s></p>
  const texts = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(raw)) !== null) texts.push(m[1]);
  if (!texts.length) {
    const pre = /<p[^>]*>([\s\S]*?)<\/p>/g;
    while ((m = pre.exec(raw)) !== null) texts.push(m[1].replace(/<[^>]+>/g, ""));
  }
  const cleaned = cleanText(texts.join(" "));
  return cleaned || null;
}

async function viaInnertube(videoId, lang) {
  const { tracks, reason } = await fetchCaptionTracks(videoId);
  if (tracks === null) {
    const e = new Error("TRANSCRIPT_FETCH_FAILED");
    e.detail = reason;
    throw e; // couldn't even reach/parse the player — transient, NOT "no captions"
  }
  if (tracks.length === 0) {
    // Confirmed: this video genuinely exposes no caption tracks.
    throw new Error("NO_CAPTIONS");
  }
  const track = pickTrack(tracks, lang);
  const text = await fetchTrackText(track);
  if (!text) {
    const e = new Error("TRANSCRIPT_FETCH_FAILED");
    e.detail = "track_empty";
    throw e;
  }
  return text;
}

// Returns the transcript text, or throws a friendly error code:
//   NO_CAPTIONS               — the video really has no captions available
//   TRANSCRIPT_FETCH_FAILED   — a transient/technical failure (retry / paste text)
async function fetchTranscript(videoId, lang) {
  // Strategy 1: the library (fast path). It has NO built-in timeout, so we cap it
  // ourselves (8s). Treat ANY throw/empty/timeout as "try the next strategy"
  // rather than immediately declaring no captions.
  try {
    const t = await withTimeout(viaLibrary(videoId), 8000, "library");
    if (t && t.length) return t;
  } catch {
    /* fall through to InnerTube */
  }

  // Strategy 2: direct InnerTube. This one CAN authoritatively say NO_CAPTIONS
  // (it inspects the actual caption track list from YouTube's own player API).
  // Cap it too (14s) so a slow YouTube can't hang the request.
  return await withTimeout(viaInnertube(videoId, lang), 14000, "innertube");
}

module.exports = { extractVideoId, fetchVideoMeta, fetchTranscript };
