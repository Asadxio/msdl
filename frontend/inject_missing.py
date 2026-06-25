import re

def inject_delay(filepath):
    with open(filepath, 'r', encoding='utf-8') as f: content = f.read()
    if 'usePullToRefresh' in content: return
    
    # 1. Imports
    imp = "import { ScreenRefreshControl } from '@/components/ui';\nimport { usePullToRefresh } from '@/hooks/usePullToRefresh';\n"
    idx = content.find('import ')
    content = content[:idx] + imp + content[idx:]
    
    # 2. Hook
    hook = '\n  const { refreshing, onRefresh } = usePullToRefresh(async () => {\n    await new Promise(r => setTimeout(r, 500));\n  });\n'
    matches = list(re.finditer(r'  return\s*\(', content))
    if not matches:
        print("No return match in", filepath)
        return
    ret_idx = matches[-1].start()
    content = content[:ret_idx] + hook + content[ret_idx:]
    
    # 3. Prop
    sv_match = re.search(r'<(ScrollView|FlatList)([^>]*)>', content[ret_idx:])
    if sv_match:
        abs_pos = ret_idx + sv_match.end()
        content = content[:abs_pos-1] + ' refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}' + content[abs_pos-1:]
    else:
        print("No scroll view in", filepath)
    
    with open(filepath, 'w', encoding='utf-8') as f: f.write(content)

for f in ['app/course/[id].tsx', 'app/chat/[id].tsx', 'app/more/index.tsx', 'app/admin/send-push.tsx']:
    inject_delay(f)
