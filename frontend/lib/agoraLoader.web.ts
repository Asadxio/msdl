/**
 * Agora Loader - Web Stub (no Agora support on web)
 */

export const loadAgoraEngine = async () => {
  return {
    available: false,
    createEngine: null,
    SurfaceView: null,
    ChannelProfileType: null,
    ClientRoleType: null,
    VideoSourceType: null,
  };
};

export const isAgoraAvailable = () => false;
