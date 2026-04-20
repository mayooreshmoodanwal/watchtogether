export interface Participant {
  socketId: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderId: string;
  text: string;
  timestamp: number;
  reactions: Record<string, string[]>; // emoji -> [socketId]
}

export interface VideoState {
  videoId: string | null;
  playing: boolean;
  currentTime: number;
  updatedAt: number;
}

export interface RoomState {
  isHost: boolean;
  hostId: string;
  participants: Participant[];
  messages: ChatMessage[];
  videoState: VideoState;
}
