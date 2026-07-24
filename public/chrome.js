// public/chrome.js
// Injects a CONSISTENT site footer (and normalizes the top-nav links) on every
// page, so navigation and footer are identical everywhere. Include this on all
// pages with <script src="/chrome.js" defer></script>.
//
// It renders a footer with a copyright line and a Contact Us link, plus quick
// links (App, Daily Dash, Today's Decks, All Dashes, FAQ). It runs after the
// page loads and won't duplicate a footer if one is already injected.
(function () {
  var YEAR = new Date().getFullYear();
  var isES = location.pathname === "/es" || location.pathname.indexOf("/es/") === 0;
  var base = isES ? "/es" : "";

  var L = isES ? {
    tagline: "Los decks son resúmenes con IA — verifica siempre los datos importantes con tu maestro.",
    app: "Abrir la app", dash: "Reto Diario", today: "Decks de hoy", dashes: "Todos los Retos",
    faq: "Preguntas frecuentes", contact: "Contáctanos", rights: "Todos los derechos reservados.",
  } : {
    tagline: "Decks are AI summaries — always double-check important facts with your teacher.",
    app: "Open the app", dash: "Daily Dash", today: "Today's Decks", dashes: "All Dashes",
    faq: "FAQ", contact: "Contact Us", rights: "All rights reserved.",
  };

  function injectFooter() {
    if (document.getElementById("koo-shared-footer")) return;
    // Remove any pre-existing legacy footer to avoid two footers.
    var old = document.querySelector("footer.foot");
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var f = document.createElement("footer");
    f.id = "koo-shared-footer";
    f.className = "koo-foot";
    f.innerHTML =
      '<div class="koo-foot-links">' +
        '<a href="' + base + '/app">' + L.app + '</a>' +
        '<a href="' + base + '/play">' + L.dash + '</a>' +
        '<a href="' + base + '/today">' + L.today + '</a>' +
        '<a href="' + base + '/dashes">' + L.dashes + '</a>' +
        '<a href="' + base + '/faq">' + L.faq + '</a>' +
        '<a href="' + base + '/contact">' + L.contact + '</a>' +
      '</div>' +
      '<p class="koo-foot-tag">' + L.tagline + '</p>' +
      '<p class="koo-foot-copy">© ' + YEAR + ' KooDeck · ' + L.rights + ' · <a href="' + base + '/contact">' + L.contact + '</a></p>';
    document.body.appendChild(f);
  }

  // Minimal styling injected once, using the site's ink/paper palette.
  function injectStyle() {
    if (document.getElementById("koo-foot-style")) return;
    var s = document.createElement("style");
    s.id = "koo-foot-style";
    s.textContent =
      ".koo-foot{margin-top:48px;padding:28px 18px 40px;border-top:3px solid #241f3d;background:#fff;text-align:center;font-family:'Nunito',system-ui,sans-serif;color:#241f3d;}" +
      ".koo-foot-links{display:flex;flex-wrap:wrap;gap:6px 18px;justify-content:center;margin-bottom:12px;}" +
      ".koo-foot-links a{font-weight:800;font-size:14px;color:#4f3ff0;text-decoration:none;}" +
      ".koo-foot-links a:hover{text-decoration:underline;}" +
      ".koo-foot-tag{font-weight:600;font-size:12.5px;opacity:.75;max-width:640px;margin:0 auto 10px;}" +
      ".koo-foot-copy{font-weight:700;font-size:12px;opacity:.7;}" +
      ".koo-foot-copy a{color:#4f3ff0;text-decoration:none;}" +
      // Injected top-nav (so interior pages that don't load landing.css still style it)
      ".koo-topnav{margin-left:auto;display:flex;align-items:center;gap:16px;flex-wrap:nowrap;}" +
      ".koo-topnav a{text-decoration:none;font-weight:800;color:#241f3d;font-size:14.5px;white-space:nowrap;}" +
      ".koo-topnav a:hover{color:#4f3ff0;}" +
      ".koo-topnav .nav-cta{background:#4f3ff0;color:#fff;padding:8px 15px;border-radius:12px;border:2.5px solid #241f3d;box-shadow:0 3px 0 rgba(36,31,61,0.3);}" +
      "@media (max-width:900px){.koo-topnav{gap:11px;}.koo-topnav a{font-size:13.5px;}}" +
      "@media (max-width:760px){.koo-topnav > a:not(.nav-cta):not(#koo-nav-mydecks){display:none;}}";
    document.head.appendChild(s);
  }

  function run() { injectStyle(); injectNav(); injectFooter(); }

  // Inject a consistent top navigation into the page header, so every page
  // (Daily Dash, All Dashes, Today's Decks, My Decks, FAQ, Contact, etc.) has
  // the same nav — not just the landing page. If a page already has a full
  // .topnav (the landing page does), we leave it alone.
  function injectNav() {
    var header = document.querySelector("header.topbar");
    // If there's no header at all, create one with the brand.
    if (!header) {
      header = document.createElement("header");
      header.className = "topbar";
      header.innerHTML = '<a class="brand" href="' + (base || "/") + '">' +
        '<span class="brand-mark">▶</span><span class="brand-name">KooDeck</span></a>';
      document.body.insertBefore(header, document.body.firstChild);
    }
    // If the page already has a full nav (landing), don't double it up.
    if (header.querySelector(".topnav")) return;

    var nav = document.createElement("nav");
    nav.className = "topnav koo-topnav";
    nav.innerHTML =
      '<a href="' + base + '/today">' + L.today + '</a>' +
      '<a href="' + base + '/play">' + L.dash + '</a>' +
      '<a href="' + base + '/dashes">' + L.dashes + '</a>' +
      '<a href="' + base + '/pricing">' + (isES ? "Precios" : "Pricing") + '</a>' +
      '<a href="' + base + '/mydecks" id="koo-nav-mydecks" style="display:none;">' + (isES ? "Mis decks" : "My Decks") + '</a>' +
      '<a href="' + base + '/login" id="koo-nav-auth" class="nav-cta">' + (isES ? "Iniciar sesión" : "Log in") + '</a>';
    // Push nav to the right if the header doesn't already do so.
    nav.style.marginLeft = "auto";
    header.appendChild(nav);

    // Reflect auth state: show My Decks + "Log out" when signed in.
    fetch("/api/auth/me").then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.user) {
        var md = document.getElementById("koo-nav-mydecks"); if (md) md.style.display = "";
        var authLink = document.getElementById("koo-nav-auth");
        if (authLink) { authLink.textContent = isES ? "Salir" : "Log out"; authLink.href = "#";
          authLink.addEventListener("click", function (e) { e.preventDefault();
            fetch("/api/auth/logout", { method: "POST" }).then(function () { location.href = base + "/"; }); }); }
      }
    }).catch(function () {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
