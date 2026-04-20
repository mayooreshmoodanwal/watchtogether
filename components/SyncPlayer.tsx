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
  const s = input.trim();
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
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
  const ignoreRef = useRef(false);
  const prevVideoIdRef = useRef<string | null>(null);
  const vsRef = useRef<VideoState | null>(null);
  const isHostRef = useRef(isHost);

  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { vsRef.current = videoState; }, [videoState]);

  const initPlayer = useCallback(() => {
    if (playerRef.current) return;
    const el = document.getElementById('yt-player');
    if (!el) return;

    playerRef.current = new window.YT.Player('yt-player', {
      height: '100%',
      width: '100%',
      videoId: '',
      playerVars: {
        autoplay: 0,
        controls: 1,
        modestbranding: 1,
        rel: 0,
        enablejsapi: 1,
        playsinline: 1,
        // origin MUST match your deployed domain — set via env or window.location
        origin: typeof window !== 'undefined' ? window.location.origin : '',
      },
      events: {
        onReady: () => {
          playerReadyRef.current = true;
          setPlayerReady(true);
          // If guest joined mid-session, request sync
          if (!isHostRef.current) {
            // handled by parent via request-sync
          }
        },
        onStateChange: (e: any) => {
          if (!isHostRef.current || ignoreRef.current) return;
          if (!playerRef.current) return;
          const YT = window.YT;
          const ct: number = playerRef.current.getCurrentTime() || 0;
          if (e.data === YT.PlayerState.PLAYING) {
            onVideoEvent('video-play', { currentTime: ct });
          } else if (e.data === YT.PlayerState.PAUSED) {
            onVideoEvent('video-pause', { currentTime: ct });
          }
        },
        onError: (e: any) => {
          console.error('[YT] Player error', e.data);
        },
      },
    });
  }, [onVideoEvent]);

  useEffect(() => {
    const load = () => {
      if (window.YT && window.YT.Player) { initPlayer(); return; }
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.getElementById('yt-api')) {
        const s = document.createElement('script');
        s.id = 'yt-api';
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
      }
    };
    load();
    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
      playerReadyRef.current = false;
    };
  }, [initPlayer]);

  // Apply videoState to player
  useEffect(() => {
    if (!playerReady || !videoState || !playerRef.current) return;

    const isNewVideo = videoState.videoId !== prevVideoIdRef.current;

    if (isNewVideo && videoState.videoId) {
      prevVideoIdRef.current = videoState.videoId;
      ignoreRef.current = true;
      const startAt = videoState.playing
        ? Math.max(0, videoState.currentTime + (Date.now() - videoState.updatedAt) / 1000)
        : videoState.currentTime;
      try {
        playerRef.current.loadVideoById({ videoId: videoState.videoId, startSeconds: startAt });
        if (!videoState.playing) {
          setTimeout(() => { try { playerRef.current?.pauseVideo(); } catch {} }, 1200);
        }
      } catch {}
      setTimeout(() => { ignoreRef.current = false; }, 2500);
      return;
    }

    // Sync state for guests
    if (!isHostRef.current && !isNewVideo && videoState.videoId) {
      ignoreRef.current = true;
      try {
        if (videoState.playing) {
          const expected = Math.max(0, videoState.currentTime + (Date.now() - videoState.updatedAt) / 1000);
          playerRef.current.seekTo(expected, true);
          playerRef.current.playVideo();
        } else {
          playerRef.current.seekTo(videoState.currentTime, true);
          playerRef.current.pauseVideo();
        }
      } catch {}
      setTimeout(() => { ignoreRef.current = false; }, 1000);
    }
  }, [videoState, playerReady]);

  // Drift correction for guests every 6s
  useEffect(() => {
    if (isHost || !playerReady) return;
    const id = setInterval(() => {
      const vs = vsRef.current;
      if (!vs?.playing || !vs.videoId || !playerRef.current) return;
      try {
        const cur: number = playerRef.current.getCurrentTime() || 0;
        const exp = vs.currentTime + (Date.now() - vs.updatedAt) / 1000;
        if (Math.abs(cur - exp) > 3) {
          ignoreRef.current = true;
          playerRef.current.seekTo(exp, true);
          setTimeout(() => { ignoreRef.current = false; }, 800);
        }
      } catch {}
    }, 6000);
    return () => clearInterval(id);
  }, [isHost, playerReady]);

  const loadVideo = () => {
    const id = extractVideoId(urlInput);
    if (!id) { setUrlError('Could not find a YouTube video ID — paste the full URL.'); return; }
    setUrlError('');
    setUrlInput('');
    onVideoEvent('video-load', { videoId: id });
    if (playerRef.current && playerReadyRef.current) {
      prevVideoIdRef.current = id;
      ignoreRef.current = true;
      try { playerRef.current.loadVideoById({ videoId: id, startSeconds: 0 }); } catch {}
      setTimeout(() => { ignoreRef.current = false; }, 2500);
    }
  };

  const hasVideo = !!videoState?.videoId;

  return (
    <div style={S.wrap}>
      {isHost && (
        <div style={S.bar}>
          <input
            style={S.urlInput}
            placeholder="Paste any YouTube URL and press Enter…"
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && loadVideo()}
          />
          <button style={S.loadBtn} onClick={loadVideo}>Load ▶</button>
        </div>
      )}
      {urlError && <p style={S.err}>⚠ {urlError}</p>}

      <div style={S.player}>
        {!hasVideo && (
          <div style={S.placeholder}>
            <span style={{ fontSize: 48 }}>🎬</span>
            <span style={S.placeholderText}>
              {isHost ? 'Paste a YouTube URL above to start watching together' : 'Waiting for the host to load a video…'}
            </span>
          </div>
        )}
        {/* Always keep div in DOM so YT can attach */}
        <div id="yt-player" style={{ width: '100%', height: '100%', display: hasVideo ? 'block' : 'none' }} />
      </div>

      {!isHost && hasVideo && (
        <p style={S.guestNote}>🎮 Host controls playback — synced automatically</p>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '8px 8px 0', gap: 6 },
  bar: { display: 'flex', gap: 8, flexShrink: 0 },
  urlInput: { flex: 1, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', minWidth: 0 },
  loadBtn: { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0 },
  err: { color: '#fca5a5', fontSize: 12, flexShrink: 0 },
  player: { flex: 1, position: 'relative', background: '#000', borderRadius: 10, overflow: 'hidden', minHeight: 0 },
  placeholder: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  placeholderText: { color: 'var(--text2)', fontSize: 15, textAlign: 'center', lineHeight: 1.6, maxWidth: 320 },
  guestNote: { fontSize: 11, color: 'var(--text2)', textAlign: 'center', flexShrink: 0, paddingBottom: 2 },
};
