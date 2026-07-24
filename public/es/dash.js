// dash.js — DeckDash game logic.
// Flow: home → (daily | pack | accepted challenge) → 5 timed questions → results
// with an emoji score card, a "beat my score" challenge link, and daily streaks.

(function () {
  const $ = (id) => document.getElementById(id);
  // Cross-promo links point at this same KooDeck site (/app).

  const Q_TIME = 13; // seconds per question
  const BASE_PTS = 100; // per correct answer
  const MAX_BONUS = 50; // extra for answering instantly

  let game = null; // { title, emoji, packId, date, questions, i, score, streak, row, target }

  const toast = (m) => {
    const t = $("toast");
    t.textContent = m; t.classList.remove("hidden");
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.add("hidden"), 2600);
  };
  const show = (v) => {
    ["v-home", "v-game", "v-done"].forEach((id) => $(id).classList.add("hidden"));
    $(v).classList.remove("hidden");
    window.scrollTo(0, 0);
  };

  // ---------- streaks (kept on this device) ----------
  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function paintStreak() {
    const s = readJSON("dd-streak", { n: 0, last: "" });
    if (s.n > 0) { $("streak-n").textContent = s.n; $("streak-pill").classList.remove("hidden"); }
  }
  function bumpStreak(dateStr) {
    const s = readJSON("dd-streak", { n: 0, last: "" });
    if (s.last === dateStr) return s.n;
    const y = new Date(dateStr + "T00:00:00Z"); y.setUTCDate(y.getUTCDate() - 1);
    const yStr = y.toISOString().slice(0, 10);
    const n = s.last === yStr ? s.n + 1 : 1;
    try { localStorage.setItem("dd-streak", JSON.stringify({ n, last: dateStr })); } catch {}
    return n;
  }

  // ---------- home ----------
  async function loadHome() {
    paintStreak();
    try {
      const d = await (await fetch("/api/daily")).json();
      $("daily-emoji").textContent = d.emoji;
      $("daily-title").textContent = `Hoy: ${d.title} · las mismas 5 preguntas para todos`;
      $("daily-btn").onclick = () => start({ ...d, mode: "daily" });
    } catch { $("daily-title").textContent = "No pudimos cargar el reto de hoy — revisa tu internet."; }
    try {
      const { packs } = await (await fetch("/api/packs")).json();
      const grid = $("pack-grid");
      grid.innerHTML = "";
      packs.forEach((p) => {
        const b = document.createElement("button");
        b.className = "pack";
        b.innerHTML = `<span class="pe">${p.emoji}</span><b>${p.title}</b><small>${p.subject} · ${p.count} preguntas</small>`;
        b.onclick = async () => {
          const full = await (await fetch("/api/packs/" + p.id)).json();
          start({ ...full, packId: full.id, mode: "pack" });
        };
        grid.appendChild(b);
      });
    } catch { /* packs are decorative if offline */ }

    // Arriving via a challenge link? (/?challenge=slug)
    const slug = new URLSearchParams(location.search).get("challenge");
    if (slug) {
      try {
        const { challenge } = await (await fetch("/api/challenges/" + encodeURIComponent(slug))).json();
        const isDaily = challenge.packId === "daily";
        $("challenge-text").textContent = `⚔️ ${challenge.name} hizo ${challenge.score} ${challenge.emojiRow}. ¿Le ganas?`;
        $("challenge-banner").classList.remove("hidden");
        $("challenge-play").onclick = async () => {
          if (isDaily) {
            const d = await (await fetch("/api/daily")).json();
            start({ ...d, mode: "daily", target: challenge });
          } else {
            const full = await (await fetch("/api/packs/" + challenge.packId)).json();
            start({ ...full, packId: full.id, mode: "pack", target: challenge });
          }
        };
      } catch { /* stale link — ignore quietly */ }
    }
  }

  // ---------- play ----------
  let timerId = null, tLeft = 0, answered = false;

  function start(pack) {
    game = {
      title: pack.title, emoji: pack.emoji, packId: pack.mode === "daily" ? "daily" : pack.packId,
      date: pack.date || new Date().toISOString().slice(0, 10),
      questions: pack.questions, i: 0, score: 0, streak: 0, row: [], target: pack.target || null,
      mode: pack.mode,
    };
    show("v-game");
    nextQ();
  }

  function nextQ() {
    const q = game.questions[game.i];
    answered = false;
    $("hud-q").textContent = `${game.i + 1}/${game.questions.length}`;
    $("hud-score").textContent = game.score;
    $("mult").textContent = 1 + game.streak;
    $("hud-streak").classList.toggle("hidden", game.streak < 2);
    $("q-text").textContent = q.q;
    $("q-text").classList.add("pop");
    setTimeout(() => $("q-text").classList.remove("pop"), 300);
    $("fun").classList.add("hidden");

    const box = $("choices");
    box.innerHTML = "";
    q.choices.forEach((c, idx) => {
      const b = document.createElement("button");
      b.className = "choice";
      b.textContent = c;
      b.onclick = () => pick(idx, b);
      box.appendChild(b);
    });

    tLeft = Q_TIME;
    $("timer-fill").style.width = "100%";
    clearInterval(timerId);
    timerId = setInterval(() => {
      tLeft -= 0.1;
      $("timer-fill").style.width = Math.max(0, (tLeft / Q_TIME) * 100) + "%";
      if (tLeft <= 0) { clearInterval(timerId); timeUp(); }
    }, 100);
  }

  function reveal(q) {
    [...$("choices").children].forEach((b, idx) => {
      b.disabled = true;
      if (idx === q.a) b.classList.add("right");
      else b.classList.add("dim");
    });
    if (q.fun) { $("fun").textContent = "💡 " + q.fun; $("fun").classList.remove("hidden"); }
  }

  function pick(idx, btn) {
    if (answered) return;
    answered = true;
    clearInterval(timerId);
    const q = game.questions[game.i];
    if (idx === q.a) {
      const fast = tLeft > Q_TIME * 0.6;
      const bonus = Math.round((tLeft / Q_TIME) * MAX_BONUS);
      game.streak += 1;
      const mult = Math.min(3, 1 + Math.floor(game.streak / 2) * 0.5);
      const pts = Math.round((BASE_PTS + bonus) * mult);
      game.score += pts;
      game.row.push(fast ? "⚡" : "🟩");
      toast(`+${pts}${game.streak >= 2 ? " 🔥" : ""}`);
    } else {
      game.streak = 0;
      game.row.push("🟥");
      btn.classList.add("wrong");
    }
    reveal(q);
    advance();
  }

  function timeUp() {
    if (answered) return;
    answered = true;
    game.streak = 0;
    game.row.push("🟨");
    reveal(game.questions[game.i]);
    toast("⏰ ¡Tiempo!");
    advance();
  }

  function advance() {
    $("hud-score").textContent = game.score;
    setTimeout(() => {
      game.i += 1;
      if (game.i < game.questions.length) nextQ();
      else finish();
    }, 1600);
  }

  // ---------- results ----------
  function confetti() {
    const bits = ["🎉", "⭐", "✨", "🎊", "⚡"];
    for (let i = 0; i < 18; i++) {
      const s = document.createElement("span");
      s.className = "confetti";
      s.textContent = bits[i % bits.length];
      s.style.left = Math.random() * 100 + "vw";
      s.style.animationDelay = Math.random() * 0.5 + "s";
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 2400);
    }
  }

  function finish() {
    const rights = game.row.filter((e) => e !== "🟥" && e !== "🟨").length;
    const best = readJSON("dd-best", {});
    const key = game.packId + ":" + (game.packId === "daily" ? game.date : "any");
    const prev = best[key] || 0;
    if (game.score > prev) { best[key] = game.score; try { localStorage.setItem("dd-best", JSON.stringify(best)); } catch {} }

    $("done-score").textContent = game.score;
    $("emoji-row").textContent = game.row.join("");
    $("done-big").textContent = rights === 5 ? "🏆" : rights >= 3 ? "🎉" : "💪";
    $("done-headline").textContent =
      rights === 5 ? "¡Reto perfecto!" : rights >= 3 ? "¡Buen reto!" : "¡Casi! Inténtalo de nuevo";

    let sub = `${game.emoji} ${game.title}`;
    if (game.mode === "daily") {
      const n = bumpStreak(game.date);
      sub += ` · 🔥 ${n} días seguidos`;
      paintStreak();
    }
    if (game.target) {
      sub += game.score > game.target.score
        ? ` · ¡Le ganaste a ${game.target.name} (${game.target.score})! 👑`
        : ` · ${game.target.name} va ganando con ${game.target.score}. ¿Revancha?`;
    }
    if (game.score > prev && prev > 0) sub += " · ¡Nuevo récord personal!";
    $("done-sub").textContent = sub;

    show("v-done");
    if (rights >= 3) confetti();

    $("again-btn").onclick = () => {
      game.questions.forEach(() => {});
      start({ title: game.title, emoji: game.emoji, packId: game.packId, date: game.date, questions: game.questions, mode: game.mode, target: game.target });
    };
    $("share-btn").onclick = share;
  }

  async function share() {
    $("share-btn").disabled = true;
    let url = location.origin;
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          packId: game.packId, date: game.date,
          name: readJSON("dd-name", "") || promptName(),
          score: game.score, emojiRow: game.row.join(""),
        }),
      });
      if (res.ok) url = location.origin + "/c/" + (await res.json()).slug;
    } catch { /* fall back to home link */ }
    const label = game.packId === "daily" ? `Reto Diario — ${game.date}` : `Reto Diario · ${game.title}`;
    const text = `${label} ${game.emoji}\n${game.score} pts ${game.row.join("")}\nGáname 👉 ${url}`;
    try {
      if (navigator.share) { await navigator.share({ text }); }
      else { await navigator.clipboard.writeText(text); toast("¡Tarjeta copiada! Pégala donde quieras 📋"); }
    } catch { toast(text); }
    $("share-btn").disabled = false;
  }

  function promptName() {
    const n = (prompt("¿Tu nombre para el reto? (o déjalo en blanco)") || "").slice(0, 24);
    if (n) try { localStorage.setItem("dd-name", JSON.stringify(n)); } catch {}
    return n;
  }

  loadHome();
})();
