import { createServer } from 'http';
import { Server } from 'socket.io';
import { z } from 'zod';
import {
  createMatch,
  getSnapshot,
  handleKittyDecision,
  handleDiscard,
  handleDeclareTrump,
  handlePlayCard,
  advanceState,
} from '@hooker/engine';
import { PlayerId } from '@hooker/shared';
import type { GameState } from '@hooker/engine';

const port = Number(process.env.PORT ?? 3001);

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

const roomState = new Map<string, GameState>();

const joinSchema = z.object({
  roomId: z.string(),
  player: z.custom<PlayerId>((val) => ['A', 'B', 'C', 'D'].includes(String(val)), {
    message: 'Invalid player id',
  }),
});

const kittyDecisionSchema = z.object({
  accept: z.boolean(),
});

const discardSchema = z.object({
  card: z.object({
    suit: z.string(),
    rank: z.string(),
  }),
});

const declareTrumpSchema = z.object({
  suit: z.string(),
});

const playCardSchema = z.object({
  card: z.object({
    suit: z.string(),
    rank: z.string(),
  }),
});

type SocketData = {
  roomId: string;
  player: PlayerId;
};

io.on('connection', (socket) => {
  socket.data = {};

  socket.on('join', (raw) => {
    const parse = joinSchema.safeParse(raw);
    if (!parse.success) {
      socket.emit('errorMessage', parse.error.message);
      return;
    }

    const { roomId, player } = parse.data;
    socket.data.roomId = roomId;
    socket.data.player = player;
    socket.join(roomId);

    if (!roomState.has(roomId)) {
      roomState.set(roomId, autoAdvance(createMatch()));
    }

    const state = roomState.get(roomId)!;
    socket.emit('snapshot', getSnapshot(state, player));
  });

  socket.on('kittyDecision', (raw) => {
    const data = kittyDecisionSchema.safeParse(raw);
    if (!socket.data.roomId || !socket.data.player) return;
    if (!data.success) {
      socket.emit('errorMessage', data.error.message);
      return;
    }

    const state = roomState.get(socket.data.roomId);
    if (!state) return;
    const result = handleKittyDecision(state, socket.data.player, data.data.accept);
    if (!result.ok) {
      socket.emit('errorMessage', result.error);
      return;
    }
    updateRoomState(socket.data.roomId, result.state);
  });

  socket.on('discard', (raw) => {
    const data = discardSchema.safeParse(raw);
    if (!socket.data.roomId || !socket.data.player) return;
    if (!data.success) {
      socket.emit('errorMessage', data.error.message);
      return;
    }
    const state = roomState.get(socket.data.roomId);
    if (!state) return;
    const result = handleDiscard(state, socket.data.player, data.data.card as any);
    if (!result.ok) {
      socket.emit('errorMessage', result.error);
      return;
    }
    updateRoomState(socket.data.roomId, result.state);
  });

  socket.on('declareTrump', (raw) => {
    const data = declareTrumpSchema.safeParse(raw);
    if (!socket.data.roomId || !socket.data.player) return;
    if (!data.success) {
      socket.emit('errorMessage', data.error.message);
      return;
    }
    const state = roomState.get(socket.data.roomId);
    if (!state) return;
    const result = handleDeclareTrump(state, socket.data.player, data.data.suit as any);
    if (!result.ok) {
      socket.emit('errorMessage', result.error);
      return;
    }
    updateRoomState(socket.data.roomId, result.state);
  });

  socket.on('playCard', (raw) => {
    const data = playCardSchema.safeParse(raw);
    if (!socket.data.roomId || !socket.data.player) return;
    if (!data.success) {
      socket.emit('errorMessage', data.error.message);
      return;
    }
    const state = roomState.get(socket.data.roomId);
    if (!state) return;
    const result = handlePlayCard(state, socket.data.player, data.data.card as any);
    if (!result.ok) {
      socket.emit('errorMessage', result.error);
      return;
    }
    updateRoomState(socket.data.roomId, result.state);
  });

  socket.on('disconnect', () => {
    if (!socket.data.roomId || !socket.data.player) return;
    socket.leave(socket.data.roomId);
  });
});

function autoAdvance(state: GameState): GameState {
  let current = state;
  while (true) {
    const next = advanceState(current);
    if (next.phase === current.phase) {
      return current;
    }
    current = next;
  }
}

function updateRoomState(roomId: string, updated: GameState) {
  const advanced = autoAdvance(updated);
  roomState.set(roomId, advanced);
  broadcastSnapshot(roomId, advanced);
}

function broadcastSnapshot(roomId: string, state: GameState) {
  const room = io.sockets.adapter.rooms.get(roomId);
  if (!room) return;
  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;
    const player = socket.data.player as PlayerId | undefined;
    if (!player) continue;
    socket.emit('snapshot', getSnapshot(state, player));
  }
}

httpServer.listen(port, () => {
  console.log(`Hooker server listening on port ${port}`);
});
