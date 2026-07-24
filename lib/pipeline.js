// lib/pipeline.js
// The two-stage AI pipeline, now BILINGUAL for the merged site.
//   Stage 1 ("the teacher"): reads the transcript and pulls out the substance,
//     rewritten for the chosen grade band.
//   Stage 2 ("the designer"): arranges that substance into a visual layout plan.
//
// Language is chosen per-request via `lang` ("en" default, or "es"). English
// requests come from pages under "/", Spanish from pages under "/es/". The JSON
// SHAPE is identical in both languages (keys always English, values localized),
// so decks, the renderer, the image generator, and the store are fully
// cross-compatible regardless of which language produced a deck.

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

// Grade bands per language. Internal keys (k2/35/68/912) are identical across
// languages so the UI, tests, and renderer stay compatible; only the labels and
// the reading-level guidance differ. Spanish uses the Mexican / LatAm structure.
const GRADE_BANDS_BY_LANG = {
  en: {
    "k2":  { label: "Grades K–2",  reading: "a 6–7 year old. Use very short sentences (max 8 words), everyday words only, and lots of warmth." },
    "35":  { label: "Grades 3–5",  reading: "a 9–10 year old. Use short, clear sentences and explain any tricky word right where it appears." },
    "68":  { label: "Grades 6–8",  reading: "a 12–13 year old. Clear and friendly; simple explanations before any new term." },
    "912": { label: "Grades 9–12", reading: "a high school student. Plain, direct language; define specialized terms briefly." },
  },
  es: {
    "k2":  { label: "1º–2º de Primaria", reading: "una niña o niño de 6 a 8 años. Usa oraciones muy cortas (máximo 8 palabras), palabras de todos los días y mucha calidez." },
    "35":  { label: "3º–6º de Primaria", reading: "una niña o niño de 8 a 12 años. Usa oraciones cortas y claras, y explica cualquier palabra difícil justo donde aparece." },
    "68":  { label: "Secundaria",        reading: "un o una estudiante de secundaria (12 a 15 años). Tono claro y cercano; explica con sencillez antes de usar un término nuevo." },
    "912": { label: "Preparatoria",      reading: "un o una estudiante de preparatoria (15 a 18 años). Lenguaje directo y natural; define brevemente los términos especializados." },
  },
};

function normLang(lang) { return lang === "es" ? "es" : "en"; }
// Back-compat export: a flat map of the valid grade-band keys (language-neutral),
// so existing callers doing GRADE_BANDS[gradeBand] as a validity check still work.
const GRADE_BANDS = GRADE_BANDS_BY_LANG.en;

async function callClaude(system, user, maxTokens) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("MISSING_API_KEY");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`CLAUDE_API_${res.status}`);
    err.detail = body.slice(0, 500);
    throw err;
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return parseJson(text);
}

