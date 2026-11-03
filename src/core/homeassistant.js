/*
 * Study Quest — link to Home Assistant.
 *
 * When a parent turns it on, every device that saves the family's progress
 * also writes a tiny summary to Firestore (collection "ha", same document id
 * as the family). Home Assistant reads only that summary, so polling every
 * 30 seconds stays far inside the free Firebase quota.
 *
 * Summary (a JSON string in the "game" field):
 *   { "v": 1, "children": { "<childId>": { "name": "Sam", "until": <ms>, "saved": <min> } } }
 *   until = when the running game timer ends (0 = no timer running)
 *   saved = minutes of game time earned but not started yet
 *
 * packageYaml() builds a ready Home Assistant package: sensors, a binary
 * sensor per child, a group of Family Safety switches to block, and the
 * automations that unblock games only while game time is running.
 */
(function (root) {
  'use strict';
  const SQ = root.SQ;

  /** ASCII slug for entity ids, the way Home Assistant would make one. */
  function slug(text) {
    return String(text || '').toLowerCase()
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function summary(state, now) {
    now = now || Date.now();
    const children = {};
    SQ.family.children(state).forEach(function (c) {
      let until = 0, saved = 0;
      c.rewards.forEach(function (r) {
        if (r.startedAt && r.endsAt > now) until = Math.max(until, r.endsAt);
        if (!r.startedAt) saved += r.minutes || 0;
      });
      children[c.id] = { name: c.settings.childName || '', until: until, saved: saved };
    });
    return JSON.stringify({ v: 1, children: children });
  }

  /** Give every child a unique, readable slug ("sam", "alex", "child_2"...). */
  function slugs(kids) {
    const used = {};
    return kids.map(function (k, i) {
      let s = slug(k.name) || 'child_' + (i + 1);
      let n = s, j = 2;
      while (used[n]) n = s + '_' + j++;
      used[n] = true;
      return n;
    });
  }

  function packageYaml(url, kids) {
    const names = slugs(kids);
    const q = function (s) { return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; };
    const out = [];
    const push = function () { for (let i = 0; i < arguments.length; i++) out.push(arguments[i]); };

    push(
      '# Study Quest -> Home Assistant',
      '# Made in Study Quest: For parents -> Devices -> Home Assistant.',
      '#',
      '# Home Assistant reads the family\'s game-time summary every 30 seconds.',
      '# While a child\'s game timer runs, their games are unblocked; the rest',
      '# of the time they stay blocked. If the summary can\'t be read (no',
      '# internet), games stay blocked.',
      '#',
      '# Setup:',
      '#  1. Save this file as /config/packages/study_quest.yaml and make sure',
      '#     configuration.yaml contains:',
      '#       homeassistant:',
      '#         packages: !include_dir_named packages',
      '#  2. In each "group" below, replace the CHANGE_ME lines with your',
      '#     Microsoft Family Safety switches (Developer tools -> States, search',
      '#     "_lock" and "_app_"). For these switches ON means blocked.',
      '#  3. Developer tools -> YAML -> Check configuration, then restart.',
      '#  4. Turn on "Study Quest controls games" (input_boolean.study_quest_control).',
      '',
      'input_boolean:',
      '  study_quest_control:',
      '    name: "Study Quest controls games"',
      '    icon: mdi:school',
      '',
      'rest:',
      '  - resource: ' + q(url),
      '    scan_interval: 30',
      '    timeout: 15',
      '    sensor:'
    );
    const gameOf = function (id) {
      return '(value_json.fields.game.stringValue | from_json).children.get(' + q(id).replace(/"/g, "'") + ')';
    };
    const guard = 'value_json is defined and value_json.fields is defined and value_json.fields.game is defined';
    kids.forEach(function (k, i) {
      const s = names[i];
      push(
        '      - name: "Study Quest ' + s + ' game minutes left"',
        '        unique_id: study_quest_' + slug(k.id) + '_minutes_left',
        '        icon: mdi:timer-sand',
        '        unit_of_measurement: min',
        '        value_template: >-',
        '          {%- set ns = namespace(left=0) -%}',
        '          {%- if ' + guard + ' -%}',
        '          {%- set c = ' + gameOf(k.id) + ' -%}',
        '          {%- set now_ms = (now().timestamp() * 1000) | int -%}',
        '          {%- if c and c.until > now_ms and c.until < now_ms + 4 * 3600 * 1000 -%}',
        '          {%- set ns.left = ((c.until - now_ms) / 60000) | round(0, \'ceil\') | int -%}',
        '          {%- endif -%}',
        '          {%- endif -%}',
        '          {{ ns.left }}',
        '      - name: "Study Quest ' + s + ' game minutes saved"',
        '        unique_id: study_quest_' + slug(k.id) + '_minutes_saved',
        '        icon: mdi:piggy-bank-outline',
        '        unit_of_measurement: min',
        '        value_template: >-',
        '          {%- set ns = namespace(v=0) -%}',
        '          {%- if ' + guard + ' -%}',
        '          {%- set c = ' + gameOf(k.id) + ' -%}',
        '          {%- if c -%}{%- set ns.v = c.saved | int(0) -%}{%- endif -%}',
        '          {%- endif -%}',
        '          {{ ns.v }}'
      );
    });

    push('', 'template:', '  - binary_sensor:');
    kids.forEach(function (k, i) {
      const s = names[i];
      push(
        '      - name: "Study Quest ' + s + ' game time"',
        '        unique_id: study_quest_' + slug(k.id) + '_game_time',
        '        icon: mdi:controller',
        '        state: "{{ states(\'sensor.study_quest_' + s + '_game_minutes_left\') | int(0) > 0 }}"'
      );
    });

    push('', 'group:');
    kids.forEach(function (k, i) {
      const s = names[i];
      push(
        '  study_quest_' + s + '_games:',
        '    name: ' + q('Study Quest: games to block for ' + (k.name || s)),
        '    entities:',
        '      # Xbox (ON = locked). Needs Xbox ticked in the Family Safety integration.',
        '      - switch.CHANGE_ME_xbox_lock',
        '      # Windows games (ON = blocked), one line per game:',
        '      - switch.CHANGE_ME_app_minecraft',
        '      # Phone or tablet, if the integration shows a lock for it:',
        '      # - switch.CHANGE_ME_mobile_lock'
      );
    });

    push('', 'automation:');
    kids.forEach(function (k, i) {
      const s = names[i], who = k.name || s;
      const bin = 'binary_sensor.study_quest_' + s + '_game_time';
      const grp = 'group.study_quest_' + s + '_games';
      push(
        '  - id: study_quest_' + slug(k.id) + '_unlock',
        '    alias: ' + q('Study Quest: unlock games for ' + who),
        '    description: ' + q(who + ' started game time in Study Quest.'),
        '    triggers:',
        '      - trigger: state',
        '        entity_id: ' + bin,
        '        to: "on"',
        '    conditions:',
        '      - condition: state',
        '        entity_id: input_boolean.study_quest_control',
        '        state: "on"',
        '    actions:',
        '      - action: homeassistant.turn_off',
        '        target:',
        '          entity_id: ' + grp,
        '      # Optional: tell a parent\'s phone.',
        '      # - action: notify.mobile_app_YOUR_PHONE',
        '      #   data:',
        '      #     message: ' + q(who + ' started game time'),
        '  - id: study_quest_' + slug(k.id) + '_lock',
        '    alias: ' + q('Study Quest: lock games for ' + who),
        '    description: "Game time is over. Also re-checked every 10 minutes and after a restart."',
        '    triggers:',
        '      - trigger: state',
        '        entity_id: ' + bin,
        '        to: "off"',
        '      - trigger: state',
        '        entity_id: input_boolean.study_quest_control',
        '        to: "on"',
        '      - trigger: homeassistant',
        '        event: start',
        '      - trigger: time_pattern',
        '        minutes: "/10"',
        '    conditions:',
        '      - condition: state',
        '        entity_id: input_boolean.study_quest_control',
        '        state: "on"',
        '      - condition: state',
        '        entity_id: ' + bin,
        '        state: "off"',
        '      - condition: template',
        '        value_template: "{{ expand(\'' + grp + '\') | selectattr(\'state\', \'eq\', \'off\') | list | count > 0 }}"',
        '    actions:',
        '      - action: homeassistant.turn_on',
        '        target:',
        '          entity_id: ' + grp
      );
    });
    return out.join('\n') + '\n';
  }

  SQ.ha = { slug: slug, summary: summary, packageYaml: packageYaml };
})(typeof window !== 'undefined' ? window : globalThis);
