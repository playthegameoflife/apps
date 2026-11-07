/* Affiliate sign-up link.
   Paste the sign-up URL from your affiliate tool (Rewardful, PromoteKit, Tolt,
   FirstPromoter...) between the quotes below. While it is empty, the Join
   buttons show "Applications opening soon" instead of a broken link. */
(function () {
  var SIGNUP_URL = '';

  function init() {
    var links = document.querySelectorAll('[data-aff-join]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (SIGNUP_URL) {
        a.setAttribute('href', SIGNUP_URL);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');
      } else {
        a.removeAttribute('href');
        a.setAttribute('aria-disabled', 'true');
        a.classList.add('is-soon');
        a.textContent = 'Applications opening soon';
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
