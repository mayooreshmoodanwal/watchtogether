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

  const [joined, setJoined] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [hostId, setHostId] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [videoState, setVideoState] = useState<VideoState | null>(null);
  const [error, setError] = useState('');
  const [chatOpen, setChatOpen] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [namePrompt, setNamePrompt] = useState('');
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [mySocketId, setMySocketId] = useState('');

  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const codeRef = useRef(code);

  // Keep codeRef in sync
  useEffect(() => { codeRef.current = code; }, [code]);

  const getIceServers = useCallback(() => {
    const servers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
    if (process.env.NEXT_PUBLIC_TURN_URL) {
      servers.push({
        urls: process.env.NEXT_PUBLIC_TURN_URL as string,
        username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '',
      });
    }
    return servers;
  }, []);

  const createPeer = useCallback((targetId: string, initiator: boolean) => {
    const socket = getSocket();
    // Close existing connection if any
    if (peersRef.current[targetId]) {
      try { peersRef.current[targetId].close(); } catch {}
    }

    const pc = new RTCPeerConnection({ iceServers: getIceServers() });

    // Add local tracks to the peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        setRemoteStreams((prev) => ({ ...prev, [targetId]: stream }));
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice', { code: codeRef.current, to: targetId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
      }
    };

    peersRef.current[targetId] = pc;

    if (initiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('webrtc-offer', { code: codeRef.current, to: targetId, offer: pc.localDescription });
        })
        .catch((e) => console.error('[webrtc] offer error', e));
    }

    return pc;
  }, [getIceServers]);

  const initMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
      } catch {
        console.warn('[media] No devices available');
        return null;
      }
    }
  }, []);

  const joinRoom = useCallback(async (roomName: string) => {
    const socket = getSocket();

    // Wait for socket to connect before joining
    const doJoin = () => {
      socket.emit('join-room', { code, name: roomName }, (res: any) => {
        if (res.error) {
          setError(res.error);
          return;
        }
        setMySocketId(socket.id || '');
        setIsHost(res.isHost);
        setHostId(res.hostId);
        setParticipants(res.participants);
        setMessages(res.messages || []);
        if (res.videoState?.videoId) setVideoState(res.videoState);
        setJoined(true);

        // Connect to all existing participants
        res.participants.forEach((p: Participant) => {
          if (p.socketId !== socket.id) {
            createPeer(p.socketId, true);
          }
        });
      });
    };

    if (socket.connected) {
      doJoin();
    } else {
      socket.once('connect', doJoin);
    }
  }, [code, createPeer]);

  // Boot: get name then init media then join
  useEffect(() => {
    const savedName = localStorage.getItem('antp-name');
    if (savedName) {
      initMedia().then(() => joinRoom(savedName));
    } else {
      setShowNameDialog(true);
    }
    // Cleanup on unmount
    return () => {
      Object.values(peersRef.current).forEach((pc) => { try { pc.close(); } catch {} });
      peersRef.current = {};
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Socket event listeners — set up once after join
  useEffect(() => {
    if (!joined) return;
    const socket = getSocket();

    const onParticipantJoined = ({ socketId, participants: p }: any) => {
      setParticipants(p);
      // Existing participants initiate offers to the new joiner
      // (new joiner already sent offers to us in joinRoom)
    };

    const onParticipantLeft = ({ socketId, participants: p }: any) => {
      setParticipants(p);
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
      if (peersRef.current[socketId]) {
        try { peersRef.current[socketId].close(); } catch {}
        delete peersRef.current[socketId];
      }
    };

    const onHostChanged = ({ hostId: newHostId }: any) => {
      setHostId(newHostId);
      setIsHost(newHostId === socket.id);
    };

    const onWebrtcOffer = async ({ from, offer }: any) => {
      const pc = createPeer(from, false);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { code, to: from, answer: pc.localDescription });
      } catch (e) {
        console.error('[webrtc] answer error', e);
      }
    };

    const onWebrtcAnswer = async ({ from, answer }: any) => {
      const pc = peersRef.current[from];
      if (pc && pc.signalingState === 'have-local-offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (e) {
          console.error('[webrtc] setRemoteDescription error', e);
        }
      }
    };

    const onWebrtcIce = async ({ from, candidate }: any) => {
      const pc = peersRef.current[from];
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch { /* benign */ }
      }
    };

    const onChatMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };

    const onChatReaction = ({ messageId, reactions }: any) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
      );
    };

    const onVideoLoad = ({ videoId }: any) => {
      setVideoState((prev) => ({
        videoId,
        playing: false,
        currentTime: 0,
        updatedAt: Date.now(),
        ...(prev ? {} : {}),
      }));
    };

    const onVideoPlay = ({ currentTime, timestamp }: any) => {
      const lag = (Date.now() - timestamp) / 1000;
      setVideoState((prev) =>
        prev ? { ...prev, playing: true, currentTime: currentTime + lag, updatedAt: Date.now() } : prev
      );
    };

    const onVideoPause = ({ currentTime }: any) => {
      setVideoState((prev) =>
        prev ? { ...prev, playing: false, currentTime, updatedAt: Date.now() } : prev
      );
    };

    const onVideoSeek = ({ currentTime, timestamp }: any) => {
      const lag = (Date.now() - timestamp) / 1000;
      setVideoState((prev) =>
        prev ? { ...prev, currentTime: currentTime + lag, updatedAt: Date.now() } : prev
      );
    };

    const onVideoState = (state: VideoState) => {
      setVideoState(state);
    };

    socket.on('participant-joined', onParticipantJoined);
    socket.on('participant-left', onParticipantLeft);
    socket.on('host-changed', onHostChanged);
    socket.on('webrtc-offer', onWebrtcOffer);
    socket.on('webrtc-answer', onWebrtcAnswer);
    socket.on('webrtc-ice', onWebrtcIce);
    socket.on('chat-message', onChatMessage);
    socket.on('chat-reaction', onChatReaction);
    socket.on('video-load', onVideoLoad);
    socket.on('video-play', onVideoPlay);
    socket.on('video-pause', onVideoPause);
    socket.on('video-seek', onVideoSeek);
    socket.on('video-state', onVideoState);

    return () => {
      socket.off('participant-joined', onParticipantJoined);
      socket.off('participant-left', onParticipantLeft);
      socket.off('host-changed', onHostChanged);
      socket.off('webrtc-offer', onWebrtcOffer);
      socket.off('webrtc-answer', onWebrtcAnswer);
      socket.off('webrtc-ice', onWebrtcIce);
      socket.off('chat-message', onChatMessage);
      socket.off('chat-reaction', onChatReaction);
      socket.off('video-load', onVideoLoad);
      socket.off('video-play', onVideoPlay);
      socket.off('video-pause', onVideoPause);
      socket.off('video-seek', onVideoSeek);
      socket.off('video-state', onVideoState);
    };
  }, [joined, code, createPeer]);

  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const newMuted = !micMuted;
    localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !newMuted; });
    setMicMuted(newMuted);
  };

  const toggleCam = () => {
    if (!localStreamRef.current) return;
    const newOff = !camOff;
    localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = !newOff; });
    setCamOff(newOff);
  };

  const sendMessage = useCallback((text: string) => {
    getSocket().emit('chat-message', { code, text });
  }, [code]);

  const sendReaction = useCallback((messageId: string, emoji: string) => {
    getSocket().emit('chat-reaction', { code, messageId, emoji });
  }, [code]);

  const onVideoEvent = useCallback((event: string, data: any) => {
    getSocket().emit(event, { code, ...data });
  }, [code]);

  const handleNameSubmit = () => {
    const trimmed = namePrompt.trim();
    if (!trimmed) return;
    localStorage.setItem('antp-name', trimmed);
    setShowNameDialog(false);
    initMedia().then(() => joinRoom(trimmed));
  };

  // ── Error screen ──
  if (error) {
    return (
      <div style={S.center}>
        <div style={{ fontSize: 48 }}>😕</div>
        <div style={{ color: '#fca5a5', fontSize: 18, textAlign: 'center', maxWidth: 360 }}>{error}</div>
        <button onClick={() => router.push('/')} style={S.accentBtn}>Go Home</button>
      </div>
    );
  }

  // ── Name dialog ──
  if (showNameDialog) {
    return (
      <div style={S.center}>
        <div style={S.dialog}>
          <div style={{ fontSize: 32, textAlign: 'center' }}>👋</div>
          <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: 20 }}>What should we call you?</h2>
          <input
            autoFocus
            style={S.dialogInput}
            placeholder="Your display name"
            value={namePrompt}
            maxLength={24}
            onChange={(e) => setNamePrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
          />
          <button onClick={handleNameSubmit} style={S.accentBtn}>Join Room →</button>
        </div>
      </div>
    );
  }

  // ── Connecting screen ──
  if (!joined) {
    return (
      <div style={S.center}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
        <div style={{ color: 'var(--text2)' }}>Connecting to room <strong>{code}</strong>…</div>
      </div>
    );
  }

  // ── Main room UI ──
  return (
    <div style={S.root}>
      <RoomHeader
        code={code}
        isHost={isHost}
        participantCount={participants.length}
        micMuted={micMuted}
        camOff={camOff}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onLeave={() => router.push('/')}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((o) => !o)}
      />
      <div style={S.body}>
        <div style={S.left}>
          <SyncPlayer
            code={code}
            isHost={isHost}
            videoState={videoState}
            onVideoEvent={onVideoEvent}
          />
          <VideoGrid
            localStream={localStream}
            remoteStreams={remoteStreams}
            participants={participants}
            mySocketId={mySocketId}
            micMuted={micMuted}
            camOff={camOff}
          />
        </div>
        {chatOpen && (
          <ChatPanel
            messages={messages}
            mySocketId={mySocketId}
            onSend={sendMessage}
            onReact={sendReaction}
          />
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: { height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' },
  body: { flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 },
  left: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  center: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  dialog: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 },
  dialogInput: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', color: 'var(--text)', fontSize: 15, outline: 'none', width: '100%' },
  accentBtn: { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer' },
};
