import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export interface AudioTrack {
  id: string;
  titleEn: string;
  title?: string; // backwards compatibility alias
  subtitle?: string;
  arabicTitle?: string;
  titleAr?: string;
  titleUr?: string;
  artistOrSource?: string;
  category: 'quran' | 'hadith' | 'dua' | 'salah' | 'azaan' | 'dars' | 'asma';
  audioUrl: string;
  durationSeconds?: number;
}

interface GlobalAudioContextType {
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  isBuffering: boolean;
  positionMs: number;
  durationMs: number;
  playbackSpeed: number;
  isLooping: boolean;
  isMiniPlayerVisible: boolean;
  isExpandedModalVisible: boolean;
  playTrack: (track: AudioTrack, playlist?: AudioTrack[]) => Promise<void>;
  pauseTrack: () => Promise<void>;
  resumeTrack: () => Promise<void>;
  stopTrack: () => Promise<void>;
  seekTrack: (posMillis: number) => Promise<void>;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  setPlaybackSpeed: (speed: number) => Promise<void>;
  toggleLooping: () => Promise<void>;
  setMiniPlayerVisible: (visible: boolean) => void;
  setExpandedModalVisible: (visible: boolean) => void;
}

const GlobalAudioContext = createContext<GlobalAudioContextType>({
  currentTrack: null,
  isPlaying: false,
  isBuffering: false,
  positionMs: 0,
  durationMs: 0,
  playbackSpeed: 1.0,
  isLooping: false,
  isMiniPlayerVisible: false,
  isExpandedModalVisible: false,
  playTrack: async () => {},
  pauseTrack: async () => {},
  resumeTrack: async () => {},
  stopTrack: async () => {},
  seekTrack: async () => {},
  nextTrack: async () => {},
  prevTrack: async () => {},
  setPlaybackSpeed: async () => {},
  toggleLooping: async () => {},
  setMiniPlayerVisible: () => {},
  setExpandedModalVisible: () => {},
});

export const GlobalAudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [playlist, setPlaylist] = useState<AudioTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playbackSpeed, setSpeedState] = useState(1.0);
  const [isLooping, setIsLoopingState] = useState(false);
  const [isMiniPlayerVisible, setMiniPlayerVisible] = useState(false);
  const [isExpandedModalVisible, setExpandedModalVisible] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    // Configure system audio session for devotional playback
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const onPlaybackStatusUpdate = (status: any) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.warn('[GlobalAudio] Playback error:', status.error);
        setIsPlaying(false);
        setIsBuffering(false);
      }
      return;
    }

    setIsPlaying(status.isPlaying);
    setIsBuffering(status.isBuffering);
    setPositionMs(status.positionMillis || 0);
    setDurationMs(status.durationMillis || (currentTrack?.durationSeconds ? currentTrack.durationSeconds * 1000 : 0));

    if (status.didJustFinish && !status.isLooping) {
      handleAutoAdvance();
    }
  };

  const handleAutoAdvance = async () => {
    if (playlist.length > 1 && currentTrack) {
      const idx = playlist.findIndex((t) => t.id === currentTrack.id);
      if (idx >= 0 && idx < playlist.length - 1) {
        await playTrack(playlist[idx + 1], playlist);
        return;
      }
    }
    setIsPlaying(false);
  };

  const playTrack = async (track: AudioTrack, newPlaylist?: AudioTrack[]) => {
    try {
      if (newPlaylist) {
        setPlaylist(newPlaylist);
      } else if (!playlist.some((t) => t.id === track.id)) {
        setPlaylist([track]);
      }

      // Stop & unload previous sound cleanly
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }

      setCurrentTrack(track);
      setMiniPlayerVisible(true);
      setIsBuffering(true);
      setPositionMs(0);

      const { sound } = await Audio.Sound.createAsync(
        { uri: track.audioUrl },
        {
          shouldPlay: true,
          rate: playbackSpeed,
          shouldCorrectPitch: true,
          isLooping,
        },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setIsBuffering(false);
    } catch (err) {
      console.warn('[GlobalAudio] Failed to load track:', track.id, err);
      setIsBuffering(false);
      setIsPlaying(false);
    }
  };

  const pauseTrack = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } catch {}
    }
  };

  const resumeTrack = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      } catch {}
    } else if (currentTrack) {
      await playTrack(currentTrack);
    }
  };

  const stopTrack = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      } catch {}
    }
    setIsPlaying(false);
    setPositionMs(0);
    setMiniPlayerVisible(false);
    setExpandedModalVisible(false);
  };

  const seekTrack = async (posMillis: number) => {
    if (soundRef.current) {
      try {
        await soundRef.current.setPositionAsync(posMillis);
        setPositionMs(posMillis);
      } catch {}
    }
  };

  const nextTrack = async () => {
    if (!currentTrack || playlist.length <= 1) return;
    const idx = playlist.findIndex((t) => t.id === currentTrack.id);
    if (idx >= 0 && idx < playlist.length - 1) {
      await playTrack(playlist[idx + 1], playlist);
    }
  };

  const prevTrack = async () => {
    if (!currentTrack || playlist.length <= 1) return;
    const idx = playlist.findIndex((t) => t.id === currentTrack.id);
    if (idx > 0) {
      await playTrack(playlist[idx - 1], playlist);
    }
  };

  const setPlaybackSpeed = async (speed: number) => {
    setSpeedState(speed);
    if (soundRef.current) {
      try {
        await soundRef.current.setRateAsync(speed, true);
      } catch {}
    }
  };

  const toggleLooping = async () => {
    const next = !isLooping;
    setIsLoopingState(next);
    if (soundRef.current) {
      try {
        await soundRef.current.setIsLoopingAsync(next);
      } catch {}
    }
  };

  return (
    <GlobalAudioContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isBuffering,
        positionMs,
        durationMs,
        playbackSpeed,
        isLooping,
        isMiniPlayerVisible,
        isExpandedModalVisible,
        playTrack,
        pauseTrack,
        resumeTrack,
        stopTrack,
        seekTrack,
        nextTrack,
        prevTrack,
        setPlaybackSpeed,
        toggleLooping,
        setMiniPlayerVisible,
        setExpandedModalVisible,
      }}
    >
      {children}
    </GlobalAudioContext.Provider>
  );
};

export const useGlobalAudio = () => useContext(GlobalAudioContext);
