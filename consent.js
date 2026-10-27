/* Loads Google Analytics and Google AdSense on every page.
   (Kept as one file so the 74 pages that use it stay a one-line change.)
   Visitors can opt out via Google Ad Settings or a browser blocker; see
   /privacy.html#cookies. */
(function () {
  'use strict';
  var GA = 'G-FDZR5XWWBM', ADS = 'ca-pub-9842825734923539';
  function add(src, cors) {
    var s = document.createElement('script'); s.async = true; s.src = src;
    if (cors) s.crossOrigin = 'anonymous';
    document.head.appendChild(s);
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA);
  add('https://www.googletagmanager.com/gtag/js?id=' + GA);
  add('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADS, true);
})();
