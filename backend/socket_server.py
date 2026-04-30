"""
Socket.io Call Signaling Server
Handles real-time call signaling between users
"""

import socketio
import logging
from datetime import datetime
from typing import Dict, Optional, Any

logger = logging.getLogger(__name__)

# Create Socket.IO server with CORS
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False,
)

# User presence tracking: user_id -> set of socket_ids
online_users: Dict[str, set] = {}

# Active calls tracking: call_id -> call_data
active_calls: Dict[str, Dict[str, Any]] = {}

# Socket to user mapping: sid -> user_id
socket_to_user: Dict[str, str] = {}


def get_user_sockets(user_id: str) -> set:
    """Get all socket IDs for a user"""
    return online_users.get(user_id, set())


def is_user_online(user_id: str) -> bool:
    """Check if user has any active connections"""
    return bool(online_users.get(user_id))


@sio.event
async def connect(sid, environ, auth):
    """Handle new socket connection"""
    logger.info(f"[Socket] Client connected: {sid}")
    # Auth will be handled in register event
    return True


@sio.event
async def disconnect(sid):
    """Handle socket disconnection"""
    user_id = socket_to_user.get(sid)
    if user_id:
        # Remove socket from user's connections
        if user_id in online_users:
            online_users[user_id].discard(sid)
            if not online_users[user_id]:
                del online_users[user_id]
                # Notify others that user went offline
                await sio.emit('user:offline', {'user_id': user_id})
                logger.info(f"[Socket] User offline: {user_id}")
        
        del socket_to_user[sid]
        
        # End any active calls for this user
        calls_to_end = [
            call_id for call_id, call in active_calls.items()
            if call.get('caller_id') == user_id or call.get('receiver_id') == user_id
        ]
        for call_id in calls_to_end:
            await handle_call_end_internal(call_id, user_id, 'disconnected')
    
    logger.info(f"[Socket] Client disconnected: {sid}")


@sio.event
async def register(sid, data):
    """Register user with their socket connection"""
    user_id = data.get('user_id')
    user_name = data.get('user_name', 'Unknown')
    
    if not user_id:
        await sio.emit('error', {'message': 'user_id required'}, room=sid)
        return
    
    # Map socket to user
    socket_to_user[sid] = user_id
    
    # Add socket to user's connections
    if user_id not in online_users:
        online_users[user_id] = set()
        # Notify others that user came online
        await sio.emit('user:online', {'user_id': user_id, 'user_name': user_name})
        logger.info(f"[Socket] User online: {user_id} ({user_name})")
    
    online_users[user_id].add(sid)
    
    # Send confirmation with online users list
    online_list = list(online_users.keys())
    await sio.emit('registered', {
        'user_id': user_id,
        'online_users': online_list,
    }, room=sid)
    
    logger.info(f"[Socket] User registered: {user_id} -> {sid}")


@sio.event
async def call_initiate(sid, data):
    """
    Initiate a call to another user
    data: {
        call_id: string,
        receiver_id: string,
        receiver_name: string,
        caller_id: string,
        caller_name: string,
        call_type: 'voice' | 'video',
        channel_name: string,
    }
    """
    caller_id = socket_to_user.get(sid)
    if not caller_id:
        await sio.emit('call:error', {'message': 'Not registered'}, room=sid)
        return
    
    call_id = data.get('call_id')
    receiver_id = data.get('receiver_id')
    call_type = data.get('call_type', 'voice')
    channel_name = data.get('channel_name')
    caller_name = data.get('caller_name', 'Unknown')
    receiver_name = data.get('receiver_name', 'Unknown')
    
    if not all([call_id, receiver_id, channel_name]):
        await sio.emit('call:error', {'message': 'Missing required fields'}, room=sid)
        return
    
    # Check if receiver is online
    if not is_user_online(receiver_id):
        await sio.emit('call:unavailable', {
            'call_id': call_id,
            'reason': 'User is offline',
        }, room=sid)
        return
    
    # Check if receiver is already in a call
    for existing_call in active_calls.values():
        if existing_call.get('receiver_id') == receiver_id or existing_call.get('caller_id') == receiver_id:
            if existing_call.get('status') in ['ringing', 'connected']:
                await sio.emit('call:unavailable', {
                    'call_id': call_id,
                    'reason': 'User is busy',
                }, room=sid)
                return
    
    # Store call data
    call_data = {
        'call_id': call_id,
        'caller_id': caller_id,
        'caller_name': caller_name,
        'receiver_id': receiver_id,
        'receiver_name': receiver_name,
        'call_type': call_type,
        'channel_name': channel_name,
        'status': 'ringing',
        'started_at': datetime.utcnow().isoformat(),
    }
    active_calls[call_id] = call_data
    
    # Send incoming call to receiver's sockets
    receiver_sockets = get_user_sockets(receiver_id)
    for receiver_sid in receiver_sockets:
        await sio.emit('call:incoming', {
            'call_id': call_id,
            'caller_id': caller_id,
            'caller_name': caller_name,
            'call_type': call_type,
            'channel_name': channel_name,
        }, room=receiver_sid)
    
    # Confirm to caller
    await sio.emit('call:ringing', {
        'call_id': call_id,
        'receiver_id': receiver_id,
    }, room=sid)
    
    logger.info(f"[Socket] Call initiated: {call_id} from {caller_id} to {receiver_id}")


