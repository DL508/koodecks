// renderer.js — turns a deck object into the infographic DOM.
// Used by both the main app (app.js) and the share page (share.html).

(function () {
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function badge(emoji, label) {
    const b = el("span", "card-badge");
    b.append(el("span", "", emoji), el("span", "", label));
    return b;
  }

  const BADGE_LABELS = {
    big_idea: "La gran idea",
    points: "Ideas clave",
    steps: "Paso a paso",
    numbers: "En números",
    vocab: "Palabras nuevas",
    fun_fact: "Dato curioso",
    quiz: "Ponte a prueba",
    takeaway: "Para recordar",
  };

  function buildCard(cardSpec, s) {
    const card = el("div", `card size-${cardSpec.size} card-${cardSpec.type}`);
    card.append(badge(cardSpec.emoji || "✨", BADGE_LABELS[cardSpec.type] || "Card"));
    if (cardSpec.title) card.append(el("h3", "", cardSpec.title));

    switch (cardSpec.type) {
      case "big_idea":
        card.append(el("p", "", s.big_idea || ""));
        break;

      case "points": {
        const ul = el("ul", "point-list");
        (s.key_points || []).forEach((p) => {
          const li = el("li");
          li.append(el("span", "point-dot"));
          const span = el("span");
          const b = el("b", "", p.title ? p.title + " — " : "");
          span.append(b, document.createTextNode(p.detail || ""));
          li.append(span);
          ul.append(li);
        });
        card.append(ul);
        break;
      }

      case "steps": {
        const ol = el("ol", "step-list");
        (s.steps || []).forEach((p, i) => {
          const li = el("li");
          li.append(el("span", "step-num", String(i + 1)));
          const span = el("span");
          span.append(el("b", "", p.title ? p.title + ": " : ""), document.createTextNode(p.detail || ""));
          li.append(span);
          ol.append(li);
        });
        card.append(ol);
        break;
      }

      case "numbers": {
        const grid = el("div", "num-grid");
        (s.numbers || []).slice(0, 4).forEach((n) => {
          const chip = el("div", "num-chip");
          chip.append(el("span", "val", n.value || ""), el("span", "why", n.meaning || ""));
          grid.append(chip);
        });
        card.append(grid);
        break;
      }

      case "vocab": {
        const ul = el("ul", "vocab-list");
        (s.vocab || []).forEach((v) => {
          const li = el("li");
          li.append(el("span", "point-dot"));
          const span = el("span");
          span.append(el("b", "", (v.word || "") + " = "), document.createTextNode(v.kid_definition || ""));
          li.append(span);
          ul.append(li);
        });
        card.append(ul);
        break;
      }

      case "fun_fact":
        card.append(el("p", "", s.fun_fact || ""));
        break;

      case "quiz": {
        const ul = el("ul", "quiz-list");
        (s.quiz || []).forEach((q) => {
          const li = el("li");
          li.append(
            el("div", "", "❓ " + (q.q || "")),
            el("div", "quiz-hint", "toca para ver la respuesta"),
            el("div", "answer", "✅ " + (q.a || ""))
          );
          li.addEventListener("click", () => li.classList.toggle("open"));
          ul.append(li);
        });
        card.append(ul);
        break;
      }

      case "takeaway":
        card.append(el("p", "", s.takeaway || ""));
        break;
    }
    return card;
  }

  window.renderDeck = function renderDeck(deck, mount) {
    mount.innerHTML = "";
    const s = deck.substance || {};
    const layout = deck.layout || {};

    const root = el("article", `deck theme-${deck.theme || "space"}`);

    // Hero
    const hero = el("header", "deck-hero");
    hero.append(el("span", "hero-emoji", layout.hero_emoji || "✨"));
    hero.append(el("h2", "", deck.title || layout.headline || "My deck"));
    if (layout.subhead) hero.append(el("p", "subhead", layout.subhead));
    if (s.hook && s.hook !== layout.subhead) hero.append(el("p", "subhead", "🤔 " + s.hook));
    if (deck.authorName) hero.append(el("span", "byline", "creado por " + deck.authorName));
    root.append(hero);

    // Cards
    const grid = el("div", "card-grid");
    const hasContent = {
      big_idea: !!s.big_idea, points: (s.key_points || []).length,
      steps: (s.steps || []).length, numbers: (s.numbers || []).length,
      vocab: (s.vocab || []).length, fun_fact: !!s.fun_fact,
      quiz: (s.quiz || []).length, takeaway: !!s.takeaway,
    };
    (layout.cards || []).forEach((c) => {
      if (hasContent[c.type]) grid.append(buildCard(c, s));
    });
    root.append(grid);

    // Source strip
    if (deck.videoId) {
      const src = el("div", "deck-source");
      if (deck.videoThumb) {
        const img = el("img");
        img.src = deck.videoThumb;
        img.alt = "";
        img.loading = "lazy";
        src.append(img);
      }
      const meta = el("div");
      meta.append(el("div", "", "Del video: " + (deck.videoTitle || "")));
      const a = el("a", "", "Ver el video completo en YouTube →");
      a.href = "https://www.youtube.com/watch?v=" + deck.videoId;
      a.target = "_blank";
      a.rel = "noopener";
      meta.append(a);
      src.append(meta);
      root.append(src);
    }

    mount.append(root);
  };
})();
