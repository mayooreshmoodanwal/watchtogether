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
  const total = 1 + others.length;
  const cols = total <= 1 ? 1 : total <= 4 ? 2 : 3;
  const myInfo = participants.find((p) => p.socketId === mySocketId);

  return (
    <div style={{ ...S.grid, gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      <VideoTile
        key="local"
        stream={localStream}
        name={myInfo ? `${myInfo.name} (You)` : 'You'}
        muted={true}
        showMicMuted={micMuted}
        camOff={camOff}
        isLocal={true}
      />
      {others.map((p) => (
        <VideoTile
          key={p.socketId}
          stream={remoteStreams[p.socketId] || null}
          name={p.name}
          muted={false}
          showMicMuted={false}
          camOff={false}
          isLocal={false}
        />
      ))}
    </div>
  );
}

interface TileProps {
  stream: MediaStream | null;
  name: string;
  muted: boolean;
  showMicMuted: boolean;
  camOff: boolean;
  isLocal: boolean;
}

function VideoTile({ stream, name, muted, showMicMuted, camOff, isLocal }: TileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (stream) {
      el.srcObject = stream;
    } else {
      el.srcObject = null;
    }
  }, [stream]);

  const hasVideo = !!stream && stream.getVideoTracks().some((t) => t.enabled) && !camOff;
  const initials = name.replace(' (You)', '').split(' ').map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div style={{ ...S.tile, border: isLocal ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{ ...S.video, display: hasVideo ? 'block' : 'none', transform: isLocal ? 'scaleX(-1)' : 'none' }}
      />
      {!hasVideo && (
        <div style={S.avatar}>
          <span style={S.initials}>{initials}</span>
        </div>
      )}
      <div style={S.nameBar}>
        {showMicMuted && <span style={{ fontSize: 11 }}>🔇</span>}
        {!stream && !isLocal && <span style={{ fontSize: 11 }}>📡</span>}
        <span style={S.nameText}>{name}</span>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  grid: { display: 'grid', gap: 4, padding: '4px 8px 8px', background: 'var(--bg)', height: 200, overflow: 'hidden', flexShrink: 0 },
  tile: { position: 'relative', borderRadius: 8, overflow: 'hidden', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  video: { width: '100%', height: '100%', objectFit: 'cover' },
  avatar: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#2d1b69,#1a1a2e)' },
  initials: { fontSize: 26, fontWeight: 700, color: '#c4b5fd' },
  nameBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '3px 8px', background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', gap: 4 },
  nameText: { color: '#fff', fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
};
