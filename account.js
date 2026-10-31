(function () {
  // Reads the shared generator state (user, plan, usage) that generate.js
  // keeps current, and paints the account page from it.
  var $ = function (id) { return document.getElementById(id); };
  var PLAN_NAMES = {};
  function planLabel(priceId) {
    try {
      if (typeof PRICE_IDS === 'object') {
        if (priceId === PRICE_IDS.weekly) return '$4.99 per week';
        if (priceId === PRICE_IDS.monthly) return '$19.99 per month';
        if (priceId === PRICE_IDS.annual) return '$199 per year';
      }
    } catch (e) {}
    return '';
  }
  function fmtDate(ts) {
    var n = Number(ts); if (!n) return '';
    if (n < 1e12) n *= 1000;
    try { return new Date(n).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }); } catch (e) { return ''; }
  }
  var last = '';
  function render() {
    if (typeof state === 'undefined') return;
    var signedIn = !!state.user;
    var key = JSON.stringify([signedIn, state.isPro, state.user && state.user.email, state.usage && [state.usage.used, state.usage.limit], state.subscription && [state.subscription.plan, state.subscription.expiresAt]]);
    if (key === last) return; last = key;
    $('acct-guest').hidden = signedIn;
    $('acct-user').hidden = !signedIn;
    if (!signedIn) return;

    var name = state.user.displayName || state.user.name || state.user.email || 'Signed in';
    $('acct-name').textContent = name;
    $('acct-email').textContent = state.user.email && state.user.email !== name ? state.user.email : '';
    $('acct-avatar').textContent = (name.trim().charAt(0) || '?').toUpperCase();

    var pro = !!state.isPro;
    var pill = $('acct-plan-pill'); pill.textContent = pro ? 'Pro' : 'Free'; pill.className = 'status-pill ' + (pro ? 'pro' : 'free');
    $('acct-plan-name').textContent = pro ? 'Pro' : 'Free';
    var detail;
    if (pro) {
      var sub = state.subscription || {};
      var label = planLabel(sub.plan), until = fmtDate(sub.expiresAt);
      detail = (label ? label : 'Unlimited enhancements, every mode, full library') + (until ? ' \u00b7 current period ends ' + until : '');
    } else {
      detail = 'Free plan: 10 enhancements a week, 300 templates, 10 history items.';
    }
    $('acct-plan-detail').textContent = detail;
    $('acct-upgrade').classList.toggle('hidden', pro);
    $('portal-btn').classList.toggle('hidden', !pro);
    $('acct-portal-hint').classList.toggle('hidden', !pro);

    var big = $('acct-usage-big'), sub2 = $('acct-usage-sub'), fill = $('acct-bar-fill');
    if (pro) {
      big.textContent = 'Unlimited'; sub2.textContent = 'enhancements on Pro. No weekly limit.'; fill.style.width = '100%';
    } else {
      var used = state.usage ? state.usage.used : (state.weeklyUsage ? state.weeklyUsage.enhancements : 0);
      var limit = state.usage ? state.usage.limit : 10;
      big.textContent = used + ' of ' + limit;
      sub2.textContent = 'enhancements used. Resets every Monday.';
      fill.style.width = Math.min(100, limit ? (used / limit) * 100 : 0) + '%';
    }
    $('acct-ext-text').textContent = pro
      ? 'Pro is active in the extension too. Just sign in there with this Google account.'
      : 'Sign in to the extension with this Google account and your plan follows you.';
  }
  render();
  setInterval(render, 500);
})();
