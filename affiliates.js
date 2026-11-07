/* Affiliate sign-up link.
   Paste the sign-up URL from your affiliate tool (Rewardful, PromoteKit, Tolt,
   FirstPromoter...) between the quotes below. While it is empty, the Join
   buttons show "Applications opening soon" instead of a broken link. */
(function () {
  var SIGNUP_URL = 'https://promptgeneratorfyi-37e2.endorsely.com';

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
  function copyInit() {
    var btns = document.querySelectorAll('[data-copy]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var b = this, t = b.parentNode.querySelector('[data-copy-src]').textContent;
        var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, done); else done();
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); copyInit(); }); else { init(); copyInit(); }
})();
