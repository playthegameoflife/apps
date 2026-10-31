(function () {
  var params = new URLSearchParams(location.search);
  var sid = params.get('session_id');
  var show = function (id) { var e = document.getElementById(id); if (e) e.hidden = false; };
  if (params.get('synced') === '1') { show('pay-synced'); return; }
  if (sid) {
    var a = document.getElementById('pay-sync-link');
    if (a) a.href = 'https://api-clyep56cdq-uc.a.run.app/sync-subscription?session_id=' + encodeURIComponent(sid);
    show('pay-sync');
  }
})();
