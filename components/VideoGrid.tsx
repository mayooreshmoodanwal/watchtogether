'use client';
import { useEffect, useRef } from 'react';
import type { Participant } from '@/lib/types';

interface Props {
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  participants: Participant[];
  mySocketId: string;
  micMuted: boolean;
  camOff: boolean;
}

export default function VideoGrid({ localStream, remoteStreams, participants, mySocketId, micMuted, camOff }: Props) {
  const others = participants.filter((p) => p.socketId !== mySocketId);
  const myInfo = participants.find((p) => p.socketId === mySocketId);

  return (
    <div style={S.strip}>
      {/* Local tile */}
      <Tile
        stream={localStream}
        label={myInfo?.name ? `${myInfo.name} (You)` : 'You'}
        muted={true}
        micMuted={micMuted}
        camOff={camOff}
        isLocal={true}
      />
      {/* Remote tiles */}
      {others.map((p) => (
        <Tile
          key={p.socketId}
          stream={remoteStreams[p.socketId] || null}
          label={p.name}
          muted={false}
          micMuted={false}
          camOff={false}
          isLocal={false}
        />
      ))}
    </div>
  );
}

function Tile({ stream, label, muted, micMuted, camOff, isLocal }: {
  stream: MediaStream | null;
  label: string;
  muted: boolean;
  micMuted: boolean;
  camOff: boolean;
  isLocal: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [stream]);

  const hasVideo = !!stream &&
    stream.getVideoTracks().length > 0 &&
    stream.getVideoTracks().some((t) => t.enabled) &&
    !(isLocal && camOff);

  const initials = label
    .replace(' (You)', '')
    .split(' ')
    .map((w) => w[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  const shortLabel = label.length > 12 ? label.slice(0, 10) + '…' : label;

  return (
    <div style={S.tileWrap}>
      <div style={{
        ...S.circle,
        border: isLocal ? '2.5px solid var(--accent)' : '2px solid var(--border2)',
        boxShadow: isLocal ? '0 0 0 3px rgba(124,58,237,0.25)' : 'none',
      }}>
        {/* Video element always present */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          style={{
            ...S.video,
            display: hasVideo ? 'block' : 'none',
            transform: isLocal ? 'scaleX(-1)' : 'none',
          }}
        />
        {/* Avatar fallback */}
        {!hasVideo && (
          <div style={S.avatar}>
            <span style={S.initials}>{initials}</span>
          </div>
        )}
        {/* Mic muted overlay */}
        {micMuted && (
          <div style={S.muteBadge}>🔇</div>
        )}
        {/* Connecting indicator for remote with no stream yet */}
        {!isLocal && !stream && (
          <div style={S.connecting}>📡</div>
        )}
      </div>
      <span style={S.label}>{shortLabel}</span>
    </div>
  );
}

const SIZE = 88;

const S: Record<string, React.CSSProperties> = {
  strip: {
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    padding: '8px 12px',
    overflowX: 'auto',
    overflowY: 'hidden',
    background: 'var(--bg)',
    flexShrink: 0,
    alignItems: 'center',
    minHeight: SIZE + 36,
  },
  tileWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: '50%',
    overflow: 'hidden',
    background: 'linear-gradient(135deg,#1e1040,#0a0a14)',
    position: 'relative',
    flexShrink: 0,
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatar: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg,#2d1b69,#1a1a2e)',
  },
  initials: {
    fontSize: 26,
    fontWeight: 700,
    color: '#c4b5fd',
  },
  muteBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    fontSize: 13,
    background: 'rgba(0,0,0,0.7)',
    borderRadius: '50%',
    width: 22,
    height: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connecting: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    background: 'rgba(0,0,0,0.5)',
  },
  label: {
    fontSize: 11,
    color: 'var(--text2)',
    maxWidth: SIZE,
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
