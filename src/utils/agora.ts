import AgoraRTC, { 
  IAgoraRTCClient, 
  ICameraVideoTrack, 
  IMicrophoneAudioTrack,
  UID
} from 'agora-rtc-sdk-ng';

const appId = import.meta.env.VITE_AGORA_APP_ID;

if (!appId) throw new Error('Agora App ID is required');

interface AgoraEngine {
  client: IAgoraRTCClient;
  localAudioTrack?: IMicrophoneAudioTrack;
  localVideoTrack?: ICameraVideoTrack;
}

let agoraEngine: AgoraEngine | null = null;

export const createAgoraEngine = async (): Promise<AgoraEngine> => {
  if (agoraEngine) {
    return agoraEngine;
  }

  const client = AgoraRTC.createClient({
    mode: 'rtc',
    codec: 'vp8'
  });

  agoraEngine = { client };
  return agoraEngine;
};

export const joinChannel = async (channelId: string, uid: UID = null): Promise<void> => {
  if (!agoraEngine) {
    throw new Error('Agora engine not initialized');
  }

  try {
    // Join the channel
    await agoraEngine.client.join(appId, channelId, null, uid);
    console.log('Joined channel:', channelId);

    // Create local tracks
    const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
    agoraEngine.localAudioTrack = audioTrack;
    agoraEngine.localVideoTrack = videoTrack;

    // Publish local tracks
    await agoraEngine.client.publish([audioTrack, videoTrack]);
    console.log('Published local tracks');

    return;
  } catch (error) {
    console.error('Error joining channel:', error);
    throw error;
  }
};

export const leaveChannel = async (): Promise<void> => {
  if (!agoraEngine) return;

  try {
    // Unpublish and close local tracks
    if (agoraEngine.localAudioTrack) {
      await agoraEngine.client.unpublish(agoraEngine.localAudioTrack);
      agoraEngine.localAudioTrack.close();
    }
    if (agoraEngine.localVideoTrack) {
      await agoraEngine.client.unpublish(agoraEngine.localVideoTrack);
      agoraEngine.localVideoTrack.close();
    }

    // Leave the channel
    await agoraEngine.client.leave();
    console.log('Left channel');

    // Reset engine
    agoraEngine = null;
  } catch (error) {
    console.error('Error leaving channel:', error);
    throw error;
  }
};

export const playVideo = (track: ICameraVideoTrack, element: HTMLElement) => {
  if (!track || !element) return;
  track.play(element);
};

export default {
  createAgoraEngine,
  joinChannel,
  leaveChannel,
  playVideo
};
