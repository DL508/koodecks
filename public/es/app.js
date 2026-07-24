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
    "Leyendo el video…",
    "Saltándonos el relleno…",
    "Buscando las grandes ideas…",
    "Diseñando tu deck…",
    "Dándole el toque final ✨",
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
      errEl.textContent = "¡Primero pega un enlace de YouTube (o suficiente texto)!";
      errEl.classList.remove("hidden");
      return;
    }

    startLoading();
    try {
      const controller = new AbortController();
      const clientTimeout = setTimeout(() => controller.abort(), 75000);
      let res;
      try {
        res = await fetch("/api/decks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url, gradeBand, theme, pastedText, lang: "es", website: ($("hp-website") || { value: "" }).value }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(clientTimeout);
      }
      const data = await res.json().catch(() => ({}));
      stopLoading();
      if (!res.ok) {
        show("home");
        if (data.needsAuth) {
          errEl.innerHTML = 'Por favor <a href="/es/signup?next=/es/app" style="color:var(--violet);font-weight:800;">crea una cuenta gratis</a> o <a href="/es/login?next=/es/app" style="color:var(--violet);font-weight:800;">inicia sesión</a> para crear decks.';
          errEl.classList.remove("hidden");
          return;
        }
        if (data.needsUpgrade) {
          errEl.innerHTML = (data.error || "Llegaste al límite de hoy.") + ' <a href="/es/pricing" style="color:var(--violet);font-weight:800;">Ver Ilimitado →</a>';
          errEl.classList.remove("hidden");
          return;
        }
        errEl.textContent = data.error || "Algo salió mal. Inténtalo de nuevo.";
        errEl.classList.remove("hidden");
        if (data.code === "NO_CAPTIONS") $("pasted-text").classList.remove("hidden");
        return;
      }
      currentDeck = data.deck;
      currentEditKey = data.editKey || null;
      history.pushState({}, "", "/es/d/" + currentDeck.slug);
      openDeck(currentDeck, { fresh: true });
    } catch (e) {
      stopLoading();
      show("home");
      if (e && e.name === "AbortError") {
        errEl.innerHTML = "Tardó más de lo esperado. YouTube a veces tarda en entregar los subtítulos — inténtalo de nuevo o pega el texto de la transcripción.";
        $("pasted-text").classList.remove("hidden");
      } else {
        errEl.textContent = "No pudimos conectar con el servidor. Inténtalo de nuevo en un momento.";
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
    if (opts.fresh) toast("¡Tu deck está listo! Ponle nombre y compártelo 🎉");
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
      toast("Guardado ✔");
    } else if (res.status === 403) {
      toast("Solo quien creó el deck puede cambiarle el nombre");
    } else {
      toast("No se pudo guardar — inténtalo de nuevo");
    }
  });

  // --- save / share the deck as an image (the growth loop) ---
  async function saveImage() {
    if (!currentDeck) return;
    const imgUrl = "/d/" + currentDeck.slug + "/image.png";
    toast("Creando tu imagen… 🖼️");
    try {
      const res = await fetch(imgUrl);
      if (!res.ok) throw new Error("render failed");
      const blob = await res.blob();
      const file = new File([blob], (currentDeck.slug || "koodeck") + ".png", { type: "image/png" });
      // On phones, offer the native share sheet with the actual image file.
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: currentDeck.title || "Mi KooDeck" });
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
      toast("¡Imagen guardada! Publícala donde quieras 🎉");
    } catch {
      toast("No se pudo crear la imagen — inténtalo de nuevo");
    }
  }
  $("image-btn").addEventListener("click", saveImage);

  // --- share to Google Classroom (no login, no roster, no student data) ---
  $("gc-btn").addEventListener("click", () => {
    if (!currentDeck) return;
    const deckUrl = location.origin + "/d/" + currentDeck.slug;
    const shareUrl = KooDeckClassroom.classroomShareUrl(deckUrl, currentDeck.title);
    window.open(shareUrl, "_blank", "noopener");
    toast("Abriendo Google Classroom — elige tu clase para publicarlo 📚");
  });

  // --- share ---
  $("share-btn").addEventListener("click", async () => {
    if (!currentDeck) return;
    const shareUrl = location.origin + "/d/" + currentDeck.slug;
    const title = currentDeck.title || "Mi KooDeck";
    if (navigator.share) {
      try { await navigator.share({ title, url: shareUrl }); return; } catch { /* fall through */ }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast("¡Enlace copiado! Pégalo donde quieras 📋");
    } catch {
      prompt("Copia este enlace:", shareUrl);
    }
  });

  // --- Cloudflare Turnstile (solo si la clave está configurada) ---
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

  // Refleja el estado de sesión en el encabezado (cuentas solo para adultos).
  fetch("/api/auth/me").then((r) => r.json()).then((d) => {
    const link = $("acct-link");
    if (!link) return;
    if (d.user) {
      link.textContent = d.user.plan === "paid" ? "Ilimitado" : (d.user.remainingToday + " decks restantes hoy");
      link.href = "/account";
    } else {
      link.textContent = "Iniciar sesión";
      link.href = "/es/login?next=/es/app";
    }
  }).catch(() => {});
  }
})();
