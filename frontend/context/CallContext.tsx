/**
 * Call Context - Manages call state across the app
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
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
} from '@/lib/agora';
import { useAuth } from './AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';

interface CallContextType {
  // State
  currentCall: CallData | null;
  isInCall: boolean;
  incomingCall: CallData | null;
  
  // Actions
  initiateCall: (participant: CallParticipant, callType: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  
  // Agora state
  agoraToken: string | null;
  agoraUid: number;
}

const CallContext = createContext<CallContextType | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallData | null>(null);
  const [agoraToken, setAgoraToken] = useState<string | null>(null);
  const [agoraUid, setAgoraUid] = useState<number>(0);
  const callDocUnsubRef = useRef<(() => void) | null>(null);

  const isInCall = currentCall !== null && 
    ['connecting', 'connected', 'calling', 'ringing'].includes(currentCall.status);

  // Listen for incoming calls
  useEffect(() => {
    if (!user?.uid) return;

    const callDocRef = doc(db, 'active_calls', user.uid);
    const unsubscribe = onSnapshot(callDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        // No incoming call
        if (incomingCall && incomingCall.receiverId === user.uid) {
          setIncomingCall(null);
        }
        return;
      }

      const callData = snapshot.data() as CallData;
      
      // Check if this is an incoming call (we're the receiver)
      if (callData.receiverId === user.uid && callData.status === 'calling') {
        setIncomingCall(callData);
      } else if (callData.status === 'ended' || callData.status === 'rejected') {
        setIncomingCall(null);
        if (currentCall?.id === callData.id) {
          setCurrentCall(null);
          setAgoraToken(null);
        }
      }
    });

    return () => unsubscribe();
  }, [user?.uid, currentCall?.id, incomingCall]);

  // Initiate a call
  const initiateCall = useCallback(async (participant: CallParticipant, callType: CallType) => {
    if (!user?.uid || !profile) {
      Alert.alert('Error', 'Please sign in to make calls');
      return;
    }

    if (!isPlatformSupported()) {
      Alert.alert('Not Supported', 'Voice/video calls are only available on mobile devices');
      return;
    }

    if (!AGORA_APP_ID) {
      Alert.alert('Configuration Error', 'Agora App ID is not configured');
      return;
    }

    if (isInCall) {
      Alert.alert('Busy', 'You are already in a call');
      return;
    }

    try {
      const callId = generateCallId();
      const channelName = generateChannelName(user.uid, participant.id);

      // Create call data
      const callData: CallData = {
        id: callId,
        channelName,
        callType,
        callerId: user.uid,
        callerName: profile.name || 'Unknown',
        receiverId: participant.id,
        receiverName: participant.name,
        status: 'calling',
        startedAt: Date.now(),
      };

      // Get Agora token
      const tokenResponse = await fetchAgoraToken(channelName, 0);
      setAgoraToken(tokenResponse.token);
      setAgoraUid(tokenResponse.uid);

      // Save call to Firestore (for receiver to see)
      await setDoc(doc(db, 'active_calls', participant.id), callData);
      
      // Also save caller's reference
      await setDoc(doc(db, 'active_calls', user.uid), callData);

      setCurrentCall(callData);

      // Listen for call status changes
      if (callDocUnsubRef.current) {
        callDocUnsubRef.current();
      }

      callDocUnsubRef.current = onSnapshot(
        doc(db, 'active_calls', participant.id),
        (snapshot) => {
          if (!snapshot.exists()) {
            // Call was deleted/ended
            setCurrentCall(null);
            setAgoraToken(null);
            return;
          }

          const updatedCall = snapshot.data() as CallData;
          setCurrentCall(updatedCall);

          if (updatedCall.status === 'rejected' || updatedCall.status === 'ended') {
            setCurrentCall(null);
            setAgoraToken(null);
            if (callDocUnsubRef.current) {
              callDocUnsubRef.current();
              callDocUnsubRef.current = null;
            }
          }
        }
      );

      // Auto-timeout after 30 seconds if no answer
      setTimeout(async () => {
        const callDoc = await doc(db, 'active_calls', participant.id);
        // Check if still calling
        if (currentCall?.status === 'calling') {
          await updateDoc(callDoc, { status: 'no_answer' });
          setCurrentCall(null);
          setAgoraToken(null);
        }
      }, 30000);

    } catch (error: any) {
      console.error('[Call] initiateCall error:', error);
      Alert.alert('Call Failed', error.message || 'Unable to start call');
      setCurrentCall(null);
      setAgoraToken(null);
    }
  }, [user?.uid, profile, isInCall, currentCall?.status]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!incomingCall || !user?.uid) return;

    try {
      // Get token for the channel
      const tokenResponse = await fetchAgoraToken(incomingCall.channelName, 0);
      setAgoraToken(tokenResponse.token);
      setAgoraUid(tokenResponse.uid);

      // Update call status
      const updatedCall: CallData = {
        ...incomingCall,
        status: 'connected',
      };

      await updateDoc(doc(db, 'active_calls', user.uid), { status: 'connected' });
      await updateDoc(doc(db, 'active_calls', incomingCall.callerId), { status: 'connected' });

      setCurrentCall(updatedCall);
      setIncomingCall(null);

      // Listen for call status changes
      if (callDocUnsubRef.current) {
        callDocUnsubRef.current();
      }

      callDocUnsubRef.current = onSnapshot(
        doc(db, 'active_calls', user.uid),
        (snapshot) => {
          if (!snapshot.exists()) {
            setCurrentCall(null);
            setAgoraToken(null);
            return;
          }

          const updatedCallData = snapshot.data() as CallData;
          if (updatedCallData.status === 'ended') {
            setCurrentCall(null);
            setAgoraToken(null);
          } else {
            setCurrentCall(updatedCallData);
          }
        }
      );

    } catch (error: any) {
      console.error('[Call] acceptCall error:', error);
      Alert.alert('Error', 'Unable to accept call');
    }
  }, [incomingCall, user?.uid]);

  // Reject incoming call
  const rejectCall = useCallback(async () => {
    if (!incomingCall || !user?.uid) return;

    try {
      await updateDoc(doc(db, 'active_calls', user.uid), { status: 'rejected' });
      await updateDoc(doc(db, 'active_calls', incomingCall.callerId), { status: 'rejected' });
      
      // Clean up after a delay
      setTimeout(async () => {
        await deleteDoc(doc(db, 'active_calls', user.uid)).catch(() => {});
        await deleteDoc(doc(db, 'active_calls', incomingCall.callerId)).catch(() => {});
      }, 2000);

      setIncomingCall(null);
    } catch (error: any) {
      console.error('[Call] rejectCall error:', error);
    }
  }, [incomingCall, user?.uid]);

  // End current call
  const endCall = useCallback(async () => {
    if (!currentCall || !user?.uid) return;

    try {
      const duration = currentCall.startedAt 
        ? Math.floor((Date.now() - currentCall.startedAt) / 1000)
        : 0;

      // Update both users' call documents
      const endedCall = {
        status: 'ended',
        endedAt: Date.now(),
        duration,
      };

      await updateDoc(doc(db, 'active_calls', user.uid), endedCall).catch(() => {});
      
      const otherUserId = currentCall.callerId === user.uid 
        ? currentCall.receiverId 
        : currentCall.callerId;
      await updateDoc(doc(db, 'active_calls', otherUserId), endedCall).catch(() => {});

      // Clean up after a delay
      setTimeout(async () => {
        await deleteDoc(doc(db, 'active_calls', user.uid)).catch(() => {});
        await deleteDoc(doc(db, 'active_calls', otherUserId)).catch(() => {});
      }, 2000);

      if (callDocUnsubRef.current) {
        callDocUnsubRef.current();
        callDocUnsubRef.current = null;
      }

      setCurrentCall(null);
      setAgoraToken(null);
      setIncomingCall(null);
    } catch (error: any) {
      console.error('[Call] endCall error:', error);
      setCurrentCall(null);
      setAgoraToken(null);
    }
  }, [currentCall, user?.uid]);

  return (
    <CallContext.Provider
      value={{
        currentCall,
        isInCall,
        incomingCall,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        agoraToken,
        agoraUid,
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
