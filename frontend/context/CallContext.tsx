/**
 * Call Context - Manages call state with Socket.io signaling
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CallData,
  CallStatus,
  CallType,
  CallParticipant,
  generateChannelName,
  generateCallId,
  fetchAgoraToken,
  AGORA_APP_ID,
  isPlatformSupported,
  formatCallDuration,
} from '@/lib/agora';
import {
  connectSocket,
  disconnectSocket,
  isSocketConnected,
  addSocketListener,
  removeSocketListener,
  initiateCallSignal,
  acceptCallSignal,
  rejectCallSignal,
  endCallSignal,
  cancelCallSignal,
} from '@/lib/socket';
import { useAuth } from './AuthContext';

// Incoming call data from socket
interface IncomingCallData {
  call_id: string;
  caller_id: string;
  caller_name: string;
  call_type: 'voice' | 'video';
  channel_name: string;
}

interface CallContextType {
  // State
  currentCall: CallData | null;
  isInCall: boolean;
  incomingCall: IncomingCallData | null;
  callDuration: number;
  callStatus: CallStatus;
  isSocketConnected: boolean;
  
  // Actions
  initiateCall: (participant: CallParticipant, callType: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: (reason?: string) => void;
  endCall: () => void;
  cancelOutgoingCall: () => void;
  
  // Agora state
  agoraToken: string | null;
  agoraUid: number;
  channelName: string | null;
}

const CallContext = createContext<CallContextType | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const router = useRouter();
  
  // Call state
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callDuration, setCallDuration] = useState(0);
  
  // Agora state
  const [agoraToken, setAgoraToken] = useState<string | null>(null);
  const [agoraUid, setAgoraUid] = useState<number>(0);
  const [channelName, setChannelName] = useState<string | null>(null);
  
  // Socket connection state
  const [socketConnected, setSocketConnected] = useState(false);
  
  // Timers
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isInCall = currentCall !== null && 
    ['connecting', 'connected', 'calling', 'ringing'].includes(callStatus);

  // Connect socket when user is authenticated
  useEffect(() => {
    if (user?.uid && profile?.name) {
      console.log('[CallContext] Connecting socket for user:', user.uid);
      connectSocket(user.uid, profile.name)
        .then(() => {
          setSocketConnected(true);
          console.log('[CallContext] Socket connected');
        })
        .catch((error) => {
          console.error('[CallContext] Socket connection failed:', error);
          setSocketConnected(false);
        });
    }

    return () => {
      if (user?.uid) {
        disconnectSocket();
        setSocketConnected(false);
      }
    };
  }, [user?.uid, profile?.name]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && user?.uid && profile?.name && !isSocketConnected()) {
        // Reconnect socket when app comes to foreground
        connectSocket(user.uid, profile.name)
          .then(() => setSocketConnected(true))
          .catch(() => setSocketConnected(false));
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [user?.uid, profile?.name]);

  // Setup socket event listeners
  useEffect(() => {
    // Incoming call handler
    const handleIncomingCall = (data: IncomingCallData) => {
      console.log('[CallContext] Incoming call:', data);
      
      // Don't show if already in a call
      if (isInCall) {
        console.log('[CallContext] Already in call, auto-rejecting');
        rejectCallSignal(data.call_id, 'busy');
        return;
      }
      
      setIncomingCall(data);
      setCallStatus('ringing');
    };

    // Call accepted by receiver
    const handleCallAccepted = async (data: { call_id: string; channel_name: string }) => {
      console.log('[CallContext] Call accepted:', data);
      
      if (currentCall?.id === data.call_id) {
        setCallStatus('connected');
        setChannelName(data.channel_name);
        startCallTimer();
        
        // Navigate to call screen
        router.push(`/call/${data.channel_name}`);
      }
    };

    // Call rejected by receiver
    const handleCallRejected = (data: { call_id: string; reason: string }) => {
      console.log('[CallContext] Call rejected:', data);
      
      if (currentCall?.id === data.call_id) {
        Alert.alert('Call Declined', data.reason === 'busy' ? 'User is busy' : 'Call was declined');
        cleanupCall();
      }
    };

    // Call ended by other party
    const handleCallEnded = (data: { call_id: string; reason: string; duration: number }) => {
      console.log('[CallContext] Call ended:', data);
      
      if (currentCall?.id === data.call_id || incomingCall?.call_id === data.call_id) {
        cleanupCall();
        router.back();
      }
    };

    // Call cancelled by caller
    const handleCallCancelled = (data: { call_id: string }) => {
      console.log('[CallContext] Call cancelled:', data);
      
      if (incomingCall?.call_id === data.call_id) {
        setIncomingCall(null);
        setCallStatus('idle');
      }
    };

    // User unavailable
    const handleCallUnavailable = (data: { call_id: string; reason: string }) => {
      console.log('[CallContext] Call unavailable:', data);
      
      if (currentCall?.id === data.call_id) {
        Alert.alert('Cannot Call', data.reason);
        cleanupCall();
      }
    };

    // Call connected (confirmation for receiver)
    const handleCallConnected = async (data: { call_id: string; channel_name: string }) => {
      console.log('[CallContext] Call connected:', data);
      setCallStatus('connected');
      setChannelName(data.channel_name);
      startCallTimer();
    };

    // Register listeners
    addSocketListener('call:incoming', handleIncomingCall);
    addSocketListener('call:accepted', handleCallAccepted);
    addSocketListener('call:rejected', handleCallRejected);
    addSocketListener('call:ended', handleCallEnded);
    addSocketListener('call:cancelled', handleCallCancelled);
    addSocketListener('call:unavailable', handleCallUnavailable);
    addSocketListener('call:connected', handleCallConnected);

    return () => {
      removeSocketListener('call:incoming', handleIncomingCall);
      removeSocketListener('call:accepted', handleCallAccepted);
      removeSocketListener('call:rejected', handleCallRejected);
      removeSocketListener('call:ended', handleCallEnded);
      removeSocketListener('call:cancelled', handleCallCancelled);
      removeSocketListener('call:unavailable', handleCallUnavailable);
      removeSocketListener('call:connected', handleCallConnected);
    };
  }, [currentCall, incomingCall, isInCall, router]);

  // Start call duration timer
  const startCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  // Stop call duration timer
  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  // Cleanup call state
  const cleanupCall = useCallback(() => {
    stopCallTimer();
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    setCurrentCall(null);
    setIncomingCall(null);
    setCallStatus('idle');
    setAgoraToken(null);
    setChannelName(null);
    setCallDuration(0);
  }, [stopCallTimer]);

  // Initiate a call
  const initiateCall = useCallback(async (participant: CallParticipant, callType: CallType) => {
    if (!user?.uid || !profile) {
      Alert.alert('Error', 'Please sign in to make calls');
      return;
    }

    if (!socketConnected) {
      Alert.alert('Connection Error', 'Not connected to server. Please try again.');
      return;
    }

    if (!isPlatformSupported()) {
      Alert.alert('Not Supported', 'Voice/video calls are only available on mobile devices');
      return;
    }

    if (isInCall) {
      Alert.alert('Busy', 'You are already in a call');
      return;
    }

    try {
      const callId = generateCallId();
      const channel = generateChannelName(user.uid, participant.id);

      // Get Agora token
      const tokenResponse = await fetchAgoraToken(channel, 0);
      setAgoraToken(tokenResponse.token);
      setAgoraUid(tokenResponse.uid);
      setChannelName(channel);

      // Create call data
      const callData: CallData = {
        id: callId,
        channelName: channel,
        callType,
        callerId: user.uid,
        callerName: profile.name || 'Unknown',
        receiverId: participant.id,
        receiverName: participant.name,
        status: 'calling',
        startedAt: Date.now(),
      };

      setCurrentCall(callData);
      setCallStatus('calling');

      // Send call signal via socket
      initiateCallSignal({
        call_id: callId,
        receiver_id: participant.id,
        receiver_name: participant.name,
        caller_id: user.uid,
        caller_name: profile.name || 'Unknown',
        call_type: callType,
        channel_name: channel,
      });

      // Auto-cancel after 30 seconds if no answer
      ringTimeoutRef.current = setTimeout(() => {
        if (callStatus === 'calling') {
          cancelOutgoingCall();
          Alert.alert('No Answer', 'The user did not answer');
        }
      }, 30000);

    } catch (error: any) {
      console.error('[CallContext] initiateCall error:', error);
      Alert.alert('Call Failed', error.message || 'Unable to start call');
      cleanupCall();
    }
  }, [user?.uid, profile, socketConnected, isInCall, callStatus, cleanupCall]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!incomingCall || !user?.uid) return;

    try {
      // Get Agora token
      const tokenResponse = await fetchAgoraToken(incomingCall.channel_name, 0);
      setAgoraToken(tokenResponse.token);
      setAgoraUid(tokenResponse.uid);
      setChannelName(incomingCall.channel_name);

      // Create call data from incoming
      const callData: CallData = {
        id: incomingCall.call_id,
        channelName: incomingCall.channel_name,
        callType: incomingCall.call_type,
        callerId: incomingCall.caller_id,
        callerName: incomingCall.caller_name,
        receiverId: user.uid,
        receiverName: profile?.name || 'Unknown',
        status: 'connected',
        startedAt: Date.now(),
      };

      setCurrentCall(callData);
      
      // Send accept signal
      acceptCallSignal(incomingCall.call_id);
      
      setIncomingCall(null);
      setCallStatus('connecting');

      // Navigate to call screen
      router.push(`/call/${incomingCall.channel_name}`);

    } catch (error: any) {
      console.error('[CallContext] acceptCall error:', error);
      Alert.alert('Error', 'Unable to accept call');
      rejectCallSignal(incomingCall.call_id, 'error');
      cleanupCall();
    }
  }, [incomingCall, user?.uid, profile?.name, router, cleanupCall]);

  // Reject incoming call
  const rejectCall = useCallback((reason?: string) => {
    if (!incomingCall) return;
    
    rejectCallSignal(incomingCall.call_id, reason || 'rejected');
    setIncomingCall(null);
    setCallStatus('idle');
  }, [incomingCall]);

  // End current call
  const endCall = useCallback(() => {
    if (currentCall) {
      endCallSignal(currentCall.id);
    }
    cleanupCall();
  }, [currentCall, cleanupCall]);

  // Cancel outgoing call
  const cancelOutgoingCall = useCallback(() => {
    if (currentCall && callStatus === 'calling') {
      cancelCallSignal(currentCall.id);
    }
    cleanupCall();
  }, [currentCall, callStatus, cleanupCall]);

  return (
    <CallContext.Provider
      value={{
        currentCall,
        isInCall,
        incomingCall,
        callDuration,
        callStatus,
        isSocketConnected: socketConnected,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        cancelOutgoingCall,
        agoraToken,
        agoraUid,
        channelName,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}
