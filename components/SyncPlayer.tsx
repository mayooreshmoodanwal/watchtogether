'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { VideoState } from '@/lib/types';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface Props {
  code: string;
  isHost: boolean;
  videoState: VideoState | null;
  onVideoEvent: (event: string, data: any) => void;
}

function extractVideoId(input: string): string | null {
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function SyncPlayer({ code, isHost, videoState, onVideoEvent }: Props) {
  const playerRef = useRef<any>(null);
  const playerReadyRef = useRef(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');
  const ignoreEventsRef = useRef(false);
  const prevVideoIdRef = useRef<string | null>(null);
  const videoStateRef = useRef<VideoState | null>(null);
  const isHostRef = useRef(isHost);

  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { videoStateRef.current = videoState; }, [videoState]);

  const initPlayer = useCallback(() => {
    if (playerRef.current) return;
    if (!document.getElementById('yt-player')) return;

    playerRef.current = new window.YT.Player('yt-player', {
      height: '100%',
      width: '100%',
      playerVars: {
        autoplay: 0,
        controls: 1,
        modestbranding: 1,
        rel: 0,
        enablejsapi: 1,
        origin: typeof window !== 'undefined' ? window.location.origin : '',
      },
      events: {
        onReady: () => {
          playerReadyRef.current = true;
          setPlayerReady(true);
        },
        onStateChange: (e: any) => {
          if (!isHostRef.current || ignoreEventsRef.current) return;
          const YT = window.YT;
          if (!playerRef.current) return;
          const ct: number = playerRef.current.getCurrentTime() || 0;
          if (e.data === YT.PlayerState.PLAYING) {
            onVideoEvent('video-play', { currentTime: ct });
          } else if (e.data === YT.PlayerState.PAUSED) {
            onVideoEvent('video-pause', { currentTime: ct });
          }
        },
      },
    });
  }, [onVideoEvent]);

  // Load YouTube API once
  useEffect(() => {
    const loadApi = () => {
      if (window.YT && window.YT.Player) {
        initPlayer();
        return;
      }
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.getElementById('yt-api-script')) {
        const s = document.createElement('script');
        s.id = 'yt-api-script';
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
      }
    };
    loadApi();
    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
      playerReadyRef.current = false;
    };
  }, [initPlayer]);

  // Apply incoming videoState to the player (for guests)
  useEffect(() => {
    if (!playerReady || !videoState || !playerRef.current) return;

    const isNewVideo = videoState.videoId !== prevVideoIdRef.current;

    if (isNewVideo && videoState.videoId) {
      prevVideoIdRef.current = videoState.videoId;
      ignoreEventsRef.current = true;
      const startSeconds = videoState.playing
        ? videoState.currentTime + (Date.now() - videoState.updatedAt) / 1000
        : videoState.currentTime;
      playerRef.current.loadVideoById({ videoId: videoState.videoId, startSeconds: Math.max(0, startSeconds) });
      if (!videoState.playing) {
        setTimeout(() => {
          try { playerRef.current?.pauseVideo(); } catch {}
        }, 1000);
      }
      setTimeout(() => { ignoreEventsRef.current = false; }, 2000);
      return;
    }

    // Play/pause/seek sync for guests only
    if (!isHost && !isNewVideo) {
      ignoreEventsRef.current = true;
      if (videoState.playing) {
        const expected = videoState.currentTime + (Date.now() - videoState.updatedAt) / 1000;
        playerRef.current.seekTo(Math.max(0, expected), true);
        playerRef.current.playVideo();
      } else {
        playerRef.current.seekTo(videoState.currentTime, true);
        playerRef.current.pauseVideo();
      }
      setTimeout(() => { ignoreEventsRef.current = false; }, 800);
    }
  }, [videoState, playerReady, isHost]);

  // Drift correction for guests every 5s
  useEffect(() => {
    if (isHost || !playerReady) return;
    const id = setInterval(() => {
      const vs = videoStateRef.current;
      if (!vs || !vs.playing || !playerRef.current) return;
      try {
        const current: number = playerRef.current.getCurrentTime() || 0;
        const expected = vs.currentTime + (Date.now() - vs.updatedAt) / 1000;
        if (Math.abs(current - expected) > 2.5) {
          ignoreEventsRef.current = true;
          playerRef.current.seekTo(expected, true);
          setTimeout(() => { ignoreEventsRef.current = false; }, 600);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, [isHost, playerReady]);

  const loadVideo = () => {
    const id = extractVideoId(urlInput.trim());
    if (!id) { setUrlError('Could not find a valid YouTube video ID. Try pasting the full URL.'); return; }
    setUrlError('');
    setUrlInput('');
    onVideoEvent('video-load', { videoId: id });
    // Also load locally for host immediately
    if (playerRef.current && playerReadyRef.current) {
      prevVideoIdRef.current = id;
      ignoreEventsRef.current = true;
      playerRef.current.loadVideoById({ videoId: id, startSeconds: 0 });
      setTimeout(() => { ignoreEventsRef.current = false; }, 2000);
    }
  };

  const hasVideo = !!videoState?.videoId;

  return (
    <div style={S.container}>
      {isHost && (
        <div style={S.urlBar}>
          <input
            style={S.urlInput}
            placeholder="Paste any YouTube URL here and press Enter…"
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && loadVideo()}
          />
          <button style={S.loadBtn} onClick={loadVideo}>Load ▶</button>
        </div>
      )}
      {urlError && <div style={S.urlError}>⚠ {urlError}</div>}

      <div style={S.playerWrapper}>
        {!hasVideo && (
          <div style={S.placeholder}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🎬</div>
            <div style={{ color: 'var(--text2)', fontSize: 15, maxWidth: 340, lineHeight: 1.6 }}>
              {isHost
                ? 'Paste a YouTube URL above to start watching together'
                : 'Waiting for the host to load a video…'}
            </div>
          </div>
        )}
        {/* div is always in DOM so YT player can attach */}
        <div id="yt-player" style={{ width: '100%', height: '100%', display: hasVideo ? 'block' : 'none' }} />
      </div>

      {!isHost && (
        <div style={S.guestNote}>🎮 Host controls playback — you are synced automatically</div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '8px 8px 0' },
  urlBar: { display: 'flex', gap: 8, marginBottom: 6 },
  urlInput: { flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 14, outline: 'none' },
  loadBtn: { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },
  urlError: { color: '#fca5a5', fontSize: 12, marginBottom: 4, padding: '4px 0' },
  playerWrapper: { flex: 1, position: 'relative', background: '#000', borderRadius: 10, overflow: 'hidden', minHeight: 200 },
  placeholder: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32 },
  guestNote: { padding: '5px 0', fontSize: 12, color: 'var(--text2)', textAlign: 'center' },
};
