/* Study Quest — start the app once the page is ready. */
(function (root) {
  'use strict';
  function start() {
    const el = document.getElementById('root');
    if (!el || !root.SQ || !root.SQ.app) return;
    root.SQ.app.boot(el);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
