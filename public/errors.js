// 読み込み失敗やスクリプトのエラーを画面下に表示する（不具合に気づけるように）
(function () {
  function show(msg) {
    var box = document.getElementById('err-box');
    if (!box) {
      box = document.createElement('pre');
      box.id = 'err-box';
      box.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;max-height:40vh;overflow:auto;background:#fff3f3;color:#900;border:1px solid #c00;padding:8px;font-size:12px;white-space:pre-wrap;z-index:99;';
      (document.body || document.documentElement).appendChild(box);
    }
    box.textContent += msg + '\n';
  }
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== window && (t.src || t.href)) show('読み込み失敗: ' + (t.src || t.href));
    else show('エラー: ' + e.message + (e.filename ? ' (' + e.filename + ':' + e.lineno + ')' : ''));
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    show('エラー: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason));
  });
})();
