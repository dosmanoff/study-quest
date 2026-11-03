/*
 * Study Quest — defaults for a new family. Parents can change all of this
 * in the parent panel; these values are only used on first setup.
 */
(function (root) {
  'use strict';
  const SQ = root.SQ;

  SQ.config = {
    // Where the sync script lives, relative to index.html.
    // The GitHub Pages build sets this to null (no server there).
    syncUrl: 'api/sync.php',
  };

  SQ.defaults = {
    settings: {
      setSize: 10,        // questions in one set
      setsRequired: 2,    // perfect sets in a row to unlock game time
      rewardMinutes: 30,  // minutes of game time per unlock
      dailyLimit: 0,      // max unlocks per day, 0 = no limit
      onMistake: 'restart', // 'restart' = the set ends at the first mistake, 'finish' = finish the set anyway
      sound: true,
    },
    // Which topics and levels make up the game-time challenge.
    assignment: [
      { topic: 'maths.negatives', levels: [1, 2] },
      { topic: 'maths.powers', levels: [1, 2] },
    ],
  };
})(typeof window !== 'undefined' ? window : globalThis);
