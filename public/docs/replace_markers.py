import re, json
file_path = r'c:\Users\user\workspace\stn-uiux\arcVRack\public\docs\arcVRack_ui_design_spec.html'
json_path = r'c:\Users\user\workspace\stn-uiux\arcVRack\public\docs\markers.json'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

with open(json_path, 'r', encoding='utf-8') as f:
    markers_json_str = f.read().strip()

# Find the exact line: saved = JSON.stringify({ ... });
pattern = r'saved = JSON\.stringify\(\{.*?\}\);'
replacement = f'saved = JSON.stringify({markers_json_str});'

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Replacement successful.')
