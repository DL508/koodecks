// lib/examples.js
// Four hand-made showcase decks for the landing page. They use the exact shape
// the real pipeline produces, get fixed friendly slugs, and are seeded on
// startup so the "See it in action" links always work in any deployment.

const { seedDeck } = require("./store");

const EXAMPLES = [
  {
    slug: "example-water-cycle",
    subject: "Science",
    theme: "ocean",
    gradeBand: "35",
    title: "The Amazing Water Loop",
    authorName: "Ms. Rivera's Class",
    videoId: "",
    videoTitle: "How the Water Cycle Works",
    videoThumb: "",
    layout: {
      headline: "The Amazing Water Loop", subhead: "Where every raindrop has been", hero_emoji: "💧",
      cards: [
        { type: "big_idea", size: "xl", emoji: "💡", title: "" },
        { type: "steps", size: "lg", emoji: "🔁", title: "The journey" },
        { type: "numbers", size: "md", emoji: "🔢", title: "" },
        { type: "vocab", size: "md", emoji: "📚", title: "" },
        { type: "fun_fact", size: "lg", emoji: "🤯", title: "" },
        { type: "takeaway", size: "lg", emoji: "🎒", title: "" },
      ],
    },
    substance: {
      big_idea: "Water travels in a never-ending loop between the ocean, the sky, and the land.",
      hook: "The water you drank today might once have been in a dinosaur's puddle!",
      key_points: [
        { title: "Evaporation", detail: "The sun heats water and turns it into invisible vapor that rises." },
        { title: "Condensation", detail: "High in the cold air, vapor turns back into tiny drops that form clouds." },
        { title: "Precipitation", detail: "When clouds get heavy, water falls as rain, snow, or hail." },
      ],
      steps: [
        { title: "Warm up", detail: "Sunshine heats lakes and oceans." },
        { title: "Rise", detail: "Water vapor floats up into the sky." },
        { title: "Fall", detail: "Rain brings the water back to the ground." },
      ],
      numbers: [{ value: "97%", meaning: "of Earth's water is in the oceans" }, { value: "9 days", meaning: "a drop's average time in the air" }],
      vocab: [{ word: "vapor", kid_definition: "water as an invisible gas" }, { word: "condense", kid_definition: "when a gas cools into a liquid" }],
      fun_fact: "Earth has been recycling the very same water for billions of years.",
      takeaway: "Next time it rains, remember that water has been on an incredible journey.",
      quiz: [{ q: "What makes water rise into the sky?", a: "Heat from the sun — evaporation." }, { q: "What are clouds made of?", a: "Tiny drops of condensed water vapor." }],
    },
  },
  {
    slug: "example-fractions",
    subject: "Math",
    theme: "candy",
    gradeBand: "35",
    title: "Fractions Are Just Fair Shares",
    authorName: "Mr. Chen",
    videoId: "",
    videoTitle: "Understanding Fractions",
    videoThumb: "",
    layout: {
      headline: "Fractions = Fair Shares", subhead: "Splitting things up, the easy way", hero_emoji: "🍕",
      cards: [
        { type: "big_idea", size: "xl", emoji: "💡", title: "" },
        { type: "points", size: "lg", emoji: "🔑", title: "The key ideas" },
        { type: "vocab", size: "md", emoji: "📚", title: "" },
        { type: "numbers", size: "md", emoji: "🔢", title: "" },
        { type: "quiz", size: "lg", emoji: "❓", title: "" },
        { type: "takeaway", size: "lg", emoji: "🎒", title: "" },
      ],
    },
    substance: {
      big_idea: "A fraction shows how many equal pieces you have out of a whole.",
      hook: "If you've ever split a pizza fairly, you already know fractions!",
      key_points: [
        { title: "Top and bottom", detail: "The bottom number says how many equal pieces the whole is cut into. The top says how many you have." },
        { title: "Same size matters", detail: "The pieces must be equal — half a pizza means two fair, equal halves." },
        { title: "Bigger bottom, smaller pieces", detail: "Cut into more pieces and each piece gets smaller, even if the number looks bigger." },
      ],
      steps: [],
      numbers: [{ value: "3/4", meaning: "three out of four equal pieces" }, { value: "1/2", meaning: "one of two equal halves" }],
      vocab: [{ word: "numerator", kid_definition: "the top number — how many pieces you have" }, { word: "denominator", kid_definition: "the bottom number — how many equal pieces in all" }],
      fun_fact: "1/2, 2/4, and 4/8 are all the same amount — just cut into different numbers of pieces!",
      takeaway: "Whenever you share something fairly, you're using fractions.",
      quiz: [{ q: "What does the bottom number tell you?", a: "How many equal pieces the whole is split into." }, { q: "Is 2/4 the same as 1/2?", a: "Yes — they're equal amounts." }],
    },
  },
  {
    slug: "example-photosynthesis",
    subject: "Science",
    theme: "jungle",
    gradeBand: "35",
    title: "The Leaf's Sunlight Recipe",
    authorName: "Green Team",
    videoId: "",
    videoTitle: "Photosynthesis Explained",
    videoThumb: "",
    layout: {
      headline: "The Leaf's Sunlight Recipe", subhead: "How plants make their own food", hero_emoji: "🌱",
      cards: [
        { type: "big_idea", size: "xl", emoji: "💡", title: "" },
        { type: "points", size: "lg", emoji: "🔑", title: "The recipe" },
        { type: "vocab", size: "md", emoji: "📚", title: "" },
        { type: "fun_fact", size: "md", emoji: "🤯", title: "" },
        { type: "quiz", size: "lg", emoji: "❓", title: "" },
        { type: "takeaway", size: "lg", emoji: "🎒", title: "" },
      ],
    },
    substance: {
      big_idea: "Plants make their own food by mixing sunlight, water, and air inside their leaves.",
      hook: "Every leaf is a tiny solar-powered kitchen!",
      key_points: [
        { title: "Catch the light", detail: "Green stuff called chlorophyll grabs energy from sunlight." },
        { title: "Gather ingredients", detail: "Roots pull up water; leaves take in air (carbon dioxide)." },
        { title: "Cook up sugar", detail: "The plant mixes them into sugar for energy — and breathes out oxygen." },
      ],
      steps: [],
      numbers: [{ value: "O₂", meaning: "oxygen — the gas plants give off for us" }],
      vocab: [{ word: "chlorophyll", kid_definition: "the green stuff in leaves that catches sunlight" }, { word: "oxygen", kid_definition: "the gas in air that we breathe" }],
      fun_fact: "Almost all the oxygen you breathe was made by plants and tiny ocean plants!",
      takeaway: "Plants feed themselves with sunlight — and give us oxygen as a bonus.",
      quiz: [{ q: "What does chlorophyll do?", a: "It catches energy from sunlight." }, { q: "What gas do plants give off?", a: "Oxygen." }],
    },
  },
  {
    slug: "example-solar-system",
    subject: "Space",
    theme: "space",
    gradeBand: "68",
    title: "A Tour of the Solar System",
    authorName: "Astro Club",
    videoId: "",
    videoTitle: "The Solar System Explained",
    videoThumb: "",
    layout: {
      headline: "A Tour of the Solar System", subhead: "Eight worlds around one star", hero_emoji: "🪐",
      cards: [
        { type: "big_idea", size: "xl", emoji: "💡", title: "" },
        { type: "points", size: "lg", emoji: "🔑", title: "Good to know" },
        { type: "numbers", size: "lg", emoji: "🔢", title: "By the numbers" },
        { type: "vocab", size: "md", emoji: "📚", title: "" },
        { type: "fun_fact", size: "md", emoji: "🤯", title: "" },
        { type: "takeaway", size: "lg", emoji: "🎒", title: "" },
      ],
    },
    substance: {
      big_idea: "The solar system is the Sun and everything held by its gravity — eight planets, their moons, and countless smaller objects.",
      hook: "Everything you've ever known fits on the third rock from an ordinary star.",
      key_points: [
        { title: "Rocky vs. gas", detail: "The four inner planets are small and rocky; the four outer ones are huge balls of gas and ice." },
        { title: "Gravity is the glue", detail: "The Sun's gravity keeps every planet moving in its orbit." },
        { title: "Not just planets", detail: "Asteroids, comets, and dwarf planets like Pluto share the neighborhood." },
      ],
      steps: [],
      numbers: [{ value: "8", meaning: "planets orbiting the Sun" }, { value: "1", meaning: "star at the center" }, { value: "8 min", meaning: "for sunlight to reach Earth" }],
      vocab: [{ word: "orbit", kid_definition: "the curved path an object takes around another" }, { word: "gravity", kid_definition: "the pull that keeps planets circling the Sun" }],
      fun_fact: "You could fit about 1.3 million Earths inside the Sun.",
      takeaway: "One star, eight planets, and a lot of gravity keeping it all together.",
      quiz: [{ q: "What holds the planets in orbit?", a: "The Sun's gravity." }, { q: "How are the inner and outer planets different?", a: "Inner ones are small and rocky; outer ones are big gas giants." }],
    },
  },
];

function seedExamples() {
  const seeded = [];
  for (const ex of EXAMPLES) {
    try { seedDeck(ex.slug, ex); seeded.push(ex.slug); } catch (e) { /* ignore */ }
  }
  return seeded;
}

// Lightweight metadata for the landing page cards (no heavy substance).
const EXAMPLE_CARDS = EXAMPLES.map((e) => ({
  slug: e.slug, subject: e.subject, theme: e.theme,
  title: e.title, emoji: e.layout.hero_emoji, gradeBand: e.gradeBand,
}));

module.exports = { EXAMPLES, EXAMPLE_CARDS, seedExamples };
