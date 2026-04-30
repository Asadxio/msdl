/**
 * Agora Loader - Platform-specific entry point
 * Uses .web.ts and .native.ts extensions for proper platform resolution
 */

// Default export for TypeScript resolution (will be overridden by platform-specific files)
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
