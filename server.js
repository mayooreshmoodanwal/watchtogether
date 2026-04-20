const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const rooms = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function createRoom(hostId, hostName) {
  const code = generateCode();
  rooms.set(code, {
    hostId,
    participants: new Map([[hostId, { name: hostName, socketId: hostId }]]),
    messages: [],
    videoState: { videoId: null, playing: false, currentTime: 0, updatedAt: Date.now() },
    emptyAt: null,
  });
  return code;
}

// Clean up empty rooms after 30 min
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (room.participants.size === 0 && room.emptyAt && now - room.emptyAt > 30 * 60 * 1000) {
      rooms.delete(code);
    }
  }
}, 60 * 1000);

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    let currentRoom = null;
    let currentName = null;

    socket.on('create-room', ({ name }, cb) => {
      if (!name || typeof name !== 'string') return cb({ error: 'Invalid name' });
      const trimmed = name.trim().slice(0, 24) || 'Guest';
      const code = createRoom(socket.id, trimmed);
      currentRoom = code;
      currentName = trimmed;
      socket.join(code);
      console.log(`[room] Created ${code} by ${trimmed}`);
      cb({ code });
    });

    socket.on('join-room', ({ code, name }, cb) => {
      if (!code || !name) return cb({ error: 'Invalid input' });
      const trimmedCode = code.trim().toUpperCase();
      const trimmedName = name.trim().slice(0, 24) || 'Guest';
      const room = rooms.get(trimmedCode);
      if (!room) return cb({ error: 'Room not found. Check your code.' });

      // Idempotent — host already in room from create-room
      if (room.participants.has(socket.id)) {
        currentRoom = trimmedCode;
        currentName = room.participants.get(socket.id).name;
        return cb({
          success: true,
          isHost: room.hostId === socket.id,
          hostId: room.hostId,
          participants: Array.from(room.participants.values()),
          messages: room.messages.slice(-50),
          videoState: room.videoState,
        });
      }

      if (room.participants.size >= 8) return cb({ error: 'Room is full (max 8 participants).' });

      room.participants.set(socket.id, { name: trimmedName, socketId: socket.id });
      room.emptyAt = null;
      currentRoom = trimmedCode;
      currentName = trimmedName;
      socket.join(trimmedCode);

      const participants = Array.from(room.participants.values());
      cb({
        success: true,
        isHost: false,
        hostId: room.hostId,
        participants,
        messages: room.messages.slice(-50),
        videoState: room.videoState,
      });

      socket.to(trimmedCode).emit('participant-joined', { socketId: socket.id, name: trimmedName, participants });
      console.log(`[room] ${trimmedName} joined ${trimmedCode}`);
    });

    // Video sync — host only
    socket.on('video-load', ({ code, videoId }) => {
      const room = rooms.get(code);
      if (!room || room.hostId !== socket.id) return;
      room.videoState = { videoId, playing: false, currentTime: 0, updatedAt: Date.now() };
      socket.to(code).emit('video-load', { videoId });
    });

    socket.on('video-play', ({ code, currentTime }) => {
      const room = rooms.get(code);
      if (!room || room.hostId !== socket.id) return;
      const ts = Date.now();
      room.videoState = { ...room.videoState, playing: true, currentTime, updatedAt: ts };
      socket.to(code).emit('video-play', { currentTime, timestamp: ts });
    });

    socket.on('video-pause', ({ code, currentTime }) => {
      const room = rooms.get(code);
      if (!room || room.hostId !== socket.id) return;
      room.videoState = { ...room.videoState, playing: false, currentTime, updatedAt: Date.now() };
      socket.to(code).emit('video-pause', { currentTime });
    });

    socket.on('video-seek', ({ code, currentTime }) => {
      const room = rooms.get(code);
      if (!room || room.hostId !== socket.id) return;
      const ts = Date.now();
      room.videoState = { ...room.videoState, currentTime, updatedAt: ts };
      socket.to(code).emit('video-seek', { currentTime, timestamp: ts });
    });

    socket.on('request-sync', ({ code }) => {
      const room = rooms.get(code);
      if (!room) return;
      socket.emit('video-state', room.videoState);
    });

    // Chat
    socket.on('chat-message', ({ code, text }) => {
      const room = rooms.get(code);
      if (!room || !room.participants.has(socket.id)) return;
      const msg = {
        id: uuidv4(),
        senderName: currentName,
        senderId: socket.id,
        text: String(text).slice(0, 500),
        timestamp: Date.now(),
        reactions: {},
      };
      room.messages.push(msg);
      if (room.messages.length > 200) room.messages.shift();
      io.to(code).emit('chat-message', msg);
    });

    socket.on('chat-reaction', ({ code, messageId, emoji }) => {
      const room = rooms.get(code);
      if (!room) return;
      const msg = room.messages.find((m) => m.id === messageId);
      if (!msg) return;
      if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
      const idx = msg.reactions[emoji].indexOf(socket.id);
      if (idx === -1) msg.reactions[emoji].push(socket.id);
      else {
        msg.reactions[emoji].splice(idx, 1);
        if (!msg.reactions[emoji].length) delete msg.reactions[emoji];
      }
      io.to(code).emit('chat-reaction', { messageId, reactions: msg.reactions });
    });

    // WebRTC signalling — pure relay
    socket.on('webrtc-offer',  ({ to, offer })     => io.to(to).emit('webrtc-offer',  { from: socket.id, offer }));
    socket.on('webrtc-answer', ({ to, answer })    => io.to(to).emit('webrtc-answer', { from: socket.id, answer }));
    socket.on('webrtc-ice',    ({ to, candidate }) => io.to(to).emit('webrtc-ice',    { from: socket.id, candidate }));

    socket.on('disconnect', () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      room.participants.delete(socket.id);
      const participants = Array.from(room.participants.values());
      if (room.participants.size === 0) {
        room.emptyAt = Date.now();
      } else if (room.hostId === socket.id) {
        const nextHost = room.participants.keys().next().value;
        room.hostId = nextHost;
        io.to(currentRoom).emit('host-changed', { hostId: nextHost });
      }
      socket.to(currentRoom).emit('participant-left', { socketId: socket.id, participants });
      console.log(`[room] ${currentName} left ${currentRoom}`);
    });
  });

  httpServer.listen(port, () => console.log(`> Ready on http://localhost:${port}`));
});
