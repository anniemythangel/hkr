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
import type { HandScoreSummary } from '@hooker/shared';
import type { GameState } from '@hooker/engine';

const port = Number(process.env.PORT ?? 3001);

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

type LogEntry = {
  type: 'system' | 'move';
  text: string;
  when: number;
};

type ChatEntry = {
  name: string;
  text: string;
  when: number;
};

const roomState = new Map<string, GameState>();
const roomLogs = new Map<string, LogEntry[]>();
const roomChats = new Map<string, ChatEntry[]>();

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

const chatSchema = z.object({
  roomId: z.string(),
  name: z.string().min(1),
  text: z.string().min(1),
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
      const initial = autoAdvance(createMatch());
      roomState.set(roomId, initial);
    }

    const state = roomState.get(roomId)!;
    socket.emit('snapshot', getSnapshot(state, player));

    const logs = roomLogs.get(roomId) ?? [];
    for (const entry of logs) {
      socket.emit('log', entry);
    }

    const chats = roomChats.get(roomId) ?? [];
    for (const entry of chats) {
      socket.emit('chat', entry);
    }
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
    const logText = data.data.accept
      ? `${socket.data.player} picked up the kitty`
      : `${socket.data.player} passed the kitty`;
    const extra =
      !data.data.accept && !state.hand.forcedAccept && result.state.hand.forcedAccept
        ? ' (forced accept)' 
        : '';
    updateRoomState(socket.data.roomId, state, result.state, {
      log: { type: 'move', text: `${logText}${extra}`, when: Date.now() },
    });
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
    const { rank, suit } = data.data.card;
    updateRoomState(socket.data.roomId, state, result.state, {
      log: {
        type: 'move',
        text: `${socket.data.player} discarded ${formatCard(rank, suit)}`,
        when: Date.now(),
      },
    });
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
    updateRoomState(socket.data.roomId, state, result.state, {
      log: {
        type: 'move',
        text: `${socket.data.player} declared ${data.data.suit} as trump`,
        when: Date.now(),
      },
    });
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
    const { rank, suit } = data.data.card;
    updateRoomState(socket.data.roomId, state, result.state, {
      log: {
        type: 'move',
        text: `${socket.data.player} played ${formatCard(rank, suit)}`,
        when: Date.now(),
      },
    });
  });

  socket.on('chat', (raw) => {
    const data = chatSchema.safeParse(raw);
    if (!data.success) {
      socket.emit('errorMessage', data.error.message);
      return;
    }
    if (!socket.data.roomId || socket.data.roomId !== data.data.roomId) {
      return;
    }
    const entry: ChatEntry = {
      name: data.data.name,
      text: data.data.text,
      when: Date.now(),
    };
    appendChat(data.data.roomId, entry);
    io.to(data.data.roomId).emit('chat', entry);
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

function updateRoomState(
  roomId: string,
  previous: GameState,
  updated: GameState,
  options: { log?: LogEntry } = {},
) {
  const advanced = autoAdvance(updated);
  roomState.set(roomId, advanced);
  broadcastSnapshot(roomId, advanced);
  const logs = collectLogs(previous, updated, advanced, options.log);
  if (logs.length > 0) {
    for (const entry of logs) {
      io.to(roomId).emit('log', entry);
      appendLog(roomId, entry);
    }
  }
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

function collectLogs(
  previous: GameState,
  updated: GameState,
  advanced: GameState,
  initial?: LogEntry,
): LogEntry[] {
  const entries: LogEntry[] = [];
  if (initial) {
    entries.push(initial);
  }

  if (updated.hand.completedTricks.length > previous.hand.completedTricks.length) {
    const trick = updated.hand.completedTricks[updated.hand.completedTricks.length - 1];
    entries.push({
      type: 'system',
      text: `Trick ${updated.hand.completedTricks.length} won by ${trick.winner}`,
      when: Date.now(),
    });
  }

  if (updated.phase === 'HandScore' && updated.lastHandSummary) {
    const summary = updated.lastHandSummary;
    entries.push(handSummaryLog(summary, advanced.scores));
  }

  if (advanced.phase === 'MatchOver') {
    const latest = advanced.gameResults[advanced.gameResults.length - 1];
    if (latest) {
      entries.push({
        type: 'system',
        text: `Game over — ${latest.winner} wins ${latest.scores.NorthSouth}-${latest.scores.EastWest}`,
        when: Date.now(),
      });
    }
  }

  return entries;
}

function handSummaryLog(summary: HandScoreSummary, scores: GameState['scores']): LogEntry {
  const teamScores = `${scores.NorthSouth}-${scores.EastWest}`;
  return {
    type: 'system',
    text: `Hand scored — ${summary.winningTeam} +${summary.points} (score ${teamScores})`,
    when: Date.now(),
  };
}

function appendLog(roomId: string, entry: LogEntry) {
  const existing = roomLogs.get(roomId) ?? [];
  const next = [...existing, entry];
  roomLogs.set(roomId, next.slice(-200));
}

function appendChat(roomId: string, entry: ChatEntry) {
  const existing = roomChats.get(roomId) ?? [];
  const next = [...existing, entry];
  roomChats.set(roomId, next.slice(-200));
}

function formatCard(rank: string, suit: string): string {
  return `${rank} of ${suit.charAt(0).toUpperCase()}${suit.slice(1)}`;
}

httpServer.listen(port, () => {
  console.log(`Hooker server listening on port ${port}`);
});
