'use client';
import { useState } from 'react';

interface Props {
  code: string;
  isHost: boolean;
  participantCount: number;
  micMuted: boolean;
  camOff: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onLeave: () => void;
  chatOpen: boolean;
  onToggleChat: () => void;
}

export default function RoomHeader({
  code, isHost, participantCount,
  micMuted, camOff, onToggleMic, onToggleCam,
  onLeave, chatOpen, onToggleChat,
}: Props) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <header style={S.bar}>
      {/* Left: brand */}
      <div style={S.left}>
        <span style={{ fontSize: 20 }}>🎬</span>
        <span style={S.brand}>ANTP</span>
        {isHost && <span style={S.hostBadge}>Host</span>}
      </div>

      {/* Center: room code pill */}
      <button style={S.codePill} onClick={copy} title="Click to copy code">
        <span style={S.codeLabel}>Room:</span>
        <span style={S.codeVal}>{code}</span>
        <span style={{ fontSize: 12, color: copied ? 'var(--green)' : 'var(--text2)' }}>{copied ? '✓' : '⧉'}</span>
      </button>

      {/* Right: controls */}
      <div style={S.controls}>
        <span style={{ color: 'var(--text2)', fontSize: 13 }}>👥 {participantCount}</span>
        <IconBtn active={!micMuted} onClick={onToggleMic} icon={micMuted ? '🔇' : '🎤'} title={micMuted ? 'Unmute' : 'Mute'} />
        <IconBtn active={!camOff}  onClick={onToggleCam} icon={camOff  ? '🚫' : '📹'} title={camOff  ? 'Enable cam' : 'Disable cam'} />
        <IconBtn active={chatOpen} onClick={onToggleChat} icon="💬" title="Toggle chat" />
        <button style={S.leaveBtn} onClick={onLeave}>Leave</button>
      </div>
    </header>
  );
}

function IconBtn({ active, onClick, icon, title }: { active: boolean; onClick: () => void; icon: string; title: string }) {
  return (
    <button
      style={{
        ...S.iconBtn,
        background: active ? 'var(--bg3)' : 'rgba(239,68,68,0.15)',
        border: `1px solid ${active ? 'var(--border)' : 'rgba(239,68,68,0.35)'}`,
      }}
      onClick={onClick}
      title={title}
    >
      {icon}
    </button>
  );
}

const S: Record<string, React.CSSProperties> = {
  bar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', gap: 12, flexShrink: 0, zIndex: 10, flexWrap: 'wrap' },
  left: { display: 'flex', alignItems: 'center', gap: 8 },
  brand: { fontWeight: 800, fontSize: 17, letterSpacing: 1, background: 'linear-gradient(90deg,#fff,#c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  hostBadge: { background: 'rgba(124,58,237,0.25)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.45)', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 },
  codePill: { display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 14px', cursor: 'pointer', color: 'var(--text)', fontSize: 14, transition: 'border-color 0.2s' },
  codeLabel: { color: 'var(--text2)', fontSize: 12 },
  codeVal: { fontWeight: 800, letterSpacing: '0.14em', fontSize: 15, color: '#c4b5fd' },
  controls: { display: 'flex', alignItems: 'center', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: '50%', fontSize: 15, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  leaveBtn: { background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
};
