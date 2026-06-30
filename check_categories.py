import os

search_terms = ["'course'", '"course"', "'recording'", '"recording"']
found = []

for root, dirs, files in os.walk('frontend'):
    if 'node_modules' in root or '.expo' in root:
        continue
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx')):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    for i, line in enumerate(lines):
                        for term in search_terms:
                            if term in line:
                                found.append(f'{path}:{i+1}: {line.strip()}')
            except Exception:
                pass

for line in found:
    if 'mediaPipeline' not in line and 'storage' not in line and 'mediaOptimization' not in line:
        print(line)
