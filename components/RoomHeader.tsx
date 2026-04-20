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

export default function RoomHeader({ code, isHost, participantCount, micMuted, camOff, onToggleMic, onToggleCam, onLeave, chatOpen, onToggleChat }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <header style={S.bar}>
      <div style={S.left}>
        <span style={{ fontSize: 18 }}>🎬</span>
        <span style={S.brand}>ANTP</span>
        {isHost && <span style={S.badge}>Host</span>}
      </div>

      <button style={S.codePill} onClick={copy} title="Click to copy">
        <span style={S.codeLabel}>Room:</span>
        <span style={S.codeVal}>{code}</span>
        <span style={{ fontSize: 11, color: copied ? 'var(--green)' : 'var(--text2)', marginLeft: 2 }}>
          {copied ? '✓' : '⧉'}
        </span>
      </button>

      <div style={S.controls}>
        <span style={S.count}>👥 {participantCount}</span>
        <Btn active={!micMuted} onClick={onToggleMic} label={micMuted ? '🔇' : '🎤'} title={micMuted ? 'Unmute' : 'Mute'} />
        <Btn active={!camOff}  onClick={onToggleCam}  label={camOff  ? '🚫' : '📹'} title={camOff ? 'Enable cam' : 'Cam off'} />
        <Btn active={chatOpen} onClick={onToggleChat}  label="💬"                    title="Toggle chat" />
        <button style={S.leave} onClick={onLeave}>Leave</button>
      </div>
    </header>
  );
}

function Btn({ active, onClick, label, title }: { active: boolean; onClick: () => void; label: string; title: string }) {
  return (
    <button
      onClick={onClick} title={title}
      style={{
        ...S.iconBtn,
        background: active ? 'var(--bg3)' : 'rgba(239,68,68,0.18)',
        border: `1px solid ${active ? 'var(--border)' : 'rgba(239,68,68,0.4)'}`,
      }}
    >{label}</button>
  );
}

const S: Record<string, React.CSSProperties> = {
  bar:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', gap: 8, flexShrink: 0, flexWrap: 'wrap' },
  left:     { display: 'flex', alignItems: 'center', gap: 6 },
  brand:    { fontWeight: 800, fontSize: 16, letterSpacing: 1.5, background: 'linear-gradient(90deg,#fff,#c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  badge:    { background: 'rgba(124,58,237,0.25)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 },
  codePill: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 12px', cursor: 'pointer', color: 'var(--text)', fontSize: 13 },
  codeLabel:{ color: 'var(--text2)', fontSize: 11 },
  codeVal:  { fontWeight: 800, letterSpacing: '0.14em', fontSize: 14, color: '#c4b5fd' },
  controls: { display: 'flex', alignItems: 'center', gap: 6 },
  count:    { color: 'var(--text2)', fontSize: 12, marginRight: 2 },
  iconBtn:  { width: 34, height: 34, borderRadius: '50%', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 },
  leave:    { background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 },
};
