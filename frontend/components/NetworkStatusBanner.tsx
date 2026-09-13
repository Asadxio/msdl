/**
 * NetworkStatusBanner.tsx
 * Real-time Offline/Online status indicator for Madrasatu-s-Salikat.
 * Notifies students when they are browsing offline content and gives feedback upon reconnection.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Network from 'expo-network';

export function NetworkStatusBanner() {
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOfflineRef = useRef(false);
  const translateY = useRef(new Animated.Value(-60)).current;
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const animateIn = () => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const animateOut = (callback?: () => void) => {
    Animated.timing(translateY, {
      toValue: -60,
      duration: 250,
      useNativeDriver: true,
    }).start(callback);
  };

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;

    // Check initial network state
    Network.getNetworkStateAsync()
      .then((state) => {
        const offline = state.isConnected === false || state.isInternetReachable === false;
        if (offline) {
          setIsOffline(true);
          wasOfflineRef.current = true;
          animateIn();
        }
      })
      .catch(() => {});

    // Listen for real-time network connectivity changes
    try {
      subscription = Network.addNetworkStateListener((state) => {
        const offline = state.isConnected === false || state.isInternetReachable === false;

        if (offline) {
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          setIsOffline(true);
          setShowReconnected(false);
          wasOfflineRef.current = true;
          animateIn();
        } else {
          // Came back online
          setIsOffline(false);
          if (wasOfflineRef.current) {
            setShowReconnected(true);
            animateIn();

            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            hideTimerRef.current = setTimeout(() => {
              animateOut(() => {
                setShowReconnected(false);
                wasOfflineRef.current = false;
              });
            }, 2500);
          } else {
            animateOut();
          }
        }
      });
    } catch (e) {
      console.log('[NetworkStatusBanner] Listener error:', e);
    }

    return () => {
      if (subscription) subscription.remove();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (!isOffline && !showReconnected) {
    return null;
  }

  const isBackOnline = !isOffline && showReconnected;
  const bannerBg = isBackOnline ? '#16A34A' : '#334155';
  const iconName = isBackOnline ? 'checkmark-circle-outline' : 'cloud-offline-outline';
  const message = isBackOnline
    ? 'Back Online • Connected'
    : 'Offline Mode • Browsing saved offline content';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: Math.max(insets.top, 0),
          backgroundColor: bannerBg,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name={iconName} size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
        <Text style={styles.text} numberOfLines={1}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 99999,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
