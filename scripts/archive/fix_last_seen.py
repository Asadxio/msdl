with open('frontend/app/chat/[id].tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

format_fn = """
function formatLastSeen(timestamp: any) {
  if (!timestamp) return 'Offline';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 2) return 'Just now';
  
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  if (isToday) {
    return 'Last seen today at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) {
    return 'Last seen yesterday at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  return 'Last seen ' + date.toLocaleDateString();
}
"""

for i, line in enumerate(lines):
    if 'export default function ChatDetailScreen' in line:
        lines.insert(i, format_fn)
        break

# Find and replace the presence rendering
for i, line in enumerate(lines):
    if '{targetPresence.is_online ?' in line:
        lines[i] = "              {targetPresence.is_online ? '● Online' : formatLastSeen(targetPresence.last_seen)}\\n"
        break

with open('frontend/app/chat/[id].tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
