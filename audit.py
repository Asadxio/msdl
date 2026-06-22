import os
import re

FRONTEND_APP_DIR = r"C:\Users\xioas\.gemini\antigravity\scratch\msdl\frontend\app"
FRONTEND_LIB_DIR = r"C:\Users\xioas\.gemini\antigravity\scratch\msdl\frontend\lib"
FRONTEND_COMP_DIR = r"C:\Users\xioas\.gemini\antigravity\scratch\msdl\frontend\components"
FIRESTORE_RULES = r"C:\Users\xioas\.gemini\antigravity\scratch\msdl\firestore.rules"
STORAGE_RULES = r"C:\Users\xioas\.gemini\antigravity\scratch\msdl\storage.rules"

def get_all_ts_files():
    files = []
    for d in [FRONTEND_APP_DIR, FRONTEND_LIB_DIR, FRONTEND_COMP_DIR]:
        for root, _, fnames in os.walk(d):
            for f in fnames:
                if f.endswith(('.ts', '.tsx')):
                    files.append(os.path.join(root, f))
    return files

def find_empty_handlers(files):
    results = []
    pattern = re.compile(r'onPress=\{?\s*\(\)\s*=>\s*(?:\{\s*\}|console\.log[^}]*|Alert\.alert\([\'"]Coming soon.*?)[\}\n]', re.IGNORECASE | re.DOTALL)
    for f in files:
        try:
            content = open(f, 'r', encoding='utf-8').read()
            for m in pattern.finditer(content):
                lines = content[:m.start()].count('\n') + 1
                results.append(f"{os.path.relpath(f, FRONTEND_APP_DIR)}:{lines} - Empty/Stub onPress handler")
        except: pass
    return results

def get_firestore_rules():
    with open(FIRESTORE_RULES, 'r', encoding='utf-8') as f:
        content = f.read()
    # match /collection/{doc}
    matches = re.findall(r'match\s+/([a-zA-Z0-9_]+)', content)
    return set(matches)

def get_storage_rules():
    if not os.path.exists(STORAGE_RULES): return set()
    with open(STORAGE_RULES, 'r', encoding='utf-8') as f:
        content = f.read()
    matches = re.findall(r'match\s+/([a-zA-Z0-9_]+)', content)
    return set(matches)

def find_missing_collections(files, rules):
    results = []
    pattern = re.compile(r'(?:collection|doc|collectionGroup)\(\s*(?:db|getFirestore\(\)),\s*[\'"]([a-zA-Z0-9_]+)[\'"]')
    for f in files:
        try:
            content = open(f, 'r', encoding='utf-8').read()
            for m in pattern.finditer(content):
                col = m.group(1)
                if col not in rules and col not in ['app_settings', 'users', 'teachers', 'courses', 'live_classes', 'quiz_results', 'quizzes', 'lessons', 'assignments', 'lesson_progress', 'attendance_events', 'attendance', 'notifications', 'payments', 'public_profiles', 'mail', 'analytics', 'moderation']:
                    results.append(f"{os.path.relpath(f, FRONTEND_APP_DIR)} - Unrecognized collection: {col}")
        except: pass
    return list(set(results))

def find_missing_storage(files, storage_rules):
    results = []
    pattern = re.compile(r'ref\(\s*storage,\s*[\'"]([a-zA-Z0-9_]+)')
    for f in files:
        try:
            content = open(f, 'r', encoding='utf-8').read()
            for m in pattern.finditer(content):
                col = m.group(1)
                if col not in storage_rules:
                    results.append(f"{os.path.relpath(f, FRONTEND_APP_DIR)} - Missing storage path: {col}")
        except: pass
    return list(set(results))

def find_dead_routes(files):
    results = []
    # simple match for push/replace
    pattern = re.compile(r'(?:router\.push|router\.replace|goBackOrReplace)\([^[\'"]*[\'"](/[^?\'"]+)[\'"]')
    existing_paths = [os.path.relpath(f, FRONTEND_APP_DIR).replace('\\', '/') for f in files if f.startswith(FRONTEND_APP_DIR)]
    
    for f in files:
        try:
            content = open(f, 'r', encoding='utf-8').read()
            for m in pattern.finditer(content):
                route = m.group(1)
                # check if route maps to file
                route_file = route.strip('/') + '.tsx'
                route_index = route.strip('/') + '/index.tsx'
                # check dynamic
                dynamic_file = re.sub(r'/[^/]+$', '/[id].tsx', route.strip('/'))
                
                # very rough check
                found = False
                for ep in existing_paths:
                    if ep == route_file or ep == route_index or ep == dynamic_file or '(tabs)' in ep and ep.replace('(tabs)/', '') == route_file:
                        found = True
                        break
                if not found and not route.startswith('http'):
                    results.append(f"{os.path.relpath(f, FRONTEND_APP_DIR)} - Dead route: {route}")
        except: pass
    return list(set(results))

def main():
    files = get_all_ts_files()
    fs_rules = get_firestore_rules()
    st_rules = get_storage_rules()
    
    empty_handlers = find_empty_handlers(files)
    missing_cols = find_missing_collections(files, fs_rules)
    missing_storage = find_missing_storage(files, st_rules)
    dead_routes = find_dead_routes(files)
    
    print("=== EMPTY HANDLERS ===")
    for r in empty_handlers: print(r)
    
    print("\n=== MISSING FIRESTORE COLLECTIONS ===")
    for r in missing_cols: print(r)
    
    print("\n=== MISSING STORAGE PATHS ===")
    for r in missing_storage: print(r)
        
    print("\n=== POTENTIAL DEAD ROUTES ===")
    for r in dead_routes: print(r)

if __name__ == '__main__':
    main()
