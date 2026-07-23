// classroom.js
// Builds the Google Classroom "share" URL. This uses Classroom's URL-sharing
// flow — the same mechanism behind the "Share to Classroom" button — which
// opens Classroom's own dialog where the teacher picks a class and posts a
// link. Crucially, it needs NO OAuth, NO roster/API access, and sends NO
// student data: it's just a link with the deck URL. That keeps KooDeck's
// account-less, low-compliance-surface design intact.
//
// If Google ever changes this endpoint, it's a one-line fix here.

(function (root) {
  var SHARE_BASE = "https://classroom.google.com/share";

  function classroomShareUrl(deckUrl, title) {
    if (!deckUrl) return null;
    var q = "?url=" + encodeURIComponent(deckUrl);
    if (title) q += "&title=" + encodeURIComponent(String(title).slice(0, 120));
    return SHARE_BASE + q;
  }

  root.KooDeckClassroom = { classroomShareUrl: classroomShareUrl };
})(typeof self !== "undefined" ? self : this);
