/* Show /pricing instead of /pricing in the address bar. The .html address
   keeps working (old links, bookmarks, Stripe returns); this only tidies it. */
(function () {
  try {
    var m = location.pathname.match(/^\/(pricing|library|generations|account|success|cancel|affiliates)\.html$/);
    if (m && window.history && history.replaceState) history.replaceState(null, '', '/' + m[1] + location.search + location.hash);
  } catch (e) {}
})();
