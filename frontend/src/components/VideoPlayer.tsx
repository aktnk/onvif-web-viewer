import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  streamUrl: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ streamUrl }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let hls: Hls | null = null;

    if (videoRef.current) {
      const video = videoRef.current;

      // hls.js is used for most browsers
      if (Hls.isSupported()) {
        const hlsConfig = {
          // Give HLS.js more time to fetch the manifest if it's not ready
          manifestLoadingMaxRetry: 9,
          manifestLoadingRetryDelay: 1000,
        };
        hls = new Hls(hlsConfig);
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(e => console.error("Autoplay was prevented. Please click play.", e));
        });
      } 
      // Native HLS support in Safari
      else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(e => console.error("Autoplay was prevented. Please click play.", e));
        });
      }
    }

    // Cleanup function to destroy hls instance on component unmount
    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [streamUrl]); // Re-run effect if streamUrl changes

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      muted // Autoplay on most browsers requires the video to be muted
      style={{ width: '100%', backgroundColor: '#000' }}
    />
  );
};

export default VideoPlayer;
