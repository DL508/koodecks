// demo-data.js — pre-generated sample decks for the offline demo.
// These are the shape the real two-stage pipeline produces. Content for each
// grade band is written separately so switching K-2 vs 9-12 shows a real
// difference in language, exactly as the live app does.

const DEMO_SAMPLES = [
  {
    id: "demo-water-cycle",
    emoji: "💧",
    thumbBg: "linear-gradient(135deg,#8fd8ef,#0aa3c2)",
    videoTitle: "How the Water Cycle Works",
    channel: "Nature Nerds",
    length: "12 min",
    videoId: "al-do-video",
    defaultTheme: "ocean",
    defaultGrade: "35",
    layout: {
      hero_emoji: "💧",
      subhead: "Where every raindrop has been",
      cards: [
        { type: "big_idea", size: "xl", emoji: "💡", title: "" },
        { type: "steps", size: "lg", emoji: "🔁", title: "The journey" },
        { type: "numbers", size: "md", emoji: "🔢", title: "" },
        { type: "vocab", size: "md", emoji: "📚", title: "" },
        { type: "fun_fact", size: "lg", emoji: "🤯", title: "" },
        { type: "quiz", size: "lg", emoji: "❓", title: "" },
        { type: "takeaway", size: "lg", emoji: "🎒", title: "" },
      ],
    },
    grades: {
      k2: {
        title: "Water Goes Round",
        substance: {
          big_idea: "Water goes up to the sky and comes back down. It does this again and again!",
          hook: "The rain today has been falling for a very, very long time!",
          key_points: [
            { title: "Up it goes", detail: "The sun warms water. It floats up." },
            { title: "Clouds", detail: "Up high, water makes clouds." },
            { title: "Down it comes", detail: "Clouds get full. Rain falls!" },
          ],
          steps: [
            { title: "Warm", detail: "The sun heats the water." },
            { title: "Rise", detail: "Water floats up high." },
            { title: "Rain", detail: "Water falls back down." },
          ],
          numbers: [{ value: "Most", meaning: "of Earth's water is in the sea" }],
          vocab: [{ word: "cloud", kid_definition: "a big fluffy bunch of tiny water drops" }],
          fun_fact: "The same water has been here since dinosaurs!",
          takeaway: "When it rains, water is just going home to do it all again.",
          quiz: [
            { q: "What makes water go up?", a: "The warm sun!" },
            { q: "What falls from clouds?", a: "Rain!" },
          ],
        },
      },
      "35": {
        title: "The Amazing Water Loop",
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
          numbers: [{ value: "97%", meaning: "of Earth's water is in the oceans" }],
          vocab: [
            { word: "vapor", kid_definition: "water as an invisible gas" },
            { word: "condense", kid_definition: "when a gas cools and turns back into a liquid" },
          ],
          fun_fact: "Earth has been recycling the very same water for billions of years.",
          takeaway: "Next time it rains, remember that water has been on an incredible journey.",
          quiz: [
            { q: "What makes water rise into the sky?", a: "Heat from the sun — that's evaporation." },
            { q: "What are clouds made of?", a: "Tiny drops of condensed water vapor." },
          ],
        },
      },
      "68": {
        title: "The Water Cycle, Explained",
        substance: {
          big_idea: "Driven by energy from the sun, water continuously moves between oceans, atmosphere, and land in a closed system.",
          hook: "There's no 'new' water — the planet has been reusing the same supply for eons.",
          key_points: [
            { title: "Evaporation & transpiration", detail: "Solar energy turns surface water into vapor; plants release it too, through their leaves." },
            { title: "Condensation", detail: "Rising vapor cools and clusters around tiny particles to form clouds." },
            { title: "Precipitation & collection", detail: "Water returns as rain or snow, then flows through rivers and soaks into groundwater." },
          ],
          steps: [
            { title: "Evaporation", detail: "The sun's energy lifts water into the air as vapor." },
            { title: "Condensation", detail: "Cooler high-altitude air forms clouds." },
            { title: "Precipitation", detail: "Water falls and collects, restarting the loop." },
          ],
          numbers: [
            { value: "97%", meaning: "of Earth's water is saltwater in oceans" },
            { value: "~9 days", meaning: "average time a water molecule spends in the air" },
          ],
          vocab: [
            { word: "transpiration", kid_definition: "when plants release water vapor from their leaves" },
            { word: "groundwater", kid_definition: "water stored underground in soil and rock" },
          ],
          fun_fact: "A single water molecule can spend thousands of years in the deep ocean before evaporating.",
          takeaway: "The water cycle is a closed system: energy changes water's form, but never creates or destroys it.",
          quiz: [
            { q: "Which two processes send water into the air?", a: "Evaporation and transpiration." },
            { q: "Why is the water cycle called a 'closed system'?", a: "Because the total amount of water stays the same — it only changes form." },
          ],
        },
      },
      "912": {
        title: "Hydrologic Cycle & Energy Balance",
        substance: {
          big_idea: "The hydrologic cycle redistributes water and latent heat across Earth's systems, powered by solar radiation and gravity.",
          hook: "Every phase change in this cycle moves enormous amounts of energy — it's a key driver of weather and climate.",
          key_points: [
            { title: "Phase changes move energy", detail: "Evaporation absorbs latent heat; condensation releases it, fueling storms and regulating temperature." },
            { title: "Multiple reservoirs", detail: "Water is stored in oceans, ice, groundwater, and the atmosphere, each with very different residence times." },
            { title: "Human impact", detail: "Land use, dams, and warming shift where and how fast water moves through the cycle." },
          ],
          steps: [
            { title: "Evaporation", detail: "Solar energy converts liquid water to vapor, storing latent heat." },
            { title: "Condensation", detail: "Cooling releases that heat and forms clouds." },
            { title: "Precipitation & runoff", detail: "Gravity returns water to the surface and drives it through rivers and aquifers." },
          ],
          numbers: [
            { value: "97.5%", meaning: "of Earth's water is saltwater" },
            { value: "~2.5%", meaning: "is freshwater, mostly locked in ice" },
          ],
          vocab: [
            { word: "latent heat", kid_definition: "energy stored or released when water changes state" },
            { word: "residence time", kid_definition: "how long water stays in one reservoir on average" },
          ],
          fun_fact: "The latent heat released by condensation is a primary energy source powering hurricanes.",
          takeaway: "The cycle isn't just about water — it's a massive engine moving energy that shapes global climate.",
          quiz: [
            { q: "What role does latent heat play in weather?", a: "Its release during condensation provides energy that fuels storms." },
            { q: "Where is most of Earth's freshwater stored?", a: "In glaciers and ice caps." },
          ],
        },
      },
    },
  },

  {
    id: "demo-compound-interest",
    emoji: "💰",
    thumbBg: "linear-gradient(135deg,#ffd166,#ff7ab8)",
    videoTitle: "Compound Interest for Beginners",
    channel: "Money Basics",
    length: "18 min",
    videoId: "mon-ey-vid",
    defaultTheme: "candy",
    defaultGrade: "68",
    layout: {
      hero_emoji: "💰",
      subhead: "How money can grow money",
      cards: [
        { type: "big_idea", size: "xl", emoji: "💡", title: "" },
        { type: "points", size: "lg", emoji: "🔑", title: "The key ideas" },
        { type: "numbers", size: "lg", emoji: "📈", title: "See it grow" },
        { type: "vocab", size: "md", emoji: "📚", title: "" },
        { type: "fun_fact", size: "md", emoji: "🤯", title: "" },
        { type: "takeaway", size: "lg", emoji: "🎒", title: "" },
      ],
    },
    grades: {
      k2: {
        title: "Money That Grows",
        substance: {
          big_idea: "If you save a little money, it can slowly turn into more money over time!",
          hook: "Imagine a piggy bank that adds coins by itself!",
          key_points: [
            { title: "Save it", detail: "Put a little money away. Don't spend it." },
            { title: "Wait", detail: "The longer you wait, the more it grows." },
            { title: "It adds up", detail: "Small savings become big savings." },
          ],
          steps: [],
          numbers: [{ value: "$1 → $2", meaning: "money can grow bigger if you wait" }],
          vocab: [{ word: "save", kid_definition: "to keep money instead of spending it" }],
          fun_fact: "Waiting is like a superpower for money!",
          takeaway: "Save a little, wait a lot, and watch it grow.",
          quiz: [
            { q: "What should you do with money to help it grow?", a: "Save it and wait!" },
            { q: "Does money grow faster if you wait longer?", a: "Yes!" },
          ],
        },
      },
      "35": {
        title: "The Money Snowball",
        substance: {
          big_idea: "When you save money, it can earn a little extra — and then that extra earns even more. It grows like a rolling snowball!",
          hook: "Your money can actually earn money while you sleep!",
          key_points: [
            { title: "Interest is a reward", detail: "Banks pay you a little extra for keeping money there." },
            { title: "It builds on itself", detail: "Next time, you earn extra on your money AND on last time's extra." },
            { title: "Time is the secret", detail: "The longer you leave it, the bigger the snowball gets." },
          ],
          steps: [],
          numbers: [
            { value: "$100", meaning: "money you start with" },
            { value: "$110", meaning: "after 1 year earning a little extra" },
          ],
          vocab: [
            { word: "interest", kid_definition: "extra money the bank gives you for saving" },
          ],
          fun_fact: "Starting to save when you're young beats saving lots of money later.",
          takeaway: "Save early and be patient — time does the heavy lifting.",
          quiz: [
            { q: "What is interest?", a: "Extra money you earn for saving." },
            { q: "What makes the snowball bigger?", a: "Time — the longer you wait, the more it grows." },
          ],
        },
      },
      "68": {
        title: "Why Saving Early Wins",
        substance: {
          big_idea: "Compound interest means you earn interest on your original money AND on the interest you've already earned, so savings grow faster and faster over time.",
          hook: "Two friends save the same total — but the one who started earlier ends up with way more. Here's why.",
          key_points: [
            { title: "Interest on interest", detail: "Unlike simple interest, compounding pays you on your growing balance, not just your first deposit." },
            { title: "Time beats amount", detail: "Starting a few years earlier often matters more than saving larger amounts later." },
            { title: "The rule of 72", detail: "Divide 72 by your interest rate to estimate how many years it takes your money to double." },
          ],
          steps: [],
          numbers: [
            { value: "$1,000", meaning: "starting amount" },
            { value: "$2,000", meaning: "after ~9 years at 8% — it doubled" },
            { value: "$4,000", meaning: "after ~18 years — it doubled again" },
          ],
          vocab: [
            { word: "compound interest", kid_definition: "interest earned on both your money and your past interest" },
            { word: "principal", kid_definition: "the original amount of money you put in" },
          ],
          fun_fact: "Because of compounding, most of your money's growth often happens in the final years — the curve gets steep.",
          takeaway: "Start saving as early as you can; time is compound interest's best friend.",
          quiz: [
            { q: "How is compound interest different from simple interest?", a: "It pays you on your interest too, not just your original deposit." },
            { q: "What does the rule of 72 estimate?", a: "How many years it takes your money to double." },
          ],
        },
      },
      "912": {
        title: "Compounding & the Time Value of Money",
        substance: {
          big_idea: "Compound growth is exponential: reinvested returns generate their own returns, which is why time horizon is the single most powerful lever in personal finance.",
          hook: "The difference between starting to invest at 22 versus 32 can be hundreds of thousands of dollars — with the same monthly amount.",
          key_points: [
            { title: "Exponential, not linear", detail: "Balance follows A = P(1 + r/n)^(nt); growth accelerates as the base compounds." },
            { title: "Opportunity cost of waiting", detail: "Each year delayed removes the most valuable compounding period — the last one, when the balance is largest." },
            { title: "Fees and inflation compound too", detail: "A 1% annual fee compounds against you, quietly eroding decades of returns." },
          ],
          steps: [],
          numbers: [
            { value: "8%", meaning: "sample annual return" },
            { value: "~9 yrs", meaning: "doubling time at 8% (rule of 72)" },
            { value: "10x", meaning: "roughly how much $1 grows over 30 years at 8%" },
          ],
          vocab: [
            { word: "time value of money", kid_definition: "the idea that money now is worth more than the same money later" },
            { word: "annual return", kid_definition: "the percent your investment grows in a year" },
          ],
          fun_fact: "Reducing investment fees from 1% to 0.1% can leave you with tens of percent more wealth over a career, purely through avoided compounding drag.",
          takeaway: "Maximize your time in the market and minimize fees — both compound dramatically over decades.",
          quiz: [
            { q: "Why is delaying investing so costly?", a: "You lose the final, most powerful compounding years when the balance is largest." },
            { q: "How can fees hurt long-term returns?", a: "They compound against you every year, eroding a large share of growth." },
          ],
        },
      },
    },
  },

  {
    id: "demo-photosynthesis",
    emoji: "🌱",
    thumbBg: "linear-gradient(135deg,#d3f26a,#2e8b57)",
    videoTitle: "Photosynthesis Explained",
    channel: "Biology Buddies",
    length: "9 min",
    videoId: "bio-log-vid",
    defaultTheme: "jungle",
    defaultGrade: "35",
    layout: {
      hero_emoji: "🌱",
      subhead: "How plants make their own food",
      cards: [
        { type: "big_idea", size: "xl", emoji: "💡", title: "" },
        { type: "points", size: "lg", emoji: "🔑", title: "The recipe" },
        { type: "vocab", size: "md", emoji: "📚", title: "" },
        { type: "numbers", size: "md", emoji: "🔢", title: "" },
        { type: "fun_fact", size: "lg", emoji: "🤯", title: "" },
        { type: "quiz", size: "lg", emoji: "❓", title: "" },
        { type: "takeaway", size: "lg", emoji: "🎒", title: "" },
      ],
    },
    grades: {
      k2: {
        title: "Plants Make Food from Sun",
        substance: {
          big_idea: "Plants use sunlight to make their own food. They don't eat like we do!",
          hook: "A leaf is like a tiny kitchen powered by the sun!",
          key_points: [
            { title: "Sun", detail: "Plants soak up sunlight." },
            { title: "Water", detail: "Roots drink water from the dirt." },
            { title: "Air", detail: "Leaves take in air." },
          ],
          steps: [],
          numbers: [{ value: "Green", meaning: "the color that catches sunlight" }],
          vocab: [{ word: "leaf", kid_definition: "the green part of a plant that makes food" }],
          fun_fact: "Plants give us the air we breathe!",
          takeaway: "Sun + water + air = plant food. Cool!",
          quiz: [
            { q: "What do plants use to make food?", a: "Sunlight!" },
            { q: "Where do plants get water?", a: "From the dirt, through their roots." },
          ],
        },
      },
      "35": {
        title: "The Leaf's Sunlight Recipe",
        substance: {
          big_idea: "Plants make their own food by mixing sunlight, water, and air inside their leaves.",
          hook: "Every leaf is a tiny solar-powered kitchen!",
          key_points: [
            { title: "Catch the light", detail: "Green stuff called chlorophyll grabs energy from sunlight." },
            { title: "Gather ingredients", detail: "Roots pull up water; leaves take in air (carbon dioxide)." },
            { title: "Cook up sugar", detail: "The plant mixes them into sugar for energy — and breathes out oxygen." },
          ],
          steps: [],
          numbers: [{ value: "O₂", meaning: "oxygen — the gas plants give off for us to breathe" }],
          vocab: [
            { word: "chlorophyll", kid_definition: "the green stuff in leaves that catches sunlight" },
            { word: "oxygen", kid_definition: "the gas in air that we need to breathe" },
          ],
          fun_fact: "Almost all the oxygen you breathe was made by plants and tiny ocean plants!",
          takeaway: "Plants feed themselves with sunlight — and give us oxygen as a bonus.",
          quiz: [
            { q: "What does chlorophyll do?", a: "It catches energy from sunlight." },
            { q: "What gas do plants give off?", a: "Oxygen." },
          ],
        },
      },
      "68": {
        title: "How Photosynthesis Works",
        substance: {
          big_idea: "Photosynthesis is the process where plants convert sunlight, water, and carbon dioxide into glucose (sugar) and oxygen.",
          hook: "Plants are the only 'factories' that turn sunlight directly into food — and everything else depends on them.",
          key_points: [
            { title: "Light captured", detail: "Chlorophyll in the leaves absorbs light energy, mostly red and blue wavelengths." },
            { title: "Raw materials", detail: "Roots supply water; leaf pores called stomata take in carbon dioxide." },
            { title: "Products made", detail: "The plant builds glucose for energy and releases oxygen as a by-product." },
          ],
          steps: [],
          numbers: [
            { value: "6", meaning: "CO₂ molecules used to make one glucose" },
            { value: "6", meaning: "oxygen molecules released" },
          ],
          vocab: [
            { word: "glucose", kid_definition: "a sugar plants make and use for energy" },
            { word: "stomata", kid_definition: "tiny holes in leaves that let gases in and out" },
          ],
          fun_fact: "The oxygen from photosynthesis is basically a waste product — plants make it while building sugar.",
          takeaway: "Photosynthesis powers nearly all life by turning sunlight into stored chemical energy.",
          quiz: [
            { q: "What three ingredients does photosynthesis need?", a: "Sunlight, water, and carbon dioxide." },
            { q: "What are the two products?", a: "Glucose (sugar) and oxygen." },
          ],
        },
      },
      "912": {
        title: "Photosynthesis: Light & Calvin Cycles",
        substance: {
          big_idea: "Photosynthesis converts light energy into chemical energy through two linked stages: the light-dependent reactions and the Calvin cycle.",
          hook: "It's the biochemical bridge between the sun and nearly every food chain on Earth.",
          key_points: [
            { title: "Light-dependent reactions", detail: "In the thylakoid membranes, light splits water, releasing O₂ and producing ATP and NADPH." },
            { title: "The Calvin cycle", detail: "In the stroma, ATP and NADPH power the fixation of CO₂ into glucose — no light needed directly." },
            { title: "Limiting factors", detail: "Light intensity, CO₂ concentration, and temperature each cap the overall rate." },
          ],
          steps: [],
          numbers: [
            { value: "6CO₂", meaning: "carbon dioxide fixed per glucose" },
            { value: "ATP", meaning: "energy currency produced in stage one" },
          ],
          vocab: [
            { word: "thylakoid", kid_definition: "the membrane structures where light reactions happen" },
            { word: "Calvin cycle", kid_definition: "the stage that builds sugar from carbon dioxide" },
          ],
          fun_fact: "The Calvin cycle is often called 'light-independent,' but it still depends on products made only when light is present.",
          takeaway: "Two coupled cycles — one capturing energy, one storing it as sugar — underpin most of Earth's biology.",
          quiz: [
            { q: "Where do the light-dependent reactions occur?", a: "In the thylakoid membranes of the chloroplast." },
            { q: "What does the Calvin cycle produce?", a: "Glucose, from fixed carbon dioxide." },
          ],
        },
      },
    },
  },
];
