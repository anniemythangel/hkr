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
import { GAME_ROTATION, PLAYERS, PlayerId, TEAMS } from '@hooker/shared';
import type { HandScoreSummary } from '@hooker/shared';
import type { GameState } from '@hooker/engine';

const port = Number(process.env.PORT ?? 3001);

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

type ActorInfo = {
  seat: PlayerId | null;
  name: string;
};

type LogEntry = {
  type: 'system' | 'move';
  text: string;
  when: number;
  actor: ActorInfo;
  private?: boolean;
};

type ChatEntry = {
  name: string;
  text: string;
  when: number;
};

type RosterPayload = Partial<Record<PlayerId, { name: string }>>;

const roomState = new Map<string, GameState>();
const roomLogs = new Map<string, LogEntry[]>();
const roomChats = new Map<string, ChatEntry[]>();
const roomRosters = new Map<string, Map<PlayerId, { name: string; socketId: string }>>();

const SYSTEM_ACTOR: ActorInfo = { seat: null, name: 'System' };

function ensureRoster(roomId: string) {
  let roster = roomRosters.get(roomId);
  if (!roster) {
    roster = new Map();
    roomRosters.set(roomId, roster);
  }
  return roster;
}

function getActorInfo(roomId: string, seat: PlayerId | null | undefined): ActorInfo {
  if (!seat) {
    return SYSTEM_ACTOR;
  }
  const roster = roomRosters.get(roomId);
  const name = roster?.get(seat)?.name?.trim();
  return {
    seat,
    name: name && name.length > 0 ? name : seat,
  };
}

