document.addEventListener('click', function (e) {
  if (!e.target || e.target.id !== 'phg-clear-local') return;
  if (!confirm('Delete prompt history, preferences, sign-in and consent choice stored in this browser?')) return;
  try {
    Object.keys(localStorage).filter(function (k) { return k.indexOf('phg_') === 0 || k.indexOf('phg-') === 0; })
      .forEach(function (k) { localStorage.removeItem(k); });
  } catch (err) {}
  e.target.textContent = 'Deleted ✓';
});
