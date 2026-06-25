with open('app/chat/[id].tsx', 'r', encoding='utf-8') as f: c = f.read()
c = c.replace('/ refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>', 'refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}\n      />')
with open('app/chat/[id].tsx', 'w', encoding='utf-8') as f: f.write(c)

with open('app/course/[id].tsx', 'r', encoding='utf-8') as f: c = f.read()
if 'import { ScreenRefreshControl' not in c:
    c = c.replace('import React,', "import { ScreenRefreshControl } from '@/components/ui';\nimport { usePullToRefresh } from '@/hooks/usePullToRefresh';\nimport React,")
    c = c.replace('<ScrollView\n            showsVerticalScrollIndicator={false}', '  const { refreshing, onRefresh } = usePullToRefresh(async () => { await new Promise(r => setTimeout(r, 500)); });\n\n          <ScrollView\n            refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}\n            showsVerticalScrollIndicator={false}')
with open('app/course/[id].tsx', 'w', encoding='utf-8') as f: f.write(c)

with open('app/admin/send-push.tsx', 'r', encoding='utf-8') as f: c = f.read()
if 'import { ScreenRefreshControl' not in c:
    c = c.replace('import React,', "import { ScreenRefreshControl } from '@/components/ui';\nimport { usePullToRefresh } from '@/hooks/usePullToRefresh';\nimport React,")
    c = c.replace('<ScrollView\n        style={styles.formContainer}', '  const { refreshing, onRefresh } = usePullToRefresh(async () => { await new Promise(r => setTimeout(r, 500)); });\n\n      <ScrollView\n        refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}\n        style={styles.formContainer}')
with open('app/admin/send-push.tsx', 'w', encoding='utf-8') as f: f.write(c)
