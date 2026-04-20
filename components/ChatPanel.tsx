'use client';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/lib/types';

interface Props {
  messages: ChatMessage[];
  mySocketId: string;
  onSend: (text: string) => void;
  onReact: (messageId: string, emoji: string) => void;
}

const QUICK_EMOJIS = ['👍','❤️','😂','😮','😢','🔥','🎉','👏','😍','🤔','😎','🥳','😭','🤣','💀','🫠','🥺','😡','🤯','💯','🙏','✌️','💪','🫶'];

export default function ChatPanel({ messages, mySocketId, onSend, onReact }: Props) {
  const [input, setInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactionFor, setReactionFor] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close pickers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-picker]')) {
        setShowEmojiPicker(false);
        setReactionFor(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const fmt = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={S.panel}>
      <div style={S.header}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>💬 Chat</span>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{messages.length} msgs</span>
      </div>

      <div style={S.messages}>
        {messages.length === 0 && (
          <div style={S.empty}>No messages yet — say hi! 👋</div>
        )}
        {messages.map((msg) => {
          const mine = msg.senderId === mySocketId;
          return (
            <div key={msg.id} style={{ ...S.msgWrap, alignItems: mine ? 'flex-end' : 'flex-start' }}>
              {/* Sender + time */}
              <div style={S.meta}>
                {!mine && <span style={S.sender}>{msg.senderName}</span>}
                <span style={S.time}>{fmt(msg.timestamp)}</span>
              </div>

              {/* Bubble + reaction trigger */}
              <div style={S.bubbleRow}>
                {mine && <ReactionTrigger msgId={msg.id} reactionFor={reactionFor} setReactionFor={setReactionFor} onReact={onReact} />}
                <div style={{ ...S.bubble, background: mine ? 'var(--accent)' : 'var(--bg3)', borderRadius: mine ? '14px 14px 2px 14px' : '14px 14px 14px 2px' }}>
                  <span style={S.msgText}>{msg.text}</span>
                </div>
                {!mine && <ReactionTrigger msgId={msg.id} reactionFor={reactionFor} setReactionFor={setReactionFor} onReact={onReact} />}
              </div>

              {/* Reactions */}
              {Object.keys(msg.reactions).length > 0 && (
                <div style={S.reactions}>
                  {Object.entries(msg.reactions).map(([emoji, users]) =>
                    (users as string[]).length > 0 ? (
                      <button
                        key={emoji}
                        style={{ ...S.pill, background: (users as string[]).includes(mySocketId) ? 'rgba(124,58,237,0.35)' : 'var(--bg3)', border: `1px solid ${(users as string[]).includes(mySocketId) ? 'var(--accent)' : 'var(--border)'}` }}
                        onClick={() => onReact(msg.id, emoji)}
                      >
                        {emoji} <span style={{ fontSize: 11 }}>{(users as string[]).length}</span>
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

      {/* Input area */}
      <div style={S.inputArea}>
        {/* Emoji picker button */}
        <div data-picker style={{ position: 'relative', flexShrink: 0 }}>
          <button
            style={S.emojiBtn}
            onClick={() => { setShowEmojiPicker((v) => !v); setReactionFor(null); }}
            title="Emoji"
          >
            😊
          </button>
          {showEmojiPicker && (
            <div data-picker style={S.emojiGrid}>
              {QUICK_EMOJIS.map((e) => (
                <button key={e} style={S.emojiCell} onClick={() => insertEmoji(e)}>{e}</button>
              ))}
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          style={S.chatInput}
          placeholder="Message…"
          value={input}
          maxLength={500}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
        <button style={{ ...S.sendBtn, opacity: input.trim() ? 1 : 0.4 }} onClick={handleSend}>↑</button>
      </div>
    </div>
  );
}

function ReactionTrigger({ msgId, reactionFor, setReactionFor, onReact }: {
  msgId: string;
  reactionFor: string | null;
  setReactionFor: (id: string | null) => void;
  onReact: (id: string, emoji: string) => void;
}) {
  return (
    <div data-picker style={{ position: 'relative', flexShrink: 0 }}>
      <button
        style={S.reactBtn}
        onClick={() => setReactionFor(reactionFor === msgId ? null : msgId)}
        title="React"
      >
        +
      </button>
      {reactionFor === msgId && (
        <div data-picker style={S.quickPicker}>
          {['👍','❤️','😂','😮','😢','🔥','🎉','👏'].map((e) => (
            <button key={e} style={S.emojiCell} onClick={() => { onReact(msgId, e); setReactionFor(null); }}>{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  panel: { width: 300, minWidth: 300, display: 'flex', flexDirection: 'column', background: 'var(--bg2)', borderLeft: '1px solid var(--border)', overflow: 'hidden' },
  header: { padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  messages: { flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 },
  empty: { textAlign: 'center', color: 'var(--text2)', fontSize: 13, marginTop: 48, lineHeight: 1.6 },
  msgWrap: { display: 'flex', flexDirection: 'column', gap: 2 },
  meta: { display: 'flex', gap: 6, alignItems: 'baseline', paddingLeft: 2, paddingRight: 2 },
  sender: { fontSize: 12, fontWeight: 600, color: '#c4b5fd' },
  time: { fontSize: 10, color: 'var(--text2)' },
  bubbleRow: { display: 'flex', alignItems: 'flex-end', gap: 4 },
  bubble: { maxWidth: 200, padding: '8px 11px', wordBreak: 'break-word' },
  msgText: { fontSize: 14, lineHeight: 1.45, color: '#fff', whiteSpace: 'pre-wrap' },
  reactions: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2, paddingLeft: 2 },
  pill: { borderRadius: 20, padding: '2px 7px', fontSize: 13, cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 3 },
  inputArea: { padding: '8px 10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 },
  emojiBtn: { width: 34, height: 34, borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emojiGrid: { position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 6, display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 2, width: 222, zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' },
  quickPicker: { position: 'absolute', bottom: '100%', left: 0, marginBottom: 4, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 6, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 2, width: 156, zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' },
  emojiCell: { width: 32, height: 32, border: 'none', background: 'transparent', fontSize: 17, cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s' },
  chatInput: { flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 20, padding: '8px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', minWidth: 0 },
  reactBtn: { width: 22, height: 22, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0 },
  sendBtn: { width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 17, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'opacity 0.15s' },
};
