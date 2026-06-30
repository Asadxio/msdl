import os, re

storage_methods = ['getStorage', 'uploadBytes', 'uploadBytesResumable', 'getDownloadURL', 'deleteObject', 'listAll']
storage_import_regex = re.compile(r'from\s+[\'\"]+firebase/storage[\'\"]+')

found_usages = []

for root, dirs, files in os.walk('frontend'):
    if 'node_modules' in root or '.expo' in root:
        continue
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx')):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                    matches = []
                    if storage_import_regex.search(content):
                        matches.append('imported firebase/storage')
                    
                    for method in storage_methods:
                        if re.search(r'\b' + method + r'\b', content):
                            matches.append(method)
                            
                    if matches:
                        found_usages.append((path, matches))
            except Exception:
                pass

print('--- PRECISE STORAGE USAGE ---')
for path, matches in sorted(found_usages):
    print(f'{path}: {", ".join(matches)}')
print('---------------------------')
