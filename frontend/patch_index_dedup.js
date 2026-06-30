const fs = require('fs');
const f = 'app/(tabs)/index.tsx';
let content = fs.readFileSync(f, 'utf8');

// Replace active live class onSnapshot
content = content.replace(
  `const unsub = onSnapshot(q, (snapshot) => {`,
  `const unsub = subscribeDeduped(stableQueryKey(["active_live_class_home"]), q as any, (snapshot) => {`
);

// Replace recent notifications onSnapshot
content = content.replace(
  `const unsub = onSnapshot(q, (snap) => {
      const items: any[] = [];
      snap.forEach((d) => {`,
  `const unsub = subscribeDeduped(stableQueryKey(["recent_notifications", profile?.uid]), q as any, (snap) => {
      const items: any[] = [];
      snap.forEach((d) => {`
);

fs.writeFileSync(f, content);
console.log('index.tsx deduplication patched');
