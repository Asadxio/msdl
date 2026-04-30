/**
 * Socket.io Client for Real-time Call Signaling
 */

import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';

// Socket instance
let socket: Socket | null = null;

// Connection state
let isConnected = false;
let currentUserId: string | null = null;

// Event listeners storage
type EventCallback = (...args: any[]) => void;
const eventListeners: Map<string, Set<EventCallback>> = new Map();

/**
 * Get the socket server URL
 */
function getSocketUrl(): string {
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
  // Socket.io connects to the same server
  return backendUrl.replace('/api', '');
}

/**
 * Initialize and connect socket
 */
export function connectSocket(userId: string, userName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket?.connected && currentUserId === userId) {
      console.log('[Socket] Already connected for user:', userId);
      resolve();
      return;
    }

    // Disconnect existing connection if different user
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    const socketUrl = getSocketUrl();
    console.log('[Socket] Connecting to:', socketUrl);

    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected, registering user:', userId);
      isConnected = true;
      currentUserId = userId;
      
      // Register user with server
      socket?.emit('register', { user_id: userId, user_name: userName });
    });

    socket.on('registered', (data) => {
      console.log('[Socket] Registered successfully:', data);
      resolve();
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      isConnected = false;
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      reject(error);
    });

    socket.on('error', (data) => {
      console.error('[Socket] Error:', data);
    });

    // Forward all call events to registered listeners
    const callEvents = [
      'call:incoming',
      'call:ringing',
      'call:accepted',
      'call:rejected',
      'call:ended',
      'call:cancelled',
      'call:unavailable',
      'call:connected',
      'call:error',
      'user:online',
      'user:offline',
    ];

    callEvents.forEach((event) => {
      socket?.on(event, (data) => {
        console.log(`[Socket] Event ${event}:`, data);
        notifyListeners(event, data);
      });
    });

    // Timeout for initial connection
    setTimeout(() => {
      if (!isConnected) {
        reject(new Error('Connection timeout'));
      }
    }, 10000);
  });
}

/**
 * Disconnect socket
 */
export function disconnectSocket(): void {
  if (socket) {
    console.log('[Socket] Disconnecting...');
    socket.disconnect();
    socket = null;
    isConnected = false;
    currentUserId = null;
  }
}

/**
 * Check if socket is connected
 */
export function isSocketConnected(): boolean {
  return isConnected && socket?.connected === true;
}

/**
 * Get current user ID
 */
export function getCurrentSocketUserId(): string | null {
  return currentUserId;
}

/**
 * Emit event to server
 */
export function emitSocketEvent(event: string, data: any): void {
  if (!socket?.connected) {
    console.warn('[Socket] Cannot emit - not connected');
    return;
  }
  console.log(`[Socket] Emitting ${event}:`, data);
  socket.emit(event, data);
}

/**
 * Add event listener
 */
export function addSocketListener(event: string, callback: EventCallback): void {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event)?.add(callback);
}

/**
 * Remove event listener
 */
export function removeSocketListener(event: string, callback: EventCallback): void {
  eventListeners.get(event)?.delete(callback);
}

/**
 * Remove all listeners for an event
 */
export function removeAllSocketListeners(event: string): void {
  eventListeners.delete(event);
}

/**
 * Notify all listeners for an event
 */
function notifyListeners(event: string, data: any): void {
  eventListeners.get(event)?.forEach((callback) => {
    try {
      callback(data);
    } catch (error) {
      console.error(`[Socket] Listener error for ${event}:`, error);
    }
  });
}

// ============ Call Signaling Functions ============

/**
 * Initiate a call to another user
 */
export function initiateCallSignal(data: {
  call_id: string;
  receiver_id: string;
  receiver_name: string;
  caller_id: string;
  caller_name: string;
  call_type: 'voice' | 'video';
  channel_name: string;
}): void {
  emitSocketEvent('call_initiate', data);
}

/**
 * Accept an incoming call
 */
export function acceptCallSignal(callId: string): void {
  emitSocketEvent('call_accept', { call_id: callId });
}

/**
 * Reject an incoming call
 */
export function rejectCallSignal(callId: string, reason?: string): void {
  emitSocketEvent('call_reject', { call_id: callId, reason: reason || 'rejected' });
}

/**
 * End an active call
 */
export function endCallSignal(callId: string): void {
  emitSocketEvent('call_end', { call_id: callId });
}

/**
 * Cancel an outgoing call
 */
export function cancelCallSignal(callId: string): void {
  emitSocketEvent('call_cancel', { call_id: callId });
}
