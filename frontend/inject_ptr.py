import os, re

def inject_ptr(filepath, refresh_action_call='refetch()'):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return False

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'ScreenRefreshControl' in content: 
        print(f"Already injected: {filepath}")
        return False
    
    # Check if 'useData' is used in the component
    if 'useData' not in content:
        # Check if 'useAuth' is used
        pass
        
    # Insert imports
    import_idx = content.find('import ')
    imports = 'import { ScreenRefreshControl } from "@/components/ui";\nimport { usePullToRefresh } from "@/hooks/usePullToRefresh";\n'
    content = content[:import_idx] + imports + content[import_idx:]
    
    # Find default export function
    match = re.search(r'export default function \w+\([^)]*\)\s*{', content)
    if not match: 
        print(f"No export default function found in {filepath}")
        return False
    
    hook_insert_idx = match.end()
    
    # Find if refetch is imported or destructured
    if 'const { refetch' not in content and 'refetch()' in refresh_action_call:
        if 'const { ' in content and 'useData()' in content:
            # We assume useData is there
            content = re.sub(r'const { ([^}]*) } = useData\(\);', r'const { \1, refetch } = useData();', content)
        
    hook_str = f'\n  const {{ refreshing, onRefresh }} = usePullToRefresh(async () => {{ {refresh_action_call} }});\n'
    content = content[:hook_insert_idx] + hook_str + content[hook_insert_idx:]
    
    # Find the main ScrollView or FlatList
    sv_match = re.search(r'<(ScrollView|FlatList)([^>]*)>', content)
    if not sv_match: 
        print(f"No ScrollView/FlatList found in {filepath}")
        return False
    
    sv_start = sv_match.start()
    sv_end = sv_match.end()
    
    ptr_str = f'\n        refreshControl={{<ScreenRefreshControl refreshing={{refreshing}} onRefresh={{onRefresh}} />}}'
    
    # Inject it before the closing >
    content = content[:sv_end-1] + ptr_str + content[sv_end-1:]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    return True

print('Injecting app/(tabs)/courses.tsx:', inject_ptr('app/(tabs)/courses.tsx', 'if (refetch) await refetch();'))
print('Injecting app/(tabs)/library.tsx:', inject_ptr('app/(tabs)/library.tsx', 'if (refetch) await refetch();'))
print('Injecting app/(tabs)/teachers.tsx:', inject_ptr('app/(tabs)/teachers.tsx', 'if (refetch) await refetch();'))
