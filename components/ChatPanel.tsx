'use client';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/lib/types';

interface Props {
  messages: ChatMessage[];
  mySocketId: string;
  onSend: (text: string) => void;
  onReact: (messageId: string, emoji: string) => void;
}

const EMOJIS = ['👍','❤️','😂','😮','😢','🔥','🎉','👏','😍','🤔','😎','🥳','😭','💀','🥺','💯','🙏','✌️','💪','🫶','😡','🤯','🫠','🤩'];
const REACT_EMOJIS = ['👍','❤️','😂','😮','😢','🔥','🎉','👏'];

export default function ChatPanel({ messages, mySocketId, onSend, onReact }: Props) {
  const [input, setInput]             = useState('');
  const [emojiOpen, setEmojiOpen]     = useState(false);
  const [reactFor, setReactFor]       = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-p]')) {
        setEmojiOpen(false); setReactFor(null);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const send = () => {
    const t = input.trim();
    if (!t) return;
    onSend(t); setInput(''); setEmojiOpen(false);
    inputRef.current?.focus();
  };

  const fmt = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={S.panel}>
      <div style={S.head}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>💬 Chat</span>
        <span style={{ fontSize: 11, color: 'var(--text2)' }}>{messages.length}</span>
      </div>

      <div style={S.msgs}>
        {messages.length === 0 && <p style={S.empty}>No messages yet — say hi! 👋</p>}
        {messages.map((msg) => {
          const mine = msg.senderId === mySocketId;
          const hasReact = Object.keys(msg.reactions).length > 0;
          return (
            <div key={msg.id} style={{ ...S.row, alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <div style={S.meta}>
                {!mine && <span style={S.name}>{msg.senderName}</span>}
                <span style={S.time}>{fmt(msg.timestamp)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, flexDirection: mine ? 'row-reverse' : 'row' }}>
                <div style={{ ...S.bubble, background: mine ? 'var(--accent)' : 'var(--bg3)', borderRadius: mine ? '14px 14px 3px 14px' : '14px 14px 14px 3px' }}>
                  <span style={S.msgText}>{msg.text}</span>
                </div>
                {/* Reaction button */}
                <div data-p style={{ position: 'relative' }}>
                  <button style={S.reactBtn} onClick={() => setReactFor(reactFor === msg.id ? null : msg.id)}>+</button>
                  {reactFor === msg.id && (
                    <div data-p style={{ ...S.quickPick, [mine ? 'right' : 'left']: 0 }}>
                      {REACT_EMOJIS.map((e) => (
                        <button key={e} style={S.qe} onClick={() => { onReact(msg.id, e); setReactFor(null); }}>{e}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {hasReact && (
                <div style={S.pills}>
                  {Object.entries(msg.reactions).map(([emoji, users]) =>
                    (users as string[]).length > 0 ? (
                      <button key={emoji}
                        style={{ ...S.pill, background: (users as string[]).includes(mySocketId) ? 'rgba(124,58,237,0.3)' : 'var(--bg3)', border: `1px solid ${(users as string[]).includes(mySocketId) ? 'var(--accent)' : 'var(--border)'}` }}
                        onClick={() => onReact(msg.id, emoji)}>
                        {emoji} <span style={{ fontSize: 10 }}>{(users as string[]).length}</span>
                      </button>
                    ) : null
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={S.inputRow}>
        <div data-p style={{ position: 'relative', flexShrink: 0 }}>
          <button style={S.emojiBtn} onClick={() => { setEmojiOpen((v) => !v); setReactFor(null); }}>😊</button>
          {emojiOpen && (
            <div data-p style={S.picker}>
              {EMOJIS.map((e) => (
                <button key={e} style={S.pe} onClick={() => { setInput((v) => v + e); setEmojiOpen(false); inputRef.current?.focus(); }}>{e}</button>
              ))}
            </div>
          )}
        </div>
        <input ref={inputRef} style={S.inp} placeholder="Message…" value={input} maxLength={500}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button style={{ ...S.sendBtn, opacity: input.trim() ? 1 : 0.35 }} onClick={send}>↑</button>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  panel:    { width: 'clamp(240px, 28vw, 300px)', minWidth: 240, display: 'flex', flexDirection: 'column', background: 'var(--bg2)', borderLeft: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 },
  head:     { padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
  msgs:     { flex: 1, overflowY: 'auto', padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 8 },
  empty:    { textAlign: 'center', color: 'var(--text2)', fontSize: 13, marginTop: 40, lineHeight: 1.6 },
  row:      { display: 'flex', flexDirection: 'column', gap: 3 },
  meta:     { display: 'flex', gap: 6, paddingInline: 2 },
  name:     { fontSize: 11, fontWeight: 700, color: '#c4b5fd' },
  time:     { fontSize: 10, color: 'var(--text2)' },
  bubble:   { maxWidth: 190, padding: '7px 11px', wordBreak: 'break-word' },
  msgText:  { fontSize: 13, lineHeight: 1.45, color: '#fff', whiteSpace: 'pre-wrap' },
  pills:    { display: 'flex', flexWrap: 'wrap', gap: 3, paddingInline: 2 },
  pill:     { borderRadius: 20, padding: '2px 6px', fontSize: 12, cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 2 },
  reactBtn: { width: 20, height: 20, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  quickPick:{ position: 'absolute', bottom: '100%', marginBottom: 4, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: 5, display: 'flex', gap: 2, zIndex: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' },
  qe:       { width: 28, height: 28, border: 'none', background: 'none', fontSize: 16, cursor: 'pointer', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  inputRow: { padding: '8px 8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 },
  emojiBtn: { width: 32, height: 32, borderRadius: 7, background: 'var(--bg3)', border: '1px solid var(--border)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  picker:   { position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 6, display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 2, width: 216, zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' },
  pe:       { width: 32, height: 32, border: 'none', background: 'none', fontSize: 16, cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  inp:      { flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 20, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', minWidth: 0 },
  sendBtn:  { width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'opacity 0.15s' },
};
