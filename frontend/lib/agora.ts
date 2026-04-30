/**
 * Agora RTC Configuration and Utilities
 * For 1-to-1 voice and video calling
 */

import { Platform } from 'react-native';

// Agora App Configuration
// Note: In production, get App ID from environment variable
export const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';

// Channel name generator for 1-to-1 calls
export function generateChannelName(userId1: string, userId2: string): string {
  // Sort user IDs to ensure consistent channel name regardless of who initiates
  const sorted = [userId1, userId2].sort();
  return `call_${sorted[0]}_${sorted[1]}`;
}

// Generate unique call ID
export function generateCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// Agora user roles
export enum AgoraRole {
  PUBLISHER = 1,
  SUBSCRIBER = 2,
}

// Call types
export type CallType = 'voice' | 'video';

// Call status
export type CallStatus = 
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'ended'
  | 'failed'
  | 'rejected'
  | 'busy'
  | 'no_answer';

// Call participant info
export interface CallParticipant {
  id: string;
  name: string;
  photoUrl?: string;
  avatar?: string;
}

// Call data structure
export interface CallData {
  id: string;
  channelName: string;
  callType: CallType;
  callerId: string;
  callerName: string;
  receiverId: string;
  receiverName: string;
  status: CallStatus;
  startedAt?: number;
  endedAt?: number;
  duration?: number;
}

// Token response from backend
export interface TokenResponse {
  token: string;
  uid: number;
  channel: string;
  expires_at: number;
}

// Fetch Agora token from backend
export async function fetchAgoraToken(
  channelName: string,
  uid: number = 0,
  role: AgoraRole = AgoraRole.PUBLISHER
): Promise<TokenResponse> {
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
  
  try {
    const response = await fetch(
      `${backendUrl}/api/agora/token?channel=${encodeURIComponent(channelName)}&uid=${uid}&role=${role}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Token generation failed' }));
      throw new Error(error.detail || 'Failed to get Agora token');
    }

    return await response.json();
  } catch (error: any) {
    console.error('[Agora] Token fetch error:', error);
    throw new Error(error.message || 'Network error while fetching token');
  }
}

// Check if platform supports Agora (native only)
export function isPlatformSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

// Format call duration in mm:ss
export function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