function formatSuitName(raw: string) {
  if (!raw) return raw;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const joinSchema = z.object({
  roomId: z.string(),
  player: z.custom<PlayerId>((val) => ['A', 'B', 'C', 'D'].includes(String(val)), {
    message: 'Invalid player id',
  }),
  name: z.string().min(1),
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
  roomId?: string;
  player?: PlayerId;
  name?: string;
};

io.on('connection', (socket) => {
  socket.data = {};

  socket.on('join', (raw) => {
    const parse = joinSchema.safeParse(raw);
    if (!parse.success) {
      socket.emit('errorMessage', parse.error.message);
      return;
    }

    const { roomId, player, name } = parse.data;
    socket.data.roomId = roomId;
    socket.data.player = player;
    socket.data.name = name;
    socket.join(roomId);

    if (!roomState.has(roomId)) {
      roomState.set(roomId, autoAdvance(createMatch(), roomId));
    }

    const roster = ensureRoster(roomId);
    roster.set(player, { name, socketId: socket.id });
    emitRoster(roomId);

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

    const roomId = socket.data.roomId;
    const seat = socket.data.player;
    act(roomId, (s) => handleKittyDecision(s, seat, data.data.accept), {
      actPlayer: seat,
      onSuccess: (previous, current) => {
        const actor = getActorInfo(roomId, seat);
        const logText = data.data.accept
          ? `${actor.name} picked up the kitty`
          : `${actor.name} passed the kitty`;
        const extra =
          !data.data.accept && !previous.hand.forcedAccept && current.hand.forcedAccept
            ? ' (forced accept)'
            : '';
        return { type: 'move', text: `${logText}${extra}`, when: Date.now(), actor };
      },
    });
  });

  socket.on('discard', (raw) => {
    const data = discardSchema.safeParse(raw);
    if (!socket.data.roomId || !socket.data.player) return;
    if (!data.success) {
      socket.emit('errorMessage', data.error.message);
      return;
    }
    const roomId = socket.data.roomId;
    const seat = socket.data.player;
    const previousHand = [...(roomState.get(roomId)?.hand.hands[seat as PlayerId] ?? [])];
    act(roomId, (s) => handleDiscard(s, seat, data.data.card as any), {
      actPlayer: seat,
      onSuccess: (_, current) => {
        const actor = getActorInfo(roomId, seat);
        const updatedHand = current.hand.hands[seat as PlayerId];
        const removed = previousHand.find(
          (prev) =>
            !updatedHand.some((next: any) => next.rank === prev.rank && next.suit === prev.suit),
        );
        const when = Date.now();
        const reveal = removed ?? (data.data.card as { rank: string; suit: string });
        const privateLog: LogEntry = {
          type: 'move',
          text: `You discarded ${reveal.rank} of ${String(reveal.suit)[0].toUpperCase()}`,
          when,
          actor,
          private: true,
        };
        socket.emit('log', privateLog);
        const publicLog: LogEntry = {
          type: 'move',
          text: `${actor.name} discarded a card face-down`,
          when,
          actor,
        };
        socket.to(roomId).emit('log', publicLog);
        appendLog(roomId, publicLog);
        return null; // No broadcast log
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
    const roomId = socket.data.roomId;
    const seat = socket.data.player;
    act(roomId, (s) => handleDeclareTrump(s, seat, data.data.suit as any), {
      actPlayer: seat,
      onSuccess: () => {
        const actor = getActorInfo(roomId, seat);
        const suitName = formatSuitName(data.data.suit);
        return {
          type: 'move',
          text: `${actor.name} declared ${suitName} as trump`,
          when: Date.now(),
          actor,
        };
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
    const roomId = socket.data.roomId;
    const seat = socket.data.player;
    act(roomId, (s) => handlePlayCard(s, seat, data.data.card as any), {
      actPlayer: seat,
      onSuccess: () => {
        const { rank, suit } = data.data.card;
        const actor = getActorInfo(roomId, seat);
        return {
          type: 'move',
          text: `${actor.name} played ${formatCard(rank, suit)}`,
          when: Date.now(),
          actor,
        };
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
    const { roomId, player } = socket.data;
    if (!roomId || !player) return;
    socket.leave(roomId);
    const roster = roomRosters.get(roomId);
    if (!roster) return;
    const entry = roster.get(player);
    if (entry && entry.socketId === socket.id) {
      roster.delete(player);
      if (roster.size === 0) {
        roomRosters.delete(roomId);
      }
      emitRoster(roomId);
    }
  });
});

function autoAdvance(state: GameState, roomId: string): GameState {
  let current = state;
  while (true) {
    const next = advanceState(current);
    if (next.phase === current.phase) {
      return current;
    }
    const logs = collectLogs(roomId, current, next, next);
    for (const entry of logs) {
      emitRoomLog(roomId, entry);
    }
    current = next;
  }
}

function act(
  roomId: string,
  fn: (state: GameState) => { ok: true; state: GameState } | { ok: false; error: string },
  options: {
    actPlayer?: PlayerId;
    onSuccess?: (previous: GameState, current: GameState) => LogEntry | null;
  } = {},
) {
  const previous = roomState.get(roomId);
  if (!previous) return;

  const result = fn(previous);
  if (!result.ok) {
    if (options.actPlayer) {
      const socket = io.sockets.sockets.get(roomRosters.get(roomId)?.get(options.actPlayer)?.socketId ?? '');
      if (socket) {
        socket.emit('errorMessage', result.error);
      }
    }
    return;
  }

  const log = options.onSuccess?.(previous, result.state);
  const advanced = autoAdvance(result.state, roomId);
  roomState.set(roomId, advanced);
  broadcastSnapshot(roomId, advanced);

  const logs = collectLogs(roomId, previous, result.state, advanced, log ?? undefined);
  if (logs.length > 0) {
    for (const entry of logs) {
      emitRoomLog(roomId, entry);
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
  roomId: string,
  previous: GameState,
  updated: GameState,
  advanced: GameState,
  initial?: LogEntry,
): LogEntry[] {
  const entries: LogEntry[] = [];
  if (initial) {
    entries.push(initial);
  }

  const teamLabel = (team: keyof GameState['scores']) =>
    team === 'NorthSouth' ? 'North / South' : 'East / West';
  const formatPlayer = (player: PlayerId) => {
    const info = getActorInfo(roomId, player);
    return `${info.name} (${player})`;
  };
  const formatScore = (scores: GameState['scores']) => `${scores.NorthSouth}-${scores.EastWest}`;

  if (updated.hand.completedTricks.length > previous.hand.completedTricks.length) {
    const trick = updated.hand.completedTricks[updated.hand.completedTricks.length - 1];
    const winnerActor = getActorInfo(roomId, trick.winner ?? null);
    entries.push({
      type: 'system',
      text: `Trick ${updated.hand.completedTricks.length} won by ${winnerActor.name}`,
      when: Date.now(),
      actor: winnerActor,
    });
  }

  if (updated.phase === 'HandScore' && updated.lastHandSummary) {
    const summary = updated.lastHandSummary;
    entries.push(handSummaryLog(summary, advanced.scores));
  }

  if (previous.phase === 'GameOver' && updated.phase === 'MatchSetup') {
    const totalGames = GAME_ROTATION.length;
    const gameNumber = Math.min(updated.gameIndex + 1, totalGames);
    const rotationSummary = TEAMS.map((teamId) => {
      const members = updated.teams[teamId].map((player) => formatPlayer(player));
      return `${teamLabel(teamId)}: ${members.join(' & ')}`;
    }).join('; ');
    entries.push({
      type: 'system',
      text: `Match game ${gameNumber} of ${totalGames} rotation — ${rotationSummary}`,
      when: Date.now(),
      actor: SYSTEM_ACTOR,
    });
  }

  if (advanced.phase === 'MatchOver') {
    const latest = advanced.gameResults[advanced.gameResults.length - 1];
    if (latest) {
      const totalGames = GAME_ROTATION.length;
      const honors: string[] = [];
      const talson = PLAYERS.filter((player) => advanced.playerGameWins[player] === totalGames);
      if (talson.length > 0) {
        honors.push(`Talson: ${talson.map((player) => formatPlayer(player)).join(', ')}`);
      }
      const usha = PLAYERS.filter((player) => advanced.playerGameWins[player] === 0);
      if (usha.length > 0) {
        honors.push(`Usha: ${usha.map((player) => formatPlayer(player)).join(', ')}`);
      }
      const summaryParts = [`Game ${latest.gameIndex + 1}: ${teamLabel(latest.winner)} wins ${formatScore(latest.scores)}`];
      if (honors.length > 0) {
        summaryParts.push(`Honors — ${honors.join(' • ')}`);
      }
      entries.push({
        type: 'system',
        text: `Match over — ${summaryParts.join(' ')}`,
        when: Date.now(),
        actor: SYSTEM_ACTOR,
      });
    }
  }

  if (advanced.phase === 'AceDraw') {
    const snapshot = getSnapshot(advanced, 'A');
    if (snapshot.aceDraw) {
      for (const draw of snapshot.aceDraw.draws) {
        const actor = getActorInfo(roomId, draw.player);
        const text =
          draw.card.rank === 'A'
            ? `${actor.name} drew Ace of ${draw.card.suit}. They are the dealer`
            : `${actor.name} drew: ${draw.card.rank} of ${draw.card.suit}`;
        entries.push({
          type: 'system',
          text,
          when: Date.now(),
          actor,
        });
      }
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
    actor: SYSTEM_ACTOR,
  };
}

function emitRoomLog(roomId: string, entry: LogEntry) {
  io.to(roomId).emit('log', entry);
  appendLog(roomId, entry);
}

function emitRoster(roomId: string) {
  io.to(roomId).emit('roster', getRosterPayload(roomId));
}

function getRosterPayload(roomId: string): RosterPayload {
  const roster = roomRosters.get(roomId);
  if (!roster) {
    return {};
  }
  const result: RosterPayload = {};
  for (const [seat, info] of roster.entries()) {
    result[seat] = { name: info.name };
  }
  return result;
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
