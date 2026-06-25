import re, os

def inject_safe(filepath, refresh_action):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
    with open(filepath, 'r', encoding='utf-8') as f: content = f.read()
    if 'usePullToRefresh' in content: 
        print(f"Already injected: {filepath}")
        return
    
    # Add imports
    imp = 'import { ScreenRefreshControl } from "@/components/ui";\nimport { usePullToRefresh } from "@/hooks/usePullToRefresh";\n'
    idx = content.find('import ')
    content = content[:idx] + imp + content[idx:]
    
    # Inject hook right before 'return ('
    hook = f'\n  const {{ refreshing, onRefresh }} = usePullToRefresh(async () => {{\n    {refresh_action}\n  }});\n'
    
    matches = list(re.finditer(r'  return\s*\(', content))
    if not matches:
        print(f"No return found in {filepath}")
        return
    
    ret_idx = matches[-1].start()
    content = content[:ret_idx] + hook + content[ret_idx:]
    
    sv_match = re.search(r'<(ScrollView|FlatList)([^>]*)>', content[ret_idx:])
    if sv_match:
        abs_pos = ret_idx + sv_match.end()
        content = content[:abs_pos-1] + '\n        refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}' + content[abs_pos-1:]
    else:
        print(f"No scrollable container found in {filepath} after return.")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

inject_safe('app/qibla.tsx', 'await refreshLocation();')
inject_safe('app/prayer-times.tsx', 'await handleAutoDetect();')
