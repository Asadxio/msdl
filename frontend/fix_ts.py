import re

# 1. library.tsx
with open('app/(tabs)/library.tsx', 'r', encoding='utf-8') as f: c = f.read()
c = re.sub(r'\s*const \[refreshing, setRefreshing\] = useState\(false\);\n', '\n', c)
with open('app/(tabs)/library.tsx', 'w', encoding='utf-8') as f: f.write(c)

# 2. notifications.tsx
with open('app/(tabs)/notifications.tsx', 'r', encoding='utf-8') as f: c = f.read()
c = c.replace('setRefreshing(true);', '')
c = c.replace('setRefreshing(false);', '')
with open('app/(tabs)/notifications.tsx', 'w', encoding='utf-8') as f: f.write(c)

# 3, 4. live-class/index.tsx
with open('app/live-class/index.tsx', 'r', encoding='utf-8') as f: c = f.read()
c = re.sub(r'  ActivityIndicator,\n  ActivityIndicator,\n', '  ActivityIndicator,\n', c)
c = re.sub(r'  const \[loading, setLoading\] = useState\(true\);\n  const \[loading, setLoading\] = useState\(true\);\n', '  const [loading, setLoading] = useState(true);\n', c)
with open('app/live-class/index.tsx', 'w', encoding='utf-8') as f: f.write(c)

# 5. prayer-times.tsx
with open('app/prayer-times.tsx', 'r', encoding='utf-8') as f: c = f.read()
c = c.replace('import { ScreenRefreshControl } from "@/components/ui";\nimport { usePullToRefresh } from "@/hooks/usePullToRefresh";\n', '', 1)
with open('app/prayer-times.tsx', 'w', encoding='utf-8') as f: f.write(c)

# 6. ScreenRefreshControl.tsx
with open('components/ui/ScreenRefreshControl.tsx', 'r', encoding='utf-8') as f: c = f.read()
c = c.replace('COLORS.gold', 'COLORS.goldBg')
c = c.replace('COLORS.ivory', 'COLORS.background')
with open('components/ui/ScreenRefreshControl.tsx', 'w', encoding='utf-8') as f: f.write(c)
