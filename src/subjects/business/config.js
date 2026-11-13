/*
 * Business Quest — settings for the site. Sync uses the same Firestore project
 * as Study Quest (src/config.js) with its own family code.
 */
(function (root) {
  'use strict';
  const BQ = (root.BQ = root.BQ || {});
  BQ.config = {
    // Where a parent starts the marking job by hand ("Mark now").
    markNowUrl: 'https://github.com/dosmanoff/study-quest/actions/workflows/mark.yml',
    // How often the open page checks for new marks while answers are waiting.
    pollPendingMs: 30000,
  };
})(typeof window !== 'undefined' ? window : globalThis);