function parseJson(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("BAD_MODEL_JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ---------- Stage 1: extract the substance ----------
async function extractSubstance({ transcript, videoTitle, gradeBand, lang }) {
  const L = normLang(lang);
  const bands = GRADE_BANDS_BY_LANG[L];
  const band = bands[gradeBand] || bands["35"];

  const system = L === "es"
    ? `Eres una maestra o maestro experto y cercano que convierte videos en apuntes de estudio para estudiantes de habla hispana en México y América Latina.
Público: ${band.reading}
Idioma: escribe TODO el contenido en español neutro latinoamericano, con trato de "tú". Nada de anglicismos innecesarios. El video puede estar en inglés u otro idioma: aun así, TODO tu texto va en español.
Reglas de seguridad (síguelas siempre):
- Todo debe ser apropiado para la escuela. Si el video tiene groserías, temas de adultos, violencia o retos peligrosos, omite esas partes por completo y enfócate en la sustancia educativa. Si el video completo no es apropiado para estudiantes, pon "appropriate" en false y deja los demás campos vacíos.
- Nunca incluyas información personal de personas privadas.
- Escribe TODO con tus propias palabras. No copies oraciones de la transcripción.
Responde SOLO con un objeto JSON. Sin markdown ni texto antes o después. Las CLAVES del JSON quedan exactamente en inglés como se indica; los VALORES van en español.`
    : `You are a warm, expert K-12 teacher who turns videos into study notes for students.
Audience: ${band.reading}
Safety rules (always follow):
- Everything must be school-appropriate. If the video contains profanity, adult themes, violence, or dangerous stunts, leave those parts out entirely and focus on the educational substance. If the whole video is inappropriate for students, set "appropriate" to false and leave other fields empty.
- Never include personal information about private individuals.
- Write ALL text in your own words. Do not copy sentences from the transcript.
Respond ONLY with a single JSON object. No markdown, no preamble.`;

  const user = L === "es"
    ? `Título del video: ${videoTitle}

Transcripción (puede traer relleno, anuncios y repeticiones — ignóralos):
"""
${transcript.slice(0, 90000)}
"""

Extrae solo la sustancia y reescríbela para el público indicado. Responde con JSON exactamente con esta forma:
{
  "appropriate": true,
  "topic": "tema en 2-5 palabras",
  "big_idea": "La idea más importante, en una oración amigable.",
  "hook": "Una línea divertida que despierte la curiosidad del estudiante.",
  "key_points": [ { "title": "3-6 palabras", "detail": "1-2 oraciones cortas" } ],
  "steps": [ { "title": "nombre corto del paso", "detail": "una oración" } ],
  "numbers": [ { "value": "42%", "meaning": "qué nos dice este número" } ],
  "vocab": [ { "word": "término", "kid_definition": "definición súper sencilla" } ],
  "fun_fact": "un dato sorprendente del video, o cadena vacía",
  "takeaway": "Lo que el estudiante debe recordar o intentar, en una oración.",
  "quiz": [ { "q": "pregunta corta", "a": "respuesta corta" } ]
}`
    : `Video title: ${videoTitle}

Transcript (may include filler, ads, and repeats — ignore those):
"""
${transcript.slice(0, 90000)}
"""

Pull out only the substance and rewrite it for the audience. Respond with JSON in exactly this shape:
{
  "appropriate": true,
  "topic": "2-5 word topic",
  "big_idea": "The one most important idea, in one friendly sentence.",
  "hook": "A fun one-line hook that makes a student curious.",
  "key_points": [ { "title": "3-6 words", "detail": "1-2 short sentences" } ],
  "steps": [ { "title": "short step name", "detail": "one sentence" } ],
  "numbers": [ { "value": "42%", "meaning": "what this number tells us" } ],
  "vocab": [ { "word": "term", "kid_definition": "super simple definition" } ],
  "fun_fact": "one surprising fact from the video, or empty string",
  "takeaway": "What a student should remember or try, in one sentence.",
  "quiz": [ { "q": "short question", "a": "short answer" } ]
}`;

  return callClaude(system, user, 2500);
}

// ---------- Stage 2: design the layout ----------
const CARD_TYPES = ["hero", "big_idea", "points", "steps", "numbers", "vocab", "fun_fact", "quiz", "takeaway"];

async function designLayout({ substance, theme, lang }) {
  const L = normLang(lang);

  const system = L === "es"
    ? `Eres diseñador o diseñadora de información: armas infografías de una página para estudiantes de habla hispana.
Recibes contenido estructurado y decides el orden visual, los tamaños y los emojis para que la página tenga ritmo: una apertura fuerte, tarjetas de tamaños variados y un cierre memorable.
Reglas:
- Usa SOLO el contenido dado. No inventes datos nuevos.
- Elige de 4 a 7 tarjetas en total (además del encabezado). Omite cualquier tarjeta cuyo contenido esté vacío.
- "size" controla el peso visual: "xl" (ancho completo, protagonista), "lg" (ancho completo), "md" (media anchura). Máximo una "xl".
- Dale a cada tarjeta un emoji que combine con su contenido y con el estilo "${theme}".
- El "headline" y el "subhead" van en español natural, con trato de "tú" (por ejemplo: "lo que vas a aprender").
Responde SOLO con un objeto JSON. Sin markdown ni texto extra. Las CLAVES quedan en inglés; los VALORES en español.`
    : `You are an information designer who lays out one-page infographics for K-12 students.
You receive structured content and decide the visual order, sizes, and emoji so the page has rhythm: a strong opening, varied card sizes, and a memorable close.
Rules:
- Use ONLY the given content. Do not invent new facts.
- Choose 4 to 7 cards total (besides the header). Skip any card whose content is empty.
- "size" controls visual weight: "xl" (full width, star of the show), "lg" (full width), "md" (half width). At most one "xl".
- Give each card an emoji that matches its content and the "${theme}" theme.
- The "headline" and "subhead" are in natural, friendly language.
Respond ONLY with a single JSON object. No markdown, no extra text.`;

  const user = L === "es"
    ? `Contenido:
${JSON.stringify(substance, null, 2)}

Responde con JSON exactamente con esta forma:
{
  "headline": "título llamativo de 3-8 palabras para el deck (no el título del video)",
  "subhead": "una línea que diga qué vas a aprender",
  "hero_emoji": "un emoji",
  "cards": [
    { "type": "big_idea", "size": "xl", "emoji": "💡", "title": "título corto opcional" }
  ]
}
Valores permitidos para "type": ${CARD_TYPES.filter((t) => t !== "hero").join(", ")}. Ordena las tarjetas para la mejor lectura (big_idea al inicio, takeaway o quiz al final).`
    : `Content:
${JSON.stringify(substance, null, 2)}

Respond with JSON in exactly this shape:
{
  "headline": "catchy 3-8 word title for the deck (not the video title)",
  "subhead": "a one-liner saying what you'll learn",
  "hero_emoji": "a single emoji",
  "cards": [
    { "type": "big_idea", "size": "xl", "emoji": "💡", "title": "optional short title" }
  ]
}
Allowed values for "type": ${CARD_TYPES.filter((t) => t !== "hero").join(", ")}. Order the cards for the best read (big_idea first, takeaway or quiz last).`;

  const layout = await callClaude(system, user, 1200);

  const fallbackTitles = L === "es"
    ? { points: "Ideas clave", takeaway: "Llévatelo contigo" }
    : { points: "Key ideas", takeaway: "Take it with you" };
  layout.cards = (layout.cards || [])
    .filter((c) => c && CARD_TYPES.includes(c.type) && c.type !== "hero")
    .map((c) => ({
      type: c.type,
      size: ["xl", "lg", "md"].includes(c.size) ? c.size : "lg",
      emoji: typeof c.emoji === "string" ? c.emoji.slice(0, 8) : "✨",
      title: typeof c.title === "string" ? c.title.slice(0, 60) : "",
    }));
  if (!layout.cards.length) {
    layout.cards = [
      { type: "big_idea", size: "xl", emoji: "💡", title: "" },
      { type: "points", size: "lg", emoji: "🔑", title: fallbackTitles.points },
      { type: "takeaway", size: "lg", emoji: "🎒", title: fallbackTitles.takeaway },
    ];
  }
  return layout;
}

async function runPipeline({ transcript, videoTitle, gradeBand, theme, lang }) {
  const substance = await extractSubstance({ transcript, videoTitle, gradeBand, lang });
  if (substance.appropriate === false) {
    throw new Error("NOT_APPROPRIATE");
  }
  const layout = await designLayout({ substance, theme, lang });
  return { substance, layout };
}

module.exports = { runPipeline, GRADE_BANDS, GRADE_BANDS_BY_LANG };
