declare module 'react-native-agora' {
  import * as React from 'react';
  import { ViewProps } from 'react-native';

  export type RtcConnection = { channelId?: string; localUid?: number };
  export type RtcStats = Record<string, unknown>;

  export type IRtcEngineEventHandler = {
    onJoinChannelSuccess?: (connection: RtcConnection, elapsed: number) => void;
    onUserJoined?: (connection: RtcConnection, remoteUid: number, elapsed: number) => void;
    onUserOffline?: (connection: RtcConnection, remoteUid: number, reason: number) => void;
    onLeaveChannel?: (connection: RtcConnection, stats: RtcStats) => void;
    onUserMuteAudio?: (connection: RtcConnection, remoteUid: number, muted: boolean) => void;
    onUserMuteVideo?: (connection: RtcConnection, remoteUid: number, muted: boolean) => void;
    onTokenPrivilegeWillExpire?: (connection: RtcConnection, token: string) => void;
    onRequestToken?: (connection: RtcConnection) => void;
    onConnectionStateChanged?: (connection: RtcConnection, state: number, reason: number) => void;
  };

  export type IRtcEngine = {
    initialize: (config: { appId: string }) => number | void;
    registerEventHandler: (handler: IRtcEngineEventHandler) => void;
    unregisterEventHandler: (handler: IRtcEngineEventHandler) => void;
    enableVideo: () => number | void;
    enableAudio: () => number | void;
    startPreview: () => number | void;
    stopPreview: () => number | void;
    joinChannel: (token: string | null, channelId: string, uid: number, options?: Record<string, unknown>) => number | void;
    leaveChannel: () => number | void;
    release: () => void;
    muteLocalAudioStream: (muted: boolean) => number | void;
    muteLocalVideoStream: (muted: boolean) => number | void;
    switchCamera: () => number | void;
    setEnableSpeakerphone: (enabled: boolean) => number | void;
    renewToken: (token: string) => number | void;
    muteRemoteAudioStream: (uid: number, muted: boolean) => number | void;
    muteRemoteVideoStream: (uid: number, muted: boolean) => number | void;
  };

  export function createAgoraRtcEngine(): IRtcEngine;

  export const ChannelProfileType: {
    ChannelProfileCommunication: number;
    ChannelProfileLiveBroadcasting: number;
  };
  export const ClientRoleType: {
    ClientRoleBroadcaster: number;
    ClientRoleAudience: number;
  };
  export const RenderModeType: {
    RenderModeHidden: number;
    RenderModeFit: number;
  };
  export const VideoSourceType: {
    VideoSourceCameraPrimary: number;
  };

  export type RtcSurfaceViewProps = ViewProps & {
    canvas: { uid: number; sourceType?: number; renderMode?: number };
  };
  export const RtcSurfaceView: React.ComponentType<RtcSurfaceViewProps>;
}