@sio.event
async def call_accept(sid, data):
    """
    Accept an incoming call
    data: { call_id: string }
    """
    user_id = socket_to_user.get(sid)
    call_id = data.get('call_id')
    
    if not call_id or call_id not in active_calls:
        await sio.emit('call:error', {'message': 'Call not found'}, room=sid)
        return
    
    call_data = active_calls[call_id]
    
    if call_data['receiver_id'] != user_id:
        await sio.emit('call:error', {'message': 'Not authorized'}, room=sid)
        return
    
    # Update call status
    call_data['status'] = 'connected'
    call_data['connected_at'] = datetime.utcnow().isoformat()
    
    # Notify caller
    caller_sockets = get_user_sockets(call_data['caller_id'])
    for caller_sid in caller_sockets:
        await sio.emit('call:accepted', {
            'call_id': call_id,
            'channel_name': call_data['channel_name'],
        }, room=caller_sid)
    
    # Confirm to receiver
    await sio.emit('call:connected', {
        'call_id': call_id,
        'channel_name': call_data['channel_name'],
    }, room=sid)
    
    logger.info(f"[Socket] Call accepted: {call_id}")


@sio.event
async def call_reject(sid, data):
    """
    Reject an incoming call
    data: { call_id: string, reason?: string }
    """
    user_id = socket_to_user.get(sid)
    call_id = data.get('call_id')
    reason = data.get('reason', 'rejected')
    
    if not call_id or call_id not in active_calls:
        await sio.emit('call:error', {'message': 'Call not found'}, room=sid)
        return
    
    call_data = active_calls[call_id]
    
    if call_data['receiver_id'] != user_id:
        await sio.emit('call:error', {'message': 'Not authorized'}, room=sid)
        return
    
    # Notify caller
    caller_sockets = get_user_sockets(call_data['caller_id'])
    for caller_sid in caller_sockets:
        await sio.emit('call:rejected', {
            'call_id': call_id,
            'reason': reason,
        }, room=caller_sid)
    
    # Remove call from active
    del active_calls[call_id]
    
    logger.info(f"[Socket] Call rejected: {call_id} - {reason}")


@sio.event
async def call_end(sid, data):
    """
    End an active call
    data: { call_id: string }
    """
    user_id = socket_to_user.get(sid)
    call_id = data.get('call_id')
    
    await handle_call_end_internal(call_id, user_id, 'ended')


@sio.event
async def call_cancel(sid, data):
    """
    Cancel an outgoing call (before receiver answers)
    data: { call_id: string }
    """
    user_id = socket_to_user.get(sid)
    call_id = data.get('call_id')
    
    if not call_id or call_id not in active_calls:
        return
    
    call_data = active_calls[call_id]
    
    if call_data['caller_id'] != user_id:
        return
    
    # Notify receiver
    receiver_sockets = get_user_sockets(call_data['receiver_id'])
    for receiver_sid in receiver_sockets:
        await sio.emit('call:cancelled', {
            'call_id': call_id,
        }, room=receiver_sid)
    
    # Remove call
    del active_calls[call_id]
    
    logger.info(f"[Socket] Call cancelled: {call_id}")


async def handle_call_end_internal(call_id: str, user_id: str, reason: str):
    """Internal helper to end a call"""
    if not call_id or call_id not in active_calls:
        return
    
    call_data = active_calls[call_id]
    
    # Calculate duration
    duration = 0
    if call_data.get('connected_at'):
        connected_at = datetime.fromisoformat(call_data['connected_at'])
        duration = int((datetime.utcnow() - connected_at).total_seconds())
    
    # Notify both parties
    other_user_id = call_data['receiver_id'] if call_data['caller_id'] == user_id else call_data['caller_id']
    
    other_sockets = get_user_sockets(other_user_id)
    for other_sid in other_sockets:
        await sio.emit('call:ended', {
            'call_id': call_id,
            'reason': reason,
            'duration': duration,
            'ended_by': user_id,
        }, room=other_sid)
    
    # Remove call
    del active_calls[call_id]
    
    logger.info(f"[Socket] Call ended: {call_id} - {reason} (duration: {duration}s)")


# Get online status endpoint helper
def get_online_users_list():
    """Return list of online user IDs"""
    return list(online_users.keys())
