'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import type { Participant, ChatMessage, VideoState } from '@/lib/types';
import VideoGrid from '@/components/VideoGrid';
import SyncPlayer from '@/components/SyncPlayer';
import ChatPanel from '@/components/ChatPanel';
import RoomHeader from '@/components/RoomHeader';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const [joined, setJoined]         = useState(false);
  const [isHost, setIsHost]         = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [videoState, setVideoState] = useState<VideoState | null>(null);
  const [error, setError]           = useState('');
  const [chatOpen, setChatOpen]     = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [micMuted, setMicMuted]     = useState(false);
  const [camOff, setCamOff]         = useState(false);
  const [mySocketId, setMySocketId] = useState('');
  const [namePrompt, setNamePrompt] = useState('');
  const [showNameDialog, setShowNameDialog] = useState(false);

  const peersRef      = useRef<Record<string, RTCPeerConnection>>({});
  const localRef      = useRef<MediaStream | null>(null);
  const codeRef       = useRef(code);
  const joinedRef     = useRef(false);

  useEffect(() => { codeRef.current = code; }, [code]);

  // ── ICE servers ──
  const getIce = useCallback((): RTCIceServer[] => {
    const base: RTCIceServer[] = [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ];
    const url = process.env.NEXT_PUBLIC_TURN_URL;
    if (url) {
      base.push({
        urls: url,
        username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '',
      });
    }
    return base;
  }, []);

  // ── Create peer connection ──
  const createPeer = useCallback((targetId: string, initiator: boolean) => {
    const socket = getSocket();

    // Close old connection cleanly
    if (peersRef.current[targetId]) {
      try { peersRef.current[targetId].close(); } catch {}
      delete peersRef.current[targetId];
    }

    const pc = new RTCPeerConnection({ iceServers: getIce(), iceCandidatePoolSize: 10 });

    // Add ALL local tracks
    if (localRef.current) {
      localRef.current.getTracks().forEach((track) => {
        try { pc.addTrack(track, localRef.current!); } catch {}
      });
    }

    // Receive remote tracks
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        setRemoteStreams((prev) => ({ ...prev, [targetId]: stream }));
      }
    };

    // Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice', { to: targetId, candidate: event.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'failed') {
        // Try ICE restart
        if (initiator) {
          pc.restartIce();
          pc.createOffer({ iceRestart: true })
            .then((o) => pc.setLocalDescription(o))
            .then(() => socket.emit('webrtc-offer', { to: targetId, offer: pc.localDescription }))
            .catch(() => {});
        }
      }
      if (state === 'closed' || state === 'disconnected') {
        setRemoteStreams((prev) => {
          const n = { ...prev }; delete n[targetId]; return n;
        });
      }
    };

    peersRef.current[targetId] = pc;

    if (initiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => socket.emit('webrtc-offer', { to: targetId, offer: pc.localDescription }))
        .catch((e) => console.error('[webrtc] offer error', e));
    }

    return pc;
  }, [getIce]);

  // ── Get local media ──
  const initMedia = useCallback(async () => {
    // Try video+audio first, then audio-only, then nothing
    const constraints = [
      { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: true },
      { video: false, audio: true },
    ];
    for (const c of constraints) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(c);
        localRef.current = stream;
        setLocalStream(stream);
        return stream;
      } catch {}
    }
    // No media — create a silent empty stream so WebRTC still connects
    try {
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      const stream = dest.stream;
      localRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch {}
    return null;
  }, []);

  // ── Join room ──
  const joinRoom = useCallback((roomName: string) => {
    if (joinedRef.current) return;
    const socket = getSocket();

    const doJoin = () => {
      socket.emit('join-room', { code, name: roomName }, (res: any) => {
        if (res?.error) { setError(res.error); return; }
        joinedRef.current = true;
        setMySocketId(socket.id || '');
        setIsHost(res.isHost);
        setParticipants(res.participants || []);
        setMessages(res.messages || []);
        if (res.videoState?.videoId) setVideoState(res.videoState);
        setJoined(true);

        // Connect to all existing peers
        (res.participants || []).forEach((p: Participant) => {
          if (p.socketId !== socket.id) {
            createPeer(p.socketId, true);
          }
        });

        // If guest and video was already playing, request sync
        if (!res.isHost && res.videoState?.videoId) {
          setTimeout(() => socket.emit('request-sync', { code }), 1000);
        }
      });
    };

    if (socket.connected) doJoin();
    else socket.once('connect', doJoin);
  }, [code, createPeer]);

  // ── Boot ──
  useEffect(() => {
    const savedName = localStorage.getItem('antp-name');
    if (savedName) {
      initMedia().then(() => joinRoom(savedName));
    } else {
      setShowNameDialog(true);
    }

    return () => {
      Object.values(peersRef.current).forEach((pc) => { try { pc.close(); } catch {} });
      peersRef.current = {};
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
      joinedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Socket listeners (after join) ──
  useEffect(() => {
    if (!joined) return;
    const socket = getSocket();

    const onParticipantJoined = ({ participants: p }: any) => {
      setParticipants(p);
    };

    const onParticipantLeft = ({ socketId, participants: p }: any) => {
      setParticipants(p);
      setRemoteStreams((prev) => { const n = { ...prev }; delete n[socketId]; return n; });
      if (peersRef.current[socketId]) {
        try { peersRef.current[socketId].close(); } catch {}
        delete peersRef.current[socketId];
      }
    };

    const onHostChanged = ({ hostId }: any) => {
      setIsHost(hostId === socket.id);
    };

    const onOffer = async ({ from, offer }: any) => {
      const pc = createPeer(from, false);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { to: from, answer: pc.localDescription });
      } catch (e) { console.error('[webrtc] answer error', e); }
    };

    const onAnswer = async ({ from, answer }: any) => {
      const pc = peersRef.current[from];
      if (!pc) return;
      // Only set if we're waiting for an answer
      if (pc.signalingState === 'have-local-offer') {
        try { await pc.setRemoteDescription(new RTCSessionDescription(answer)); }
        catch (e) { console.error('[webrtc] setRemote error', e); }
      }
    };

    const onIce = async ({ from, candidate }: any) => {
      const pc = peersRef.current[from];
      if (!pc || !candidate) return;
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch {} // benign
    };

    const onChatMessage = (msg: ChatMessage) => setMessages((p) => [...p, msg]);
    const onChatReaction = ({ messageId, reactions }: any) =>
      setMessages((p) => p.map((m) => m.id === messageId ? { ...m, reactions } : m));

    const onVideoLoad  = ({ videoId }: any) =>
      setVideoState({ videoId, playing: false, currentTime: 0, updatedAt: Date.now() });
    const onVideoPlay  = ({ currentTime, timestamp }: any) =>
      setVideoState((p) => p ? { ...p, playing: true, currentTime: currentTime + (Date.now() - timestamp) / 1000, updatedAt: Date.now() } : p);
    const onVideoPause = ({ currentTime }: any) =>
      setVideoState((p) => p ? { ...p, playing: false, currentTime, updatedAt: Date.now() } : p);
    const onVideoSeek  = ({ currentTime, timestamp }: any) =>
      setVideoState((p) => p ? { ...p, currentTime: currentTime + (Date.now() - timestamp) / 1000, updatedAt: Date.now() } : p);
    const onVideoState = (state: VideoState) => setVideoState(state);

    socket.on('participant-joined', onParticipantJoined);
    socket.on('participant-left',   onParticipantLeft);
    socket.on('host-changed',       onHostChanged);
    socket.on('webrtc-offer',       onOffer);
    socket.on('webrtc-answer',      onAnswer);
    socket.on('webrtc-ice',         onIce);
    socket.on('chat-message',       onChatMessage);
    socket.on('chat-reaction',      onChatReaction);
    socket.on('video-load',         onVideoLoad);
    socket.on('video-play',         onVideoPlay);
    socket.on('video-pause',        onVideoPause);
    socket.on('video-seek',         onVideoSeek);
    socket.on('video-state',        onVideoState);

    return () => {
      socket.off('participant-joined', onParticipantJoined);
      socket.off('participant-left',   onParticipantLeft);
      socket.off('host-changed',       onHostChanged);
      socket.off('webrtc-offer',       onOffer);
      socket.off('webrtc-answer',      onAnswer);
      socket.off('webrtc-ice',         onIce);
      socket.off('chat-message',       onChatMessage);
      socket.off('chat-reaction',      onChatReaction);
      socket.off('video-load',         onVideoLoad);
      socket.off('video-play',         onVideoPlay);
      socket.off('video-pause',        onVideoPause);
      socket.off('video-seek',         onVideoSeek);
      socket.off('video-state',        onVideoState);
    };
  }, [joined, code, createPeer]);

  const toggleMic = () => {
    const newMuted = !micMuted;
    localRef.current?.getAudioTracks().forEach((t) => { t.enabled = !newMuted; });
    setMicMuted(newMuted);
  };

  const toggleCam = () => {
    const newOff = !camOff;
    localRef.current?.getVideoTracks().forEach((t) => { t.enabled = !newOff; });
    setCamOff(newOff);
  };

  const sendMessage  = useCallback((text: string) => getSocket().emit('chat-message', { code, text }), [code]);
  const sendReaction = useCallback((msgId: string, emoji: string) => getSocket().emit('chat-reaction', { code, messageId: msgId, emoji }), [code]);
  const onVideoEvent = useCallback((event: string, data: any) => getSocket().emit(event, { code, ...data }), [code]);

  const handleNameSubmit = () => {
    const t = namePrompt.trim();
    if (!t) return;
    localStorage.setItem('antp-name', t);
    setShowNameDialog(false);
    initMedia().then(() => joinRoom(t));
  };

  // ── Error ──
  if (error) return (
    <div style={S.center}>
      <span style={{ fontSize: 48 }}>😕</span>
      <p style={{ color: '#fca5a5', textAlign: 'center', maxWidth: 300 }}>{error}</p>
      <button onClick={() => router.push('/')} style={S.accentBtn}>Go Home</button>
    </div>
  );

  // ── Name dialog ──
  if (showNameDialog) return (
    <div style={S.center}>
      <div style={S.dialog}>
        <span style={{ fontSize: 36, textAlign: 'center' }}>👋</span>
        <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: 20 }}>What's your name?</h2>
        <input autoFocus style={S.dialogInput} placeholder="Your display name"
          value={namePrompt} maxLength={24}
          onChange={(e) => setNamePrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()} />
        <button onClick={handleNameSubmit} style={S.accentBtn}>Join Room →</button>
      </div>
    </div>
  );

  // ── Connecting ──
  if (!joined) return (
    <div style={S.center}>
      <span style={{ fontSize: 40 }}>⏳</span>
      <p style={{ color: 'var(--text2)' }}>Connecting to <strong>{code}</strong>…</p>
    </div>
  );

  // ── Main UI ──
  return (
    <div style={S.root}>
      <RoomHeader
        code={code} isHost={isHost} participantCount={participants.length}
        micMuted={micMuted} camOff={camOff}
        onToggleMic={toggleMic} onToggleCam={toggleCam}
        onLeave={() => router.push('/')}
        chatOpen={chatOpen} onToggleChat={() => setChatOpen((o) => !o)}
      />
      <div style={S.body}>
        <div style={S.left}>
          <SyncPlayer code={code} isHost={isHost} videoState={videoState} onVideoEvent={onVideoEvent} />
          <VideoGrid
            localStream={localStream} remoteStreams={remoteStreams}
            participants={participants} mySocketId={mySocketId}
            micMuted={micMuted} camOff={camOff}
          />
        </div>
        {chatOpen && (
          <ChatPanel
            messages={messages} mySocketId={mySocketId}
            onSend={sendMessage} onReact={sendReaction}
          />
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root:        { height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' },
  body:        { flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 },
  left:        { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  center:      { minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  dialog:      { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 14 },
  dialogInput: { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '12px 14px', color: 'var(--text)', fontSize: 15, outline: 'none' },
  accentBtn:   { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
};
