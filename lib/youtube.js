// lib/youtube.js
// Helpers for working with YouTube: parse the link, get the title + thumbnail,
// and download the video's captions (transcript).

const { YoutubeTranscript } = require("youtube-transcript");

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

// Returns the transcript text, or throws a friendly error code.
async function fetchTranscript(videoId) {
  let items;
  try {
    items = await YoutubeTranscript.fetchTranscript(videoId);
  } catch (err) {
    const msg = String(err && err.message || err);
    if (/disabled|not available|no transcript/i.test(msg)) {
      throw new Error("NO_CAPTIONS");
    }
    throw new Error("TRANSCRIPT_FETCH_FAILED");
  }
  if (!items || !items.length) throw new Error("NO_CAPTIONS");
  return items
    .map((i) => i.text)
    .join(" ")
    .replace(/&amp;#39;/g, "'")
    .replace(/&amp;quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = { extractVideoId, fetchVideoMeta, fetchTranscript };
