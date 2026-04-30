/**
 * Agora Loader - Native Implementation (iOS/Android)
 * This file is only loaded on native platforms due to .native.ts extension
 */

// Dynamic require to prevent web bundler from analyzing this
const loadNativeAgora = () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const agora = require('react-native-agora');
  return agora;
};

export const loadAgoraEngine = async () => {
  try {
    const agora = loadNativeAgora();
    return {
      available: true,
      createEngine: agora.createAgoraRtcEngine,
      SurfaceView: agora.RtcSurfaceView,
      ChannelProfileType: agora.ChannelProfileType,
      ClientRoleType: agora.ClientRoleType,
      VideoSourceType: agora.VideoSourceType,
    };
  } catch (error) {
    console.error('[Agora] Failed to load native module:', error);
    return {
      available: false,
      createEngine: null,
      SurfaceView: null,
      ChannelProfileType: null,
      ClientRoleType: null,
      VideoSourceType: null,
    };
  }
};

export const isAgoraAvailable = () => true;
