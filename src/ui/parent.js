/*
 * Study Quest — parent screens (in Russian): first setup, PIN, parent panel.
 */
(function (root) {
  'use strict';
  const SQ = root.SQ, E = SQ.engine, ui = SQ.ui, app = SQ.app, esc = SQ.util.escape;
  const doc = root.document;
  const screens = ui.screens, actions = ui.actions;
  const UNLOCK_MS = 5 * 60 * 1000;

  function $(id) { return doc.getElementById(id); }
  function pct(x) { return Math.round(x * 100) + '%'; }
  const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  function when(ts) {
    const d = new Date(ts);
    const hm = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    if (E.dayKey(ts) === E.dayKey()) return 'сегодня, ' + hm;
    if (E.dayKey(ts) === E.dayKey(Date.now() - 864e5)) return 'вчера, ' + hm;
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + hm;
  }
  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }
  function validPin(p) { return /^[0-9]{4}$/.test(p); }
  function joinLink(code) {
    const l = root.location;
    return l.origin + l.pathname + '#join-' + code;
  }
  function copy(text, okMsg) {
    const done = function () { ui.toast(okMsg || 'Скопировано'); };
    try {
      navigator.clipboard.writeText(text).then(done, function () { ui.toast('Выделите текст и скопируйте вручную'); });
    } catch (e) {
      ui.toast('Выделите текст и скопируйте вручную');
    }
  }

  /* ---------- first setup ---------- */

  screens.setup = function (args) {
    const syncOn = SQ.sync.enabled;
    const mode = syncOn ? (args.mode || (args.join ? 'join' : 'new')) : 'new';
    const seg = syncOn
      ? '<div class="seg" role="tablist">' +
        '<button role="tab" class="seg-btn' + (mode === 'new' ? ' on' : '') + '" aria-selected="' + (mode === 'new') + '" data-act="setup-mode" data-mode="new">Первая настройка</button>' +
        '<button role="tab" class="seg-btn' + (mode === 'join' ? ' on' : '') + '" aria-selected="' + (mode === 'join') + '" data-act="setup-mode" data-mode="join">У меня есть код семьи</button>' +
        '</div>'
      : '';
    const formNew =
      '<form id="setup-form" class="form" novalidate>' +
      '<label class="field"><span>Имя ребёнка</span><input id="setup-name" maxlength="30" autocomplete="off" placeholder="Например, Sam"></label>' +
      '<label class="field"><span>PIN родителя, 4 цифры</span><input id="setup-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></label>' +
      '<label class="field"><span>Повторите PIN</span><input id="setup-pin2" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></label>' +
      '<p class="form-err" id="setup-err" role="alert"></p>' +
      '<button class="btn primary big" type="submit">Готово</button>' +
      '<p class="muted small">PIN нужен, чтобы ребёнок не мог поменять правила. Темы, число вопросов и минуты игры настраиваются потом в разделе «For parents» внизу страницы.</p>' +
      '</form>';
    const formJoin =
      '<form id="join-form" class="form" novalidate>' +
      '<label class="field"><span>Код семьи</span><input id="join-code" class="code-input" maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX" value="' + esc(args.join || '') + '"></label>' +
      '<p class="form-err" id="join-err" role="alert"></p>' +
      '<button class="btn primary big" type="submit">Подключить это устройство</button>' +
      '<p class="muted small">Код есть на устройстве, где всё уже настроено: «For parents» → «Устройства». Там же есть готовая ссылка, которую можно просто открыть на этом устройстве.</p>' +
      '</form>';
    ui.set(
      '<section class="panel setup">' +
      '<p class="eyebrow">Для родителей</p>' +
      '<h1>Настройка Study Quest</h1>' +
      '<p class="muted">Ребёнок решает сеты примеров. Несколько идеальных сетов подряд (без единой ошибки) открывают время для компьютерных игр. Интерфейс для ребёнка на английском, как в школе; панель родителя на русском.</p>' +
      seg + (mode === 'join' ? formJoin : formNew) +
      (!syncOn ? '<p class="notice">Сайт открыт без сервера синхронизации, поэтому прогресс будет храниться только в этом браузере. Чтобы телефон и компьютер видели общий прогресс, загрузите сайт на хостинг с PHP (см. README).</p>' : '') +
      '</section>'
    );

    const f = $('setup-form');
    if (f) f.addEventListener('submit', function (e) {
      e.preventDefault();
      const name = $('setup-name').value.trim();
      const pin = $('setup-pin').value.trim(), pin2 = $('setup-pin2').value.trim();
      const err = $('setup-err');
      if (!name) { err.textContent = 'Введите имя ребёнка.'; return; }
      if (!validPin(pin)) { err.textContent = 'PIN должен состоять из 4 цифр.'; return; }
      if (pin !== pin2) { err.textContent = 'PIN-коды не совпадают.'; return; }
      const st = app.state.settings;
      st.childName = name;
      st.pinHash = SQ.hashPin(pin);
      ui.touchSettings();
      SQ.storage.save(app.state);
      if (SQ.sync.enabled) {
        SQ.sync.createFamily();
        ui.commit();
        app.parentAt = Date.now();
        ui.show('parent', { tab: 'devices', fresh: true });
      } else {
        ui.commit();
        ui.show('home');
        ui.toast('Готово! Можно начинать.');
      }
    });

    const j = $('join-form');
    if (j) {
      const inp = $('join-code');
      inp.addEventListener('input', function () {
        const v = SQ.sync.normaliseCode(inp.value);
        if (v !== inp.value) inp.value = v;
      });
      j.addEventListener('submit', function (e) {
        e.preventDefault();
        const err = $('join-err');
        err.textContent = 'Проверяю код…';
        SQ.sync.join(inp.value).then(function (state) {
          app.state = state;
          SQ.storage.save(state);
          ui.show(state.settings.pinHash ? 'home' : 'setup', {});
          ui.toast('Устройство подключено');
        }).catch(function (ex) {
          err.textContent = ex.message === 'invalid' ? 'Код выглядит так: XXXX-XXXX-XXXX.'
            : ex.message === 'not-found' ? 'Такой код не найден. Проверьте буквы и цифры.'
            : 'Нет связи с сервером. Попробуйте ещё раз.';
        });
      });
    }
  };

  actions['setup-mode'] = function (el) { ui.show('setup', { mode: el.dataset.mode }); };

  /* ---------- PIN ---------- */

  let pinBuf = '';

  screens.pin = function () {
    pinBuf = '';
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) {
      return '<button class="key" data-act="pin-key" data-k="' + n + '">' + n + '</button>';
    }).join('');
    ui.set(
      '<section class="panel pin">' +
      '<p class="eyebrow">For parents</p><h1>Введите PIN</h1>' +
      '<div class="pin-dots" id="pin-dots" aria-label="Введено 0 из 4"><span></span><span></span><span></span><span></span></div>' +
      '<p class="form-err" id="pin-err" role="alert"></p>' +
      '<div class="pinpad">' + keys +
      '<span></span><button class="key" data-act="pin-key" data-k="0">0</button>' +
      '<button class="key fn" data-act="pin-key" data-k="back" aria-label="Стереть">' + ui.ICON.del + '</button></div>' +
      '<div class="pin-links"><button class="link" data-act="home">' + ui.ICON.back + 'Back</button>' +
      '<button class="link" data-act="pin-forgot">Забыли PIN?</button></div>' +
      '<div id="pin-forgot" class="forgot" hidden>' +
      '<p>PIN нельзя восстановить. Можно стереть все данные и настройки на этом устройстве и настроить всё заново. Если включена синхронизация, другие устройства это не затронет.</p>' +
      '<label class="field"><span>Чтобы стереть, напишите СБРОС</span><input id="forgot-word" autocomplete="off"></label>' +
      '<button class="btn danger" data-act="pin-reset">Стереть данные на этом устройстве</button></div>' +
      '</section>'
    );
  };

  function pinDots() {
    const dots = $('pin-dots');
    if (!dots) return;
    Array.prototype.forEach.call(dots.children, function (d, i) { d.className = i < pinBuf.length ? 'on' : ''; });
    dots.setAttribute('aria-label', 'Введено ' + pinBuf.length + ' из 4');
  }

  function pinKey(k) {
    if (k === 'back') pinBuf = pinBuf.slice(0, -1);
    else if (pinBuf.length < 4) pinBuf += k;
    pinDots();
    $('pin-err').textContent = '';
    if (pinBuf.length === 4) {
      if (SQ.hashPin(pinBuf) === app.state.settings.pinHash) {
        app.parentAt = Date.now();
        ui.show('parent', { tab: 'progress' });
      } else {
        pinBuf = '';
        const dots = $('pin-dots');
        dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake');
        setTimeout(pinDots, 250);
        $('pin-err').textContent = 'Неверный PIN';
      }
    }
  }

  actions.parent = function () {
    if (!app.state.settings.pinHash) return ui.show('setup', {});
    if (app.parentAt && Date.now() - app.parentAt < UNLOCK_MS) return ui.show('parent', { tab: 'progress' });
    ui.show('pin');
  };
  actions['pin-key'] = function (el) { pinKey(el.dataset.k); };
  actions['pin-forgot'] = function () { $('pin-forgot').hidden = false; $('forgot-word').focus(); };
  actions['pin-reset'] = function () {
    const w = $('forgot-word').value.trim().toUpperCase();
    if (w !== 'СБРОС' && w !== 'RESET') { ui.toast('Напишите слово СБРОС'); return; }
    SQ.sync.leave();
    SQ.storage.setMeta('active', null);
    app.state = SQ.storage.blank();
    SQ.storage.save(app.state);
    app.parentAt = 0;
    ui.show('setup', {});
  };

  doc.addEventListener('keydown', function (e) {
    if (!app.screen || app.screen.name !== 'pin') return;
    if (doc.activeElement && doc.activeElement.tagName === 'INPUT') return;
    if (/^[0-9]$/.test(e.key)) { pinKey(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace') { pinKey('back'); e.preventDefault(); }
  });

  /* ---------- parent panel ---------- */

  const TABS = [
    ['progress', 'Прогресс'],
    ['challenge', 'Правила'],
    ['topics', 'Темы'],
    ['devices', 'Устройства'],
    ['data', 'Данные'],
  ];

  screens.parent = function (args) {
    if (!app.parentAt || Date.now() - app.parentAt > UNLOCK_MS * 6) return ui.show('pin');
    app.parentAt = Date.now();
    const tab = args.tab || 'progress';
    const body = { progress: progressTab, challenge: challengeTab, topics: topicsTab, devices: devicesTab, data: dataTab }[tab](args);
    ui.set(
      '<section class="parent">' +
      '<div class="parent-head"><div><p class="eyebrow">Для родителей</p>' +
      '<h1>' + esc(app.state.settings.childName || 'Ребёнок') + ': прогресс и настройки</h1></div>' +
      '<button class="btn ghost small" data-act="parent-exit">Выйти</button></div>' +
      '<nav class="tabs" role="tablist">' + TABS.map(function (t) {
        return '<button role="tab" class="tab' + (t[0] === tab ? ' on' : '') + '" aria-selected="' + (t[0] === tab) + '" data-act="parent-tab" data-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</nav>' +
      '<div class="tab-body">' + body + '</div></section>'
    );
    if (bind[tab]) bind[tab](args);
  };

  actions['parent-tab'] = function (el) { ui.show('parent', { tab: el.dataset.tab }); };
  actions['parent-exit'] = function () { app.parentAt = 0; ui.show('home'); };

  const bind = {};

  /* ----- progress ----- */

  function setLabel(h) {
    if (h.mode === 'practice') {
      const t = SQ.topic(h.topic);
      return 'Практика' + (t ? ': ' + esc(t.title) + ', ур. ' + h.level : '');
    }
    return 'Испытание';
  }

  function setResult(h) {
    if (h.abandoned) return '<span class="pill warn">прерван</span>';
    if (h.mode === 'challenge') {
      if (h.perfect) return '<span class="pill good">' + h.correct + '/' + h.size + ' без ошибок</span>';
      const firstBad = (h.items || []).findIndex(function (i) { return !i.ok; });
      if (!h.completed && firstBad !== -1) return '<span class="pill bad">ошибка на ' + (firstBad + 1) + '-м вопросе</span>';
      return '<span class="pill bad">' + h.correct + '/' + h.size + '</span>';
    }
    return '<span class="pill ' + (h.correct === h.size ? 'good' : 'plain') + '">' + h.correct + '/' + (h.items || []).length + '</span>';
  }

  function meter(ratio) {
    const level = ratio >= 0.9 ? 'good' : ratio >= 0.7 ? 'warn' : 'bad';
    return '<span class="meter ' + level + '" role="img" aria-label="' + pct(ratio) + '"><span style="width:' + Math.max(2, Math.round(ratio * 100)) + '%"></span></span>';
  }

  function progressTab() {
    const s = app.state, st = s.settings;
    const today = E.dayKey();
    const todays = s.history.filter(function (h) { return E.dayKey(h.ts) === today; });
    const chal = todays.filter(function (h) { return h.mode === 'challenge'; });
    const perfect = chal.filter(function (h) { return h.perfect; }).length;
    const rewardsToday = s.rewards.filter(function (r) { return E.dayKey(r.ts) === today; });
    const minsToday = rewardsToday.reduce(function (a, r) { return a + r.minutes; }, 0);
    const weekAgo = Date.now() - 7 * 864e5;
    let n = 0, ok = 0;
    s.history.forEach(function (h) {
      if (h.ts < weekAgo) return;
      (h.items || []).forEach(function (i) { n++; if (i.ok) ok++; });
    });

    const tiles =
      '<div class="tiles">' +
      tile('Сетов сегодня', String(todays.length), 'испытание: ' + chal.length + ', практика: ' + (todays.length - chal.length)) +
      tile('Без ошибок сегодня', String(perfect), 'из ' + chal.length + ' в испытании') +
      tile('Игровое время сегодня', minsToday + ' мин', rewardsToday.length + ' ' + plural(rewardsToday.length, 'награда', 'награды', 'наград') + (st.dailyLimit ? ' из ' + st.dailyLimit : '')) +
      tile('Точность за 7 дней', n ? pct(ok / n) : '—', n + ' ' + plural(n, 'ответ', 'ответа', 'ответов')) +
      '</div>';

    let chance = '';
    const ra = E.recentAccuracy(s, 100, 'challenge');
    if (ra) {
      const need = st.setSize * st.setsRequired;
      const p = Math.pow(ra.accuracy, need);
      chance = '<div class="explain"><p>Точность в испытании за последние ' + ra.count + ' ответов: <b>' + pct(ra.accuracy) + '</b>. ' +
        'Чтобы получить награду, нужно ответить верно на <b>' + need + ' вопросов подряд</b>. С такой точностью это получается примерно в ' +
        '<b>' + (p >= 0.995 ? '100' : Math.max(1, Math.round(p * 100))) + '%</b> попыток' +
        (p > 0 && p < 0.5 ? ' (в среднем одна удачная попытка из ' + Math.round(1 / p) + ')' : '') + '.</p>' +
        (p < 0.15 ? '<p>Если выходит слишком тяжело, сделайте задание проще во вкладке «Правила» (меньше вопросов или сетов) или «Темы» (более лёгкие уровни), а потом поднимайте планку.</p>' : '') +
        '</div>';
    }

    const monthAgo = Date.now() - 30 * 864e5;
    const stats = ui.levelStats(s, monthAgo);
    const rows = Object.keys(stats).map(function (k) { return stats[k]; })
      .filter(function (m) { return SQ.topic(m.t); })
      .sort(function (a, b) { return a.ok / a.n - b.ok / b.n; });
    const table = rows.length
      ? '<div class="table-wrap"><table class="stats"><thead><tr><th>Тема и уровень</th><th class="num">Ответов</th><th>Верно</th></tr></thead><tbody>' +
        rows.map(function (m) {
          const t = SQ.topic(m.t), l = SQ.level(m.t, m.l);
          const r = m.ok / m.n;
          return '<tr><td>' + esc(t.title) + '<span class="muted"> · ' + m.l + '. ' + esc(l ? l.title : '') + '</span></td>' +
            '<td class="num">' + m.n + '</td><td class="acc"><span class="acc-num">' + pct(r) + '</span>' + meter(r) +
            (r < 0.7 ? '<span class="pill bad small">трудно</span>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<p class="muted">Пока нет ответов за последние 30 дней.</p>';

    const mistakes = [];
    for (let i = s.history.length - 1; i >= 0 && mistakes.length < 15; i--) {
      const h = s.history[i];
      for (let j = (h.items || []).length - 1; j >= 0 && mistakes.length < 15; j--) {
        if (!h.items[j].ok) mistakes.push({ it: h.items[j], ts: h.ts });
      }
    }
    const mistakeList = mistakes.length
      ? '<ul class="review compact">' + mistakes.map(function (m) {
        return '<li><span class="rq">' + ui.text(m.it.q) + '</span>' +
          '<span class="rg">ответ: <s>' + esc(m.it.g) + '</s></span>' +
          '<span class="ra">верно: <b>' + esc(m.it.a) + '</b></span>' +
          '<span class="rt muted">' + when(m.ts) + '</span></li>';
      }).join('') + '</ul>'
      : '<p class="muted">Ошибок пока нет.</p>';

    const recent = s.history.slice(-25).reverse();
    const historyList = recent.length
      ? '<ul class="hist">' + recent.map(function (h) {
        return '<li><span class="h-when muted">' + when(h.ts) + '</span><span class="h-what">' + setLabel(h) + '</span>' + setResult(h) + '</li>';
      }).join('') + '</ul>'
      : '<p class="muted">Сетов пока не было.</p>';

    const rewards = s.rewards.slice(-10).reverse();
    const now = Date.now();
    const rewardList = rewards.length
      ? '<ul class="hist">' + rewards.map(function (r) {
        const status = !r.startedAt ? '<span class="pill plain">ещё не начато</span>'
          : r.endsAt > now ? '<span class="pill good">идёт, осталось ' + ui.fmtTime(r.endsAt - now) + '</span>'
          : '<span class="pill plain">использовано' + (r.stoppedEarly ? ' (закончил раньше)' : '') + '</span>';
        return '<li><span class="h-when muted">' + when(r.ts) + '</span><span class="h-what">' + r.minutes + ' мин игры</span>' + status + '</li>';
      }).join('') + '</ul>'
      : '<p class="muted">Наград пока не было.</p>';

    return tiles + chance +
      '<section class="p-sec"><h2>Где трудно (30 дней)</h2><p class="muted small">Сначала самые трудные. Зелёный: 90% и выше, жёлтый: 70–89%, красный: ниже 70%.</p>' + table + '</section>' +
      '<section class="p-sec"><h2>Последние ошибки</h2>' + mistakeList + '</section>' +
      '<section class="p-sec"><h2>История сетов</h2>' + historyList + '</section>' +
      '<section class="p-sec"><h2>Игровое время</h2>' + rewardList + '</section>';
  }

  function tile(label, value, sub) {
    return '<div class="tile"><p class="tile-label">' + label + '</p><p class="tile-value">' + value + '</p>' +
      (sub ? '<p class="tile-sub">' + sub + '</p>' : '') + '</div>';
  }

  /* ----- challenge rules ----- */

  function select(id, label, value, options) {
    return '<label class="field"><span>' + label + '</span><select id="' + id + '">' + options.map(function (o) {
      const v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
      return '<option value="' + v + '"' + (Number(value) === v ? ' selected' : '') + '>' + t + '</option>';
    }).join('') + '</select></label>';
  }

  function challengeTab() {
    const st = app.state.settings;
    return '<form id="rules-form" class="form two-col" novalidate>' +
      select('set-size', 'Вопросов в одном сете', st.setSize, [5, 6, 8, 10, 12, 15, 20]) +
      select('sets-required', 'Идеальных сетов подряд для награды', st.setsRequired, [1, 2, 3, 4, 5]) +
      select('reward-minutes', 'Минут игры за одну награду', st.rewardMinutes, [10, 15, 20, 30, 40, 45, 60, 90, 120]) +
      select('daily-limit', 'Наград в день, не больше', st.dailyLimit, [[0, 'без ограничения'], 1, 2, 3, 4, 5]) +
      '<fieldset class="field wide"><legend>Если ребёнок ошибся в испытании</legend>' +
      '<label class="radio"><input type="radio" name="on-mistake" value="restart"' + (st.onMistake === 'restart' ? ' checked' : '') + '><span><b>Сет сразу заканчивается.</b> Видит разбор ошибки и начинает новый сет. Быстрее и честнее.</span></label>' +
      '<label class="radio"><input type="radio" name="on-mistake" value="finish"' + (st.onMistake === 'finish' ? ' checked' : '') + '><span><b>Сет дорешивается до конца,</b> но не засчитывается. Больше практики, но дольше.</span></label>' +
      '</fieldset>' +
      '<label class="check wide"><input type="checkbox" id="sound"' + (st.sound ? ' checked' : '') + '><span>Звуки при ответах</span></label>' +
      '</form>' +
      '<p class="muted small">Изменения сохраняются сразу и попадают на все подключённые устройства.</p>' +
      '<div class="explain"><p><b>Как работает испытание.</b> Каждый сет состоит из примеров по темам из вкладки «Темы» вперемешку. ' +
      'Засчитываются только сеты без единой ошибки, идущие подряд в один день. Любая ошибка, выход из сета или закрытие страницы посреди сета обнуляют серию. ' +
      'После награды ребёнок сам запускает таймер игрового времени. В «Прогрессе» видно, когда он это сделал.</p>' +
      '<p>Практика по отдельным темам на награду не влияет. Ошибки там ничего не стоят, так что там удобно разбирать трудные места.</p></div>';
  }

  bind.challenge = function () {
    const st = app.state.settings;
    const form = $('rules-form');
    form.addEventListener('change', function () {
      st.setSize = Number($('set-size').value);
      st.setsRequired = Number($('sets-required').value);
      st.rewardMinutes = Number($('reward-minutes').value);
      st.dailyLimit = Number($('daily-limit').value);
      const r = form.querySelector('input[name="on-mistake"]:checked');
      st.onMistake = r ? r.value : 'restart';
      st.sound = $('sound').checked;
      ui.touchSettings();
      ui.commit();
      ui.toast('Сохранено');
    });
  };

  /* ----- topics ----- */

  function topicsTab() {
    const asg = app.state.settings.assignment;
    const has = function (t, l) {
      const a = asg.find(function (x) { return x.topic === t; });
      return !!a && a.levels.indexOf(l) !== -1;
    };
    return '<p class="muted">Отметьте, какие темы и уровни входят в испытание за игровое время. Названия уровней на английском, как их видит ребёнок. Вся практика доступна ему всегда.</p>' +
      '<form id="topics-form" class="form" novalidate>' +
      SQ.subjects().map(function (subj) {
        return '<div class="subject-block"><h2>' + esc(subj.title) + '</h2>' + subj.topics.map(function (t) {
          return '<fieldset class="topic-set"><legend>' + esc(t.title) + '</legend>' + t.levels.map(function (l) {
            return '<label class="check"><input type="checkbox" data-topic="' + esc(t.id) + '" data-level="' + l.id + '"' +
              (has(t.id, l.id) ? ' checked' : '') + '><span><b>' + l.id + '. ' + esc(l.title) + '</b><span class="muted"> ' + esc(l.description) + '</span></span></label>';
          }).join('') + '</fieldset>';
        }).join('') + '</div>';
      }).join('') + '</form>' +
      '<div class="explain"><p><b>Совет.</b> Если ребёнку трудно, начните с одного-двух уровней, а новые добавляйте, когда он начнёт стабильно проходить испытание. В «Прогрессе» видно, на каких уровнях он ошибается чаще всего.</p></div>';
  }

  bind.topics = function () {
    const form = $('topics-form');
    form.addEventListener('change', function (e) {
      const boxes = form.querySelectorAll('input[type="checkbox"]');
      const map = {};
      const order = [];
      Array.prototype.forEach.call(boxes, function (b) {
        if (!b.checked) return;
        const t = b.dataset.topic;
        if (!map[t]) { map[t] = []; order.push(t); }
        map[t].push(Number(b.dataset.level));
      });
      if (!order.length) {
        e.target.checked = true;
        ui.toast('Нужна хотя бы одна тема');
        return;
      }
      app.state.settings.assignment = order.map(function (t) { return { topic: t, levels: map[t] }; });
      ui.touchSettings();
      ui.commit();
      ui.toast('Сохранено');
    });
  };

  /* ----- devices ----- */

  function devicesTab(args) {
    const S = SQ.sync;
    if (!S.enabled && !S.family) {
      return '<div class="explain"><p><b>Синхронизация недоступна.</b> Сейчас сайт открыт без сервера, поэтому прогресс хранится только в этом браузере.</p>' +
        '<p>Чтобы телефон и компьютер ребёнка (и ваш телефон) видели общий прогресс, загрузите сайт целиком, вместе с папкой <code>api</code>, на хостинг с PHP. Синхронизация включится сама.</p></div>';
    }
    if (!S.family) {
      return '<section class="p-sec"><h2>Синхронизация выключена на этом устройстве</h2>' +
        '<p class="muted">Включите её здесь, если это первое устройство. Если на другом устройстве уже есть код семьи, введите его ниже.</p>' +
        '<button class="btn primary" data-act="sync-create">Включить синхронизацию</button></section>' +
        '<section class="p-sec"><h2>Подключиться к существующей семье</h2>' +
        '<form id="join2-form" class="form inline" novalidate><label class="field"><span>Код семьи</span>' +
        '<input id="join2-code" class="code-input" maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX"></label>' +
        '<button class="btn" type="submit">Подключить</button></form><p class="form-err" id="join2-err" role="alert"></p>' +
        '<p class="muted small">Данные этого устройства объединятся с данными семьи, ничего не пропадёт.</p></section>';
    }
    const link = joinLink(S.family);
    const status = S.status === 'ok' ? '<span class="pill good">синхронизировано</span>'
      : S.status === 'syncing' ? '<span class="pill plain">синхронизация…</span>'
      : '<span class="pill warn">нет связи, данные отправятся позже</span>';
    return (args.fresh ? '<div class="notice good"><p><b>Готово!</b> Осталось подключить устройства ребёнка: откройте на его телефоне и компьютере ссылку ниже. Сделать это нужно один раз на каждом устройстве.</p>' +
      '<button class="btn primary" data-act="home">Перейти на главную</button></div>' : '') +
      '<section class="p-sec"><h2>Код семьи</h2>' +
      '<p class="family-code" id="family-code">' + esc(S.family) + '</p>' +
      '<p>' + status + '</p>' +
      '<div class="copy-row"><input id="join-link" class="link-input" readonly value="' + esc(link) + '" aria-label="Ссылка для подключения">' +
      '<button class="btn" data-act="copy-link">Скопировать ссылку</button></div>' +
      '<ol class="howto"><li>Откройте эту ссылку на телефоне или компьютере ребёнка, например отправьте её себе в мессенджер.</li>' +
      '<li>Устройство подключится само. Или введите код вручную: «У меня есть код семьи».</li>' +
      '<li>Чтобы видеть прогресс со своего телефона, подключите его так же, а затем откройте «For parents».</li></ol>' +
      '<p class="muted small">Код работает как пароль к прогрессу семьи. Не публикуйте его.</p></section>' +
      '<section class="p-sec"><h2>Отключить это устройство</h2><p class="muted">Данные на этом устройстве останутся, но перестанут синхронизироваться.</p>' +
      '<button class="btn ghost" data-act="sync-leave">Отключить синхронизацию здесь</button></section>';
  }

  bind.devices = function () {
    const f = $('join2-form');
    if (!f) return;
    const inp = $('join2-code');
    inp.addEventListener('input', function () {
      const v = SQ.sync.normaliseCode(inp.value);
      if (v !== inp.value) inp.value = v;
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      const err = $('join2-err');
      err.textContent = 'Проверяю код…';
      SQ.sync.join(inp.value).then(function (remote) {
        // The family's settings (rules, topics, PIN) win over this device's.
        app.state.settings.updatedAt = 0;
        app.state = SQ.storage.merge(app.state, remote);
        ui.commit();
        ui.show('parent', { tab: 'devices' });
        ui.toast('Устройство подключено');
      }).catch(function (ex) {
        err.textContent = ex.message === 'invalid' ? 'Код выглядит так: XXXX-XXXX-XXXX.'
          : ex.message === 'not-found' ? 'Такой код не найден.' : 'Нет связи с сервером.';
      });
    });
  };

  actions['sync-create'] = function () {
    SQ.sync.createFamily();
    ui.commit();
    ui.show('parent', { tab: 'devices', fresh: true });
  };
  actions['sync-leave'] = function () {
    SQ.sync.leave();
    ui.show('parent', { tab: 'devices' });
    ui.toast('Синхронизация на этом устройстве выключена');
  };
  actions['copy-link'] = function () {
    const inp = $('join-link');
    inp.select();
    copy(inp.value, 'Ссылка скопирована');
  };

  /* ----- data ----- */

  function dataTab() {
    const st = app.state.settings;
    return '<section class="p-sec"><h2>Имя ребёнка</h2>' +
      '<form id="name-form" class="form inline" novalidate><label class="field"><span>Имя</span><input id="child-name" maxlength="30" value="' + esc(st.childName) + '"></label>' +
      '<button class="btn" type="submit">Сохранить</button></form></section>' +
      '<section class="p-sec"><h2>Сменить PIN</h2>' +
      '<form id="pin-form" class="form inline" novalidate>' +
      '<label class="field"><span>Новый PIN</span><input id="new-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></label>' +
      '<label class="field"><span>Ещё раз</span><input id="new-pin2" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></label>' +
      '<button class="btn" type="submit">Сменить</button></form><p class="form-err" id="pin-form-err" role="alert"></p></section>' +
      '<section class="p-sec"><h2>Резервная копия</h2>' +
      '<p class="muted">Весь прогресс и настройки в виде текста. Можно сохранить себе и потом восстановить или перенести на другое устройство без синхронизации.</p>' +
      '<div class="btn-row"><button class="btn" data-act="backup-show">Показать копию</button><button class="btn ghost" data-act="backup-copy">Скопировать</button></div>' +
      '<textarea id="backup-out" class="code-area" readonly hidden aria-label="Резервная копия"></textarea>' +
      '<label class="field"><span>Восстановить: вставьте сюда текст копии</span><textarea id="backup-in" class="code-area" spellcheck="false"></textarea></label>' +
      '<button class="btn" data-act="backup-restore">Восстановить из копии</button>' +
      '<p class="muted small">Копия объединяется с текущими данными, ничего не стирается.</p></section>' +
      '<section class="p-sec danger-zone"><h2>Сбросить прогресс</h2>' +
      '<p class="muted">Удаляет историю, награды и серию на всех подключённых устройствах. Настройки, темы и PIN остаются.</p>' +
      '<form id="reset-form" class="form inline" novalidate><label class="field"><span>Чтобы сбросить, напишите СБРОС</span><input id="reset-word" autocomplete="off"></label>' +
      '<button class="btn danger" type="submit">Сбросить прогресс</button></form></section>';
  }

  bind.data = function () {
    $('name-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const v = $('child-name').value.trim();
      if (!v) { ui.toast('Введите имя'); return; }
      app.state.settings.childName = v;
      ui.touchSettings();
      ui.commit();
      ui.toast('Сохранено');
      ui.chrome();
    });
    $('pin-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const a = $('new-pin').value.trim(), b = $('new-pin2').value.trim();
      const err = $('pin-form-err');
      if (!validPin(a)) { err.textContent = 'PIN должен состоять из 4 цифр.'; return; }
      if (a !== b) { err.textContent = 'PIN-коды не совпадают.'; return; }
      app.state.settings.pinHash = SQ.hashPin(a);
      ui.touchSettings();
      ui.commit();
      err.textContent = '';
      $('new-pin').value = ''; $('new-pin2').value = '';
      ui.toast('PIN изменён');
    });
    $('reset-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const w = $('reset-word').value.trim().toUpperCase();
      if (w !== 'СБРОС' && w !== 'RESET') { ui.toast('Напишите слово СБРОС'); return; }
      const s = app.state;
      s.resetAt = Date.now();
      s.history = [];
      s.rewards = [];
      s.progress = { streak: 0, streakDay: '', run: 0, bestRun: 0, updatedAt: Date.now() };
      SQ.storage.setMeta('active', null);
      ui.commit();
      ui.show('parent', { tab: 'progress' });
      ui.toast('Прогресс сброшен');
    });
  };

  actions['backup-show'] = function () {
    const out = $('backup-out');
    out.value = JSON.stringify(app.state);
    out.hidden = false;
    out.select();
  };
  actions['backup-copy'] = function () {
    const out = $('backup-out');
    out.value = JSON.stringify(app.state);
    out.hidden = false;
    out.select();
    copy(out.value, 'Копия скопирована');
  };
  actions['backup-restore'] = function () {
    const txt = $('backup-in').value.trim();
    if (!txt) { ui.toast('Сначала вставьте текст копии'); return; }
    try {
      const incoming = SQ.storage.parseBackup(txt);
      app.state = SQ.storage.merge(app.state, incoming);
      ui.commit();
      ui.show('parent', { tab: 'progress' });
      ui.toast('Копия восстановлена');
    } catch (e) {
      ui.toast('Это не похоже на копию Study Quest');
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
