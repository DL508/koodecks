// lib/packs.js
// Original question packs for DeckDash. Each question has exactly one correct
// answer (index `a`), three distractors, and a "did you know" line shown after
// answering — the same substance a KooDeck deck carries, in game form.

const PACKS = [
  {
    id: "volcano",
    title: "Volcano Power",
    emoji: "🌋",
    theme: "comic",
    subject: "Science",
    questions: [
      { q: "What is melted rock called while it's still underground?", choices: ["Lava", "Magma", "Ash", "Crystal"], a: 1, fun: "Once magma reaches the surface, we start calling it lava." },
      { q: "What builds up inside a volcano before it erupts?", choices: ["Pressure from gases", "Cold water", "Sand", "Electricity"], a: 0, fun: "It's a bit like shaking a soda can before opening it." },
      { q: "About how hot can lava get?", choices: ["100°C", "300°C", "1,000°C", "10,000°C"], a: 2, fun: "That's about 5 times hotter than a kitchen oven at full blast." },
      { q: "Where can volcanoes be found besides land?", choices: ["Under the ocean", "On clouds", "Inside glaciers only", "Nowhere else"], a: 0, fun: "Most of Earth's volcanic activity actually happens underwater." },
      { q: "What do we call a volcano that hasn't erupted in a very long time but still could?", choices: ["Extinct", "Dormant", "Broken", "Frozen"], a: 1, fun: "Dormant means 'sleeping' — extinct volcanoes are the ones done for good." },
    ],
  },
  {
    id: "water",
    title: "Ocean Explorers",
    emoji: "💧",
    theme: "ocean",
    subject: "Science",
    questions: [
      { q: "What makes water rise into the sky?", choices: ["Wind pushing it", "Heat from the sun", "The moon pulling it", "Fish splashing"], a: 1, fun: "That's evaporation — water turning into invisible vapor." },
      { q: "What are clouds made of?", choices: ["Smoke", "Cotton", "Tiny water droplets", "Dust only"], a: 2, fun: "Vapor cools high up and condenses into droplets that form clouds." },
      { q: "About how much of Earth's water is in the oceans?", choices: ["25%", "50%", "75%", "97%"], a: 3, fun: "Only a tiny slice of Earth's water is fresh — and most of that is frozen." },
      { q: "What is it called when water falls from clouds?", choices: ["Evaporation", "Precipitation", "Condensation", "Perspiration"], a: 1, fun: "Rain, snow, and hail are all types of precipitation." },
      { q: "How old is the water you drink?", choices: ["Brand new", "About 100 years old", "As old as the dinosaurs and older", "Exactly 1 year old"], a: 2, fun: "Earth has been recycling the same water for billions of years." },
    ],
  },
  {
    id: "space",
    title: "Space Race",
    emoji: "🪐",
    theme: "space",
    subject: "Space",
    questions: [
      { q: "How many planets orbit our Sun?", choices: ["7", "8", "9", "12"], a: 1, fun: "Pluto was reclassified as a dwarf planet in 2006." },
      { q: "What keeps the planets moving around the Sun?", choices: ["Wind", "Magnets", "Gravity", "Rocket fuel"], a: 2, fun: "The Sun's gravity is the glue of the whole solar system." },
      { q: "About how long does sunlight take to reach Earth?", choices: ["8 seconds", "8 minutes", "8 hours", "8 days"], a: 1, fun: "When you see the Sun, you're seeing it as it was 8 minutes ago." },
      { q: "Which planets are the 'gas giants'?", choices: ["The four closest to the Sun", "The four farthest from the Sun", "Only Mars and Venus", "All of them"], a: 1, fun: "The inner four are small and rocky; the outer four are huge balls of gas and ice." },
      { q: "About how many Earths could fit inside the Sun?", choices: ["13", "1,300", "130,000", "1.3 million"], a: 3, fun: "And the Sun is just an average-sized star!" },
    ],
  },
  {
    id: "fractions",
    title: "Fraction Fiesta",
    emoji: "🍕",
    theme: "candy",
    subject: "Math",
    questions: [
      { q: "In the fraction 3/4, what does the bottom number tell you?", choices: ["How many pieces you have", "How many equal pieces in total", "How big the pizza is", "Nothing"], a: 1, fun: "The bottom number is called the denominator." },
      { q: "Which is the same amount as 1/2?", choices: ["1/4", "2/4", "3/4", "2/3"], a: 1, fun: "1/2, 2/4, and 4/8 are all equivalent fractions." },
      { q: "If you cut a cake into MORE pieces, each piece gets…", choices: ["Bigger", "Smaller", "The same", "Square"], a: 1, fun: "A bigger denominator means smaller pieces — even if the number looks bigger." },
      { q: "You ate 2 slices of a pizza cut into 8 equal slices. What fraction did you eat?", choices: ["2/8", "8/2", "2/2", "6/8"], a: 0, fun: "2/8 simplifies to 1/4 — a quarter of the pizza." },
      { q: "Which fraction is the biggest?", choices: ["1/8", "1/4", "1/3", "1/2"], a: 3, fun: "With the same top number, the smaller the bottom number, the bigger the piece." },
    ],
  },
  {
    id: "animals",
    title: "Animal Champions",
    emoji: "🐆",
    theme: "jungle",
    subject: "Science",
    questions: [
      { q: "What is the fastest land animal?", choices: ["Lion", "Horse", "Cheetah", "Ostrich"], a: 2, fun: "A cheetah can go from 0 to highway speed in about 3 seconds." },
      { q: "Which animal can regrow lost body parts, like legs?", choices: ["Axolotl", "Elephant", "Penguin", "Camel"], a: 0, fun: "The axolotl is a salamander from Mexico famous for regeneration." },
      { q: "How do dolphins find food in dark water?", choices: ["Smelling", "Echolocation", "Night vision", "Luck"], a: 1, fun: "They send out clicks and listen for the echoes bouncing off fish." },
      { q: "What do we call animals that only eat plants?", choices: ["Carnivores", "Omnivores", "Herbivores", "Insectivores"], a: 2, fun: "Elephants are herbivores — and they eat for up to 18 hours a day." },
      { q: "Which bird can fly backwards?", choices: ["Eagle", "Hummingbird", "Owl", "Duck"], a: 1, fun: "Hummingbirds beat their wings around 50 times per second." },
    ],
  },
];

function getPack(id) {
  return PACKS.find((p) => p.id === id) || null;
}

function listPacks() {
  return PACKS.map((p) => ({ id: p.id, title: p.title, emoji: p.emoji, theme: p.theme, subject: p.subject, count: p.questions.length }));
}

module.exports = { PACKS, getPack, listPacks };
