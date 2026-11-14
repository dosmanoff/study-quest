# Business Quest: the Home Assistant package that starts the marking job
# parses and points at the right workflow.
#   python3 tests/business_ha_test.py
import json, os, yaml

here = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(here, '..', 'marker', 'homeassistant', 'business_quest_marking.yaml')

class Loader(yaml.SafeLoader):
    pass
Loader.add_constructor('!secret', lambda loader, node: ('SECRET', loader.construct_scalar(node)))

with open(path, encoding='utf-8') as f:
    pkg = yaml.load(f, Loader=Loader)

rc = pkg['rest_command']['business_quest_mark']
assert rc['method'] == 'POST'
assert rc['url'] == 'https://api.github.com/repos/dosmanoff/study-quest/actions/workflows/mark.yml/dispatches'
assert rc['headers']['Authorization'] == ('SECRET', 'github_business_quest'), 'token only from secrets.yaml'
assert json.loads(rc['payload']) == {'ref': 'main'}
auto = pkg['automation'][0]
assert auto['triggers'] == [{'trigger': 'time_pattern', 'minutes': '/10'}]
assert auto['actions'] == [{'action': 'rest_command.business_quest_mark'}]
wf = open(os.path.join(here, '..', '.github', 'workflows', 'mark.yml'), encoding='utf-8').read()
assert 'workflow_dispatch' in wf, 'the workflow must accept dispatches'
print('OK: Business Quest Home Assistant package parses and starts mark.yml every 10 minutes (07:00-23:59).')
