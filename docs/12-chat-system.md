# Chat System Documentation

## Data model
- `chats`: direct, group, and broadcast chat metadata.
- `messages`: top-level message records linked by `chat_id`.
- `chat_messages`: backward-compatible alias for builds using that collection name.
- `message_reports`: moderation reports for abusive messages.

## Chat permissions
- Direct chats require exactly two participants and creator membership.
- Group/broadcast creation is admin-only.
- Broadcast chats are readable by approved users; direct/group chats are readable by participants.
- Participants can update last message, typing, unread, pin/hide/mute, and block metadata within rule constraints.
- Messages support text and media, read receipts, delivery/seen states, delete-for-me, and sender unsend.

## Reliability features
- Client IDs and push dedupe IDs prevent duplicate sends.
- Read/delivery/seen state is represented on message documents.
- Reports route to moderator/admin workflows.
