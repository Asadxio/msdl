import re

with open('frontend/app/chat/[id].tsx', 'r', encoding='utf-8') as f:
    content = f.read()

styles = """
  presenceText: {
    fontSize: 12,
    color: '#059669', // Emerald
    fontWeight: '500',
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    marginHorizontal: 16,
    marginBottom: -8, // tuck under inputRow
    zIndex: -1,
  },
  replyBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#4B5563',
    marginRight: 8,
  },
  bubbleReply: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 6,
    borderRadius: 8,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  bubbleReplyText: {
    fontSize: 12,
    color: '#4B5563',
  },
});
"""

# Replace the last "});" with our styles
if "});" in content:
    # Find the very last occurrence of "});"
    rindex = content.rfind("});")
    content = content[:rindex] + styles + content[rindex + 3:]
    
with open('frontend/app/chat/[id].tsx', 'w', encoding='utf-8') as f:
    f.write(content)
