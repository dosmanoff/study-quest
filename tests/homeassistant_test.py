"""Checks the Home Assistant package that Study Quest generates.

The YAML is parsed and its Jinja templates are rendered with the same helpers
Home Assistant provides (from_json, now(), states(), expand()), against
Firestore responses with and without a running game timer.

    python3 tests/homeassistant_test.py
"""
import datetime as dt
import json
import pathlib
import re
import subprocess

import jinja2
import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
NOW_MS = 1_793_000_000_000  # fixed "now" for every render

# ---- ask the real site code for the package and some summaries ----
NODE = r"""
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = process.argv[1];
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const files = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1])
  .filter((f) => !f.includes('/ui/') && !f.endsWith('main.js'));
const ctx = vm.createContext({ console, Math, Date, JSON }); ctx.globalThis = ctx;
for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
const SQ = ctx.SQ, now = Number(process.argv[2]);
const st = SQ.storage.blank();
const sam = SQ.storage.blankChild('Sam', 'main');
const kid2 = SQ.storage.blankChild('Алёша', 'c2x');
sam.rewards.push({ id: 'r1', ts: now - 9e5, minutes: 30, startedAt: now - 6e5, endsAt: now + 125000, updatedAt: now });
sam.rewards.push({ id: 'r2', ts: now - 8e5, minutes: 20, startedAt: null, endsAt: null, updatedAt: now });
kid2.rewards.push({ id: 'r3', ts: now - 9e6, minutes: 30, startedAt: now - 9e6, endsAt: now - 6e6, updatedAt: now });
st.children.push(sam, kid2);
const url = 'https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents/ha/' + 'a'.repeat(64);
console.log(JSON.stringify({
  yaml: SQ.ha.packageYaml(url, [{ id: 'main', name: 'Sam' }, { id: 'c2x', name: 'Алёша' }]),
  summary: SQ.ha.summary(st, now),
}));
"""
out = json.loads(subprocess.run(["node", "-e", NODE, str(ROOT), str(NOW_MS)],
                                capture_output=True, text=True, check=True).stdout)
pkg = yaml.safe_load(out["yaml"])
summary = json.loads(out["summary"])

# ---- the summary itself ----
assert summary["v"] == 1
assert summary["children"]["main"] == {"name": "Sam", "until": NOW_MS + 125000, "saved": 20}
assert summary["children"]["c2x"]["until"] == 0, "a finished timer is not running"

# ---- package shape ----
assert set(pkg) == {"input_boolean", "rest", "template", "group", "automation"}
assert "study_quest_control" in pkg["input_boolean"]
rest = pkg["rest"][0]
assert rest["resource"].endswith("/ha/" + "a" * 64)
assert rest["scan_interval"] == 30


def slugify(text):
    """Entity id part the way Home Assistant makes it from an ASCII name."""
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


sensors = {"sensor." + slugify(s["name"]): s for s in rest["sensor"]}
binaries = {"binary_sensor." + slugify(b["name"]): b for b in pkg["template"][0]["binary_sensor"]}
assert set(sensors) == {
    "sensor.study_quest_sam_game_minutes_left", "sensor.study_quest_sam_game_minutes_saved",
    "sensor.study_quest_child_2_game_minutes_left", "sensor.study_quest_child_2_game_minutes_saved",
}, sorted(sensors)
assert set(binaries) == {"binary_sensor.study_quest_sam_game_time", "binary_sensor.study_quest_child_2_game_time"}
assert set(pkg["group"]) == {"study_quest_sam_games", "study_quest_child_2_games"}
ids = [a["id"] for a in pkg["automation"]]
assert len(ids) == len(set(ids)) == 4, ids

# every entity the automations use exists in the package
for a in pkg["automation"]:
    for t in a["triggers"]:
        if t["trigger"] == "state" and t["entity_id"].startswith("binary_sensor."):
            assert t["entity_id"] in binaries, t["entity_id"]
    for action in a["actions"]:
        group = action["target"]["entity_id"]
        assert group.startswith("group.") and group[6:] in pkg["group"], group
    assert a["conditions"][0] == {"condition": "state", "entity_id": "input_boolean.study_quest_control", "state": "on"}

# ---- render templates like Home Assistant ----
env = jinja2.Environment(extensions=["jinja2.ext.loopcontrols"])
env.filters["from_json"] = json.loads
NOW = dt.datetime.fromtimestamp(NOW_MS / 1000, tz=dt.timezone.utc)


def render(template, **ctx):
    ctx.setdefault("now", lambda: NOW)
    return env.from_string(template).render(**ctx).strip()


def firestore_doc(game):
    return {"name": "x", "fields": {"game": {"stringValue": json.dumps(game)}, "updated": {"integerValue": "1"}}}


left = sensors["sensor.study_quest_sam_game_minutes_left"]["value_template"]
saved = sensors["sensor.study_quest_sam_game_minutes_saved"]["value_template"]
left2 = sensors["sensor.study_quest_child_2_game_minutes_left"]["value_template"]

doc = firestore_doc(summary)
assert render(left, value_json=doc) == "3", "125 s left rounds up to 3 minutes"
assert render(saved, value_json=doc) == "20"
assert render(left2, value_json=doc) == "0", "finished timer -> 0"

# no summary yet / Firestore 404 / not JSON
not_found = {"error": {"code": 404, "status": "NOT_FOUND"}}
assert render(left, value_json=not_found) == "0"
assert render(left) == "0", "value_json undefined"
assert render(saved, value_json=not_found) == "0"

# the link turned off: no children in the summary
assert render(left, value_json=firestore_doc({"v": 1, "children": {}, "off": True})) == "0"

# a forged time far in the future is ignored (rewards are at most 2 hours)
forged = firestore_doc({"v": 1, "children": {"main": {"name": "Sam", "until": NOW_MS + 10 * 3600 * 1000, "saved": 0}}})
assert render(left, value_json=forged) == "0"

# binary sensor follows the minutes sensor; unavailable counts as off
binary = binaries["binary_sensor.study_quest_sam_game_time"]["state"]
for value, expected in [("3", "True"), ("0", "False"), ("unavailable", "False"), ("unknown", "False")]:
    got = render(binary, states=lambda e, v=value: v if e == "sensor.study_quest_sam_game_minutes_left" else "unknown")
    assert got == expected, (value, got)

# lock automation only acts if some blocking switch is off (avoids pointless calls)
lock = next(a for a in pkg["automation"] if a["id"] == "study_quest_main_lock")
cond = lock["conditions"][2]["value_template"]


class E:
    def __init__(self, state):
        self.state = state


assert render(cond, expand=lambda g: [E("on"), E("off")]) == "True"
assert render(cond, expand=lambda g: [E("on"), E("on")]) == "False"

print("OK: Home Assistant package parses, entity ids line up, and the templates give the right game time "
      "(running, finished, missing, forged, unavailable).")
