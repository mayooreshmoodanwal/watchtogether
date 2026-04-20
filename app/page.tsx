'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('antp-name');
    if (saved) setName(saved);
  }, []);

  const saveName = (n: string) => {
    setName(n);
    localStorage.setItem('antp-name', n);
  };

  const handleCreate = () => {
    if (!name.trim()) { setError('Please enter your name first.'); return; }
    setLoading(true); setError('');
    const socket = getSocket();

    const doCreate = () => {
      socket.emit('create-room', { name: name.trim() }, (res: any) => {
        if (res?.error) { setError(res.error); setLoading(false); return; }
        router.push(`/room/${res.code}`);
      });
    };

    if (socket.connected) { doCreate(); }
    else { socket.once('connect', doCreate); }
  };

  const handleJoin = () => {
    if (!name.trim()) { setError('Please enter your name first.'); return; }
    if (code.trim().length !== 6) { setError('Room code must be 6 characters.'); return; }
    setLoading(true); setError('');
    const socket = getSocket();

    const doJoin = () => {
      socket.emit('join-room', { code: code.trim().toUpperCase(), name: name.trim() }, (res: any) => {
        if (res?.error) { setError(res.error); setLoading(false); return; }
        router.push(`/room/${code.trim().toUpperCase()}`);
      });
    };

    if (socket.connected) { doJoin(); }
    else { socket.once('connect', doJoin); }
  };

  return (
    <main style={S.main}>
      {/* Hero */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 10 }}>🎬</div>
        <h1 style={S.title}>ANTP</h1>
        <p style={S.subtitle}>Watch YouTube with your crew — synced video, live calls & real-time chat</p>
      </div>

      {/* Card */}
      <div style={S.card}>
        {/* Tabs */}
        <div style={S.tabs}>
          {(['create', 'join'] as const).map((t) => (
            <button
              key={t}
              style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}
              onClick={() => { setTab(t); setError(''); setLoading(false); }}
            >
              {t === 'create' ? '✦ Create Room' : '→ Join Room'}
            </button>
          ))}
        </div>

        <div style={S.fields}>
          <label style={S.label}>Your Name</label>
          <input
            style={S.input}
            placeholder="Enter your display name"
            value={name}
            maxLength={24}
            onChange={(e) => saveName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (tab === 'create' ? handleCreate() : handleJoin())}
          />

          {tab === 'join' && (
            <>
              <label style={S.label}>Room Code</label>
              <input
                style={{ ...S.input, textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700, fontSize: 18 }}
                placeholder="XXXXXX"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              />
            </>
          )}

          {error && <div style={S.errorBox}>{error}</div>}

          <button
            style={{ ...S.btn, opacity: loading ? 0.6 : 1 }}
            onClick={tab === 'create' ? handleCreate : handleJoin}
            disabled={loading}
          >
            {loading ? 'Connecting…' : tab === 'create' ? '✦ Create Room' : '→ Join Room'}
          </button>
        </div>
      </div>

      {/* Feature highlights */}
      <div style={S.features}>
        {[
          ['📹', 'Live Video Calls', 'See everyone in real time while you watch'],
          ['▶️', 'Synced Playback', 'YouTube stays perfectly in sync for all'],
          ['💬', 'Live Chat + Emoji', 'Chat, react and express yourself'],
        ].map(([icon, title, desc]) => (
          <div key={String(title)} style={S.feat}>
            <span style={{ fontSize: 26 }}>{icon}</span>
            <strong style={{ fontSize: 13, color: 'var(--text)' }}>{title}</strong>
            <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{desc}</span>
          </div>
        ))}
      </div>

      <p style={{ color: 'var(--text2)', fontSize: 13 }}>Chrome &amp; Brave only · No install · Up to 8 people</p>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  main: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', gap: '1.75rem' },
  title: { fontSize: 'clamp(36px,6vw,56px)', fontWeight: 900, background: 'linear-gradient(130deg,#fff 0%,#c4b5fd 60%,#7c3aed 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: 2, marginBottom: 8 },
  subtitle: { color: 'var(--text2)', fontSize: 16, maxWidth: 420, lineHeight: 1.6 },
  card: { width: '100%', maxWidth: 420, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' },
  tabs: { display: 'flex', borderBottom: '1px solid var(--border)' },
  tab: { flex: 1, padding: '13px', background: 'none', border: 'none', color: 'var(--text2)', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' },
  tabActive: { color: 'var(--text)', borderBottom: '2px solid var(--accent)', background: 'rgba(124,58,237,0.1)' },
  fields: { padding: '22px', display: 'flex', flexDirection: 'column', gap: 10 },
  label: { fontSize: 12, color: 'var(--text2)', fontWeight: 600, letterSpacing: 0.5 },
  input: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px 14px', color: 'var(--text)', fontSize: 15, outline: 'none', width: '100%', transition: 'border-color 0.2s' },
  errorBox: { color: '#fca5a5', fontSize: 13, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 12px' },
  btn: { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '13px', fontSize: 15, fontWeight: 700, marginTop: 4, cursor: 'pointer', transition: 'opacity 0.2s, background 0.2s', letterSpacing: 0.4 },
  features: { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 680 },
  feat: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6, width: 200, textAlign: 'center', alignItems: 'center' },
};
