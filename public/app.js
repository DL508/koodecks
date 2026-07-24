// app.js — the main page's behavior.

(function () {
  const $ = (id) => document.getElementById(id);
  const views = { home: $("view-home"), loading: $("view-loading"), deck: $("view-deck") };
  let currentDeck = null;
  let currentEditKey = null; // secret handed back on creation; lets this visitor rename

  function show(name) {
    Object.entries(views).forEach(([k, v]) => v.classList.toggle("hidden", k !== name));
    window.scrollTo({ top: 0 });
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add("hidden"), 2600);
  }

  // --- selectors (grade + theme chips) ---
  let gradeBand = "35";
  let theme = "space";
  $("grade-row").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    gradeBand = btn.dataset.grade;
    [...$("grade-row").children].forEach((c) => c.classList.toggle("selected", c === btn));
  });
  $("theme-row").addEventListener("click", (e) => {
    const btn = e.target.closest(".theme-pick");
    if (!btn) return;
    theme = btn.dataset.theme;
    [...$("theme-row").children].forEach((c) => c.classList.toggle("selected", c === btn));
  });

  $("toggle-paste").addEventListener("click", () => $("pasted-text").classList.toggle("hidden"));

  // --- loading messages ---
  const LOADING_MSGS = [
    "Reading the video…",
    "Skipping the boring parts…",
    "Finding the big ideas…",
    "Designing your deck…",
    "Adding the finishing sparkle…",
  ];
  let loadTimer = null;
  function startLoading() {
    show("loading");
    let i = 0;
    $("loading-msg").textContent = LOADING_MSGS[0];
    loadTimer = setInterval(() => {
      i = Math.min(i + 1, LOADING_MSGS.length - 1);
      $("loading-msg").textContent = LOADING_MSGS[i];
    }, 7000);
  }
  function stopLoading() { clearInterval(loadTimer); }

  // --- create deck ---
  $("deck-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = $("form-error");
    errEl.classList.add("hidden");

    const url = $("yt-url").value.trim();
    const pastedText = $("pasted-text").value.trim();
    if (!url && pastedText.length < 200) {
      errEl.textContent = "Paste a YouTube link (or enough text) first!";
      errEl.classList.remove("hidden");
      return;
    }

    startLoading();
    try {
      // Deck creation can legitimately take a while (reading the video + two AI
      // passes). Give it a generous client-side ceiling so a genuinely stuck
      // request ends with a clear message instead of hanging.
      const controller = new AbortController();
      const clientTimeout = setTimeout(() => controller.abort(), 75000);
      let res;
      try {
        res = await fetch("/api/decks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url, gradeBand, theme, pastedText, website: ($("hp-website") || { value: "" }).value }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(clientTimeout);
      }
      // Parse defensively: if the server ever returns a non-JSON body, don't let
      // JSON.parse blow up into the misleading "couldn't reach the server" path.
      const data = await res.json().catch(() => ({}));
      stopLoading();
      if (!res.ok) {
        show("home");
        if (data.needsAuth) {
          errEl.innerHTML = 'Please <a href="/signup?next=/app" style="color:var(--violet);font-weight:800;">create a free account</a> or <a href="/login?next=/app" style="color:var(--violet);font-weight:800;">log in</a> to make decks.';
          errEl.classList.remove("hidden");
          return;
        }
        if (data.needsUpgrade) {
          errEl.innerHTML = (data.error || "Daily limit reached.") + ' <a href="/pricing" style="color:var(--violet);font-weight:800;">See Unlimited →</a>';
          errEl.classList.remove("hidden");
          return;
        }
        errEl.textContent = data.error || "Something went wrong. Please try again.";
        errEl.classList.remove("hidden");
        if (data.code === "NO_CAPTIONS") $("pasted-text").classList.remove("hidden");
        return;
      }
      currentDeck = data.deck;
      currentEditKey = data.editKey || null;
      history.pushState({}, "", "/d/" + currentDeck.slug);
      openDeck(currentDeck, { fresh: true });
    } catch (e) {
      stopLoading();
      show("home");
      // AbortError = our own client timeout (request took too long), otherwise a
      // genuine network problem. Give an honest, actionable message either way.
      if (e && e.name === "AbortError") {
        errEl.innerHTML = "That took longer than expected. YouTube can be slow to hand over captions — please try again, or paste the transcript text instead.";
        $("pasted-text").classList.remove("hidden");
      } else {
        errEl.textContent = "Couldn't reach the server. Please try again in a moment.";
      }
      errEl.classList.remove("hidden");
    }
  });

  function openDeck(deck, opts = {}) {
    currentDeck = deck;
    renderDeck(deck, $("deck-root"));
    $("deck-title").value = deck.title || "";
    $("deck-author").value = deck.authorName || "";
    $("rename-panel").classList.toggle("hidden", !opts.fresh);
    show("deck");
    if (opts.fresh) toast("Deck ready! Give it a name, then share it 🎉");
  }

  // --- rename ---
  $("edit-btn").addEventListener("click", () => $("rename-panel").classList.toggle("hidden"));
  $("save-name").addEventListener("click", async () => {
    if (!currentDeck) return;
    const res = await fetch("/api/decks/" + currentDeck.slug, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: $("deck-title").value,
        authorName: $("deck-author").value,
        editKey: currentEditKey,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      currentDeck = data.deck;
      renderDeck(currentDeck, $("deck-root"));
      $("rename-panel").classList.add("hidden");
      toast("Saved ✔");
    } else if (res.status === 403) {
      toast("Only the deck's creator can rename it");
    } else {
      toast("Couldn't save — try again");
    }
  });

  // --- save / share the deck as an image (the growth loop) ---
  async function saveImage() {
    if (!currentDeck) return;
    const imgUrl = "/d/" + currentDeck.slug + "/image.png";
    toast("Making your image… 🖼️");
    try {
      const res = await fetch(imgUrl);
      if (!res.ok) throw new Error("render failed");
      const blob = await res.blob();
      const file = new File([blob], (currentDeck.slug || "koodeck") + ".png", { type: "image/png" });
      // On phones, offer the native share sheet with the actual image file.
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: currentDeck.title || "My KooDeck" });
          return;
        } catch { /* user cancelled — fall through to download */ }
      }
      // Otherwise download it.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast("Image saved! Post it anywhere 🎉");
    } catch {
      toast("Couldn't make the image — try again");
    }
  }
  $("image-btn").addEventListener("click", saveImage);

  // --- share to Google Classroom (no login, no roster, no student data) ---
  $("gc-btn").addEventListener("click", () => {
    if (!currentDeck) return;
    const deckUrl = location.origin + "/d/" + currentDeck.slug;
    const shareUrl = KooDeckClassroom.classroomShareUrl(deckUrl, currentDeck.title);
    window.open(shareUrl, "_blank", "noopener");
    toast("Opening Google Classroom — pick your class to post it 📚");
  });

  // --- share ---
  $("share-btn").addEventListener("click", async () => {
    if (!currentDeck) return;
    const shareUrl = location.origin + "/d/" + currentDeck.slug;
    const title = currentDeck.title || "My KooDeck";
    if (navigator.share) {
      try { await navigator.share({ title, url: shareUrl }); return; } catch { /* fall through */ }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast("Link copied! Paste it anywhere 📋");
    } catch {
      prompt("Copy this link:", shareUrl);
    }
  });

  // --- Cloudflare Turnstile (only if the site key is configured) ---
  (function () {
    const tsBox = $("ts-box");
    if (!tsBox) return;
    const tsKey = (tsBox.dataset.tskey || "").trim();
    if (!tsKey || tsKey.includes("{")) return;
    const sc = document.createElement("script");
    sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__tsReady";
    sc.async = true; sc.defer = true;
    window.__tsReady = () => {
      window.turnstile.render(tsBox, { sitekey: tsKey, callback: (t) => { window.__tsToken = t; } });
    };
    document.head.appendChild(sc);
  })();

  // --- keep the view in sync with browser back/forward ---
  window.addEventListener("popstate", () => {
    if (location.pathname === "/app" || location.pathname === "/") {
      show("home");
    } else if (currentDeck && location.pathname === "/d/" + currentDeck.slug) {
      show("deck");
    }
  });

  // --- PWA ---
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});

  // Reflect login state in the header (adults-only accounts).
  fetch("/api/auth/me").then((r) => r.json()).then((d) => {
    const link = $("acct-link");
    if (!link) return;
    if (d.user) {
      const left = d.user.plan === "paid" ? "Unlimited" : (d.user.remainingToday + (d.user.remainingToday === 1 ? " deck left today" : " decks left today"));
      link.textContent = left;
      link.href = "/account";
    } else {
      link.textContent = "Log in";
      link.href = "/login?next=/app";
    }
  }).catch(() => {});
  }
})();
