import re

with open('frontend/app/chat/[id].tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add replyTarget state and targetPresence state
content = content.replace(
    "const [reportTarget, setReportTarget] = useState<MessageItem | null>(null);",
    "const [reportTarget, setReportTarget] = useState<MessageItem | null>(null);\n  const [replyTarget, setReplyTarget] = useState<MessageItem | null>(null);\n  const [targetPresence, setTargetPresence] = useState<{ is_online: boolean; last_seen?: any } | null>(null);"
)

# 2. Add reply_to and reply_snippet to MessageItem
content = content.replace(
    "media_name?: string;",
    "media_name?: string;\n  reply_to?: string;\n  reply_snippet?: string;"
)

# 3. Add presence listener
effect_idx = content.find("useEffect(() => {")
presence_listener = """
  const targetId = chat?.type === 'direct' ? chatParticipants.find((p) => p !== user?.uid) : undefined;
  useEffect(() => {
    if (!targetId) return;
    const unsub = onSnapshot(doc(db, 'presence', targetId), (snap) => {
      if (snap.exists()) setTargetPresence(snap.data() as any);
    });
    return () => unsub();
  }, [targetId]);

"""
content = content[:effect_idx] + presence_listener + content[effect_idx:]

# 4. Modify send function
reply_fields = """
      ...(replyTarget ? { reply_to: replyTarget.id, reply_snippet: replyTarget.text } : {}),"""
content = content.replace(
    "localOnly: true,\n    };",
    f"localOnly: true,{reply_fields}\n    }};"
)

content = content.replace(
    "media_size: 0,\n      });",
    f"media_size: 0,{reply_fields}\n      }};"
)

content = content.replace(
    "last_message: msg,\n        updated_at: serverTimestamp(),",
    "last_message: msg,\n        last_sender_id: user.uid,\n        updated_at: serverTimestamp(),"
)

content = content.replace(
    "setMessages((prev) => [optimisticMessage, ...prev]);\n    setText('');",
    "setMessages((prev) => [optimisticMessage, ...prev]);\n    setText('');\n    setReplyTarget(null);"
)

# 5. Modify openMessageActions
content = content.replace(
    "{ text: 'Cancel', style: 'cancel' },",
    "{ text: 'Cancel', style: 'cancel' },\n      { text: 'Reply', onPress: () => setReplyTarget(item) },"
)

# 6. Render Reply Banner
reply_banner = """
      {replyTarget && (
        <View style={styles.replyBanner}>
          <Text style={styles.replyBannerText} numberOfLines={1}>Replying to: {replyTarget.text}</Text>
          <TouchableOpacity onPress={() => setReplyTarget(null)}>
            <Ionicons name="close" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      )}
      <View style={[styles.inputRow"""

content = content.replace("      <View style={[styles.inputRow", reply_banner)

# 7. Render Reply snippet in bubble
bubble_idx = content.find("<Text style={[styles.messageText")
reply_snippet = """
        {item.reply_snippet ? (
          <View style={styles.bubbleReply}>
            <Text style={styles.bubbleReplyText} numberOfLines={1}>↩ {item.reply_snippet}</Text>
          </View>
        ) : null}
"""
content = content[:bubble_idx] + reply_snippet + content[bubble_idx:]

# 8. Render Presence Header
header_idx = content.find("<Text style={styles.topTitle}>{title}</Text>")
presence_header = """
          <Text style={styles.topTitle}>{title}</Text>
          {targetPresence && (
            <Text style={styles.presenceText}>
              {targetPresence.is_online ? '● Online' : (targetPresence.last_seen ? 'Offline' : '')}
            </Text>
          )}
"""
content = content.replace("<Text style={styles.topTitle}>{title}</Text>", presence_header)

with open('frontend/app/chat/[id].tsx', 'w', encoding='utf-8') as f:
    f.write(content)
