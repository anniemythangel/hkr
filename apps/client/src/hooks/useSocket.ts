import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { PLAYERS } from '@hooker/shared';
import type { MatchSnapshot, ParticipantRole, PlayerId, RoomLobbyState } from '@hooker/shared';
import { ENABLE_JOIN_ACK_PROTOCOL } from '../utils/featureFlags';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type JoinStatus = 'idle' | 'joining' | 'joined' | 'join_failed';

export type ConsoleActor = {
  seat: PlayerId | null;
  name: string;
};

export type ConsoleEntry = {
  type: 'system' | 'move';
  text: string;
  when: number;
  actor: ConsoleActor;
  private?: boolean;
};

const SYSTEM_ACTOR: ConsoleActor = { seat: null, name: 'System' };

type Roster = Partial<Record<PlayerId, { name: string; ready: boolean }>>;

export type ChatMessage = {
  name: string;
  text: string;
  when: number;
};

const PLAYER_ID_SET = new Set<PlayerId>(PLAYERS);

function isPlayerId(value: unknown): value is PlayerId {
  return typeof value === 'string' && PLAYER_ID_SET.has(value as PlayerId);
}

export type RejoinToken = {
  roomId: string;
  name: string;
  profileId?: string;
  serverUrl: string;
  role: ParticipantRole;
  seat?: PlayerId;
  followSeat?: PlayerId;
  sessionKey?: string;
};

type ConnectParams =
  | { serverUrl?: string; roomId: string; name: string; role: 'player'; seat: PlayerId; profileId?: string }
  | { serverUrl?: string; roomId: string; name: string; role: 'spectator'; followSeat?: PlayerId };

const STORAGE_KEY = 'hkr.rejoinToken';

function readToken(): RejoinToken | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RejoinToken>;
    if (!parsed || typeof parsed.roomId !== 'string' || typeof parsed.name !== 'string') {
      return null;
    }
    const serverUrl = typeof parsed.serverUrl === 'string' ? parsed.serverUrl : '';
    const role: ParticipantRole = parsed.role === 'spectator' ? 'spectator' : 'player';
    if (role === 'player') {
      if (!isPlayerId(parsed.seat)) {
        return null;
      }
      return {
        roomId: parsed.roomId,
        name: parsed.name,
        profileId: typeof parsed.profileId === 'string' ? parsed.profileId : undefined,
        serverUrl,
        role: 'player',
        seat: parsed.seat,
      };
    }
    const followSeat = isPlayerId(parsed.followSeat)
      ? parsed.followSeat
      : isPlayerId(parsed.seat)
        ? parsed.seat
        : undefined;
    return {
        roomId: parsed.roomId,
        name: parsed.name,
        profileId: typeof parsed.profileId === 'string' ? parsed.profileId : undefined,
        serverUrl,
        role: 'spectator',
      followSeat,
    };
  } catch (error) {
    console.warn('Failed to read rejoin token', error);
    return null;
  }
}

function persistToken(token: RejoinToken | null) {
  if (typeof window === 'undefined') {
    return;
  }
  if (!token) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(token));
}

export function useSocket(defaultServerUrl: string) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ConsoleEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [roster, setRoster] = useState<Roster>({});
  const [lobby, setLobby] = useState<RoomLobbyState | null>(null);
  const [token, setToken] = useState<RejoinToken | null>(() => readToken());
  const [joinStatus, setJoinStatus] = useState<JoinStatus>('idle');

  const socketRef = useRef<Socket | null>(null);
  const joinRef = useRef<RejoinToken | null>(token);
  const attemptedAutoJoinRef = useRef(false);
  const reconnectingRef = useRef(false);
  const joinTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    joinRef.current = token;
  }, [token]);

  const appendLog = useCallback((entry: ConsoleEntry) => {
    setLogs((prev) => [...prev.slice(-199), entry]);
  }, []);

  const appendChat = useCallback((entry: ChatMessage) => {
    setChatMessages((prev) => [...prev.slice(-199), entry]);
  }, []);

  const emitJoin = useCallback(
    (reason: 'initial' | 'reconnect') => {
      const socket = socketRef.current;
      const join = joinRef.current;
      if (!socket || !join) return;
      const payload: Record<string, unknown> = { roomId: join.roomId, name: join.name };
      if (join.sessionKey) {
        payload.sessionKey = join.sessionKey;
      }
      let message: string;
      if (join.role === 'spectator') {
        payload.role = 'spectator';
        if (join.followSeat) {
          payload.followSeat = join.followSeat;
        }
        const followLabel = join.followSeat ?? 'A';
        message =
          reason === 'reconnect'
            ? `Restored spectator view of seat ${followLabel} in room ${join.roomId}`
            : `Joining room ${join.roomId} as spectator following seat ${followLabel}`;
      } else {
        if (!join.seat) {
          appendLog({
            type: 'system',
            text: 'Missing seat information for player join',
            when: Date.now(),
            actor: SYSTEM_ACTOR,
          });
          return;
        }
        payload.role = 'player';
        payload.player = join.seat;
        if (join.profileId) {
          payload.profileId = join.profileId;
        }
        message =
          reason === 'reconnect'
            ? `Restored seat ${join.seat} in room ${join.roomId}`
            : `Joining room ${join.roomId} as seat ${join.seat}`;
      }
      socket.emit('join', payload);
      setJoinStatus('joining');
      if (joinTimeoutRef.current) window.clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = window.setTimeout(() => {
        setJoinStatus('join_failed');
        setError('We could not confirm your room join in time. Please retry.');
      }, 7000);
      appendLog({ type: 'system', text: message, when: Date.now(), actor: SYSTEM_ACTOR });
    },
    [appendLog],
  );

  const resetState = useCallback(() => {
    setSnapshot(null);
    setLogs([]);
    setChatMessages([]);
    setRoster({});
    setLobby(null);
  }, []);

  const connect = useCallback(
    (params: ConnectParams) => {
      const trimmedRoom = params.roomId.trim();
      const trimmedName = params.name.trim();
      const effectiveServer = (params.serverUrl?.trim() || defaultServerUrl).replace(/\/?$/, '');
      const role = params.role ?? 'player';
      const join: RejoinToken = {
        roomId: trimmedRoom,
        name: trimmedName,
        serverUrl: effectiveServer,
        role,
        profileId: role === 'player' ? params.profileId : undefined,
        seat: role === 'player' ? params.seat : undefined,
        followSeat: role === 'spectator' ? params.followSeat : undefined,
        sessionKey: token?.sessionKey ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };

      joinRef.current = join;
      setToken(join);
      persistToken(join);

      socketRef.current?.disconnect();
      resetState();
      setError(null);
      setStatus('connecting');
      setJoinStatus('idle');

      const socket = io(effectiveServer, {
        autoConnect: false,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 4000,
        randomizationFactor: 0.5,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        const wasReconnecting = reconnectingRef.current;
        reconnectingRef.current = false;
        setStatus('connected');
        setError(null);
        appendLog({
          type: 'system',
          text: wasReconnecting ? 'Reconnected to server' : 'Connected to server',
          when: Date.now(),
          actor: SYSTEM_ACTOR,
        });
        emitJoin(wasReconnecting ? 'reconnect' : 'initial');
      });

      socket.on('disconnect', (reason) => {
        setStatus('disconnected');
        setSnapshot(null);
        reconnectingRef.current = false;
        setJoinStatus('idle');
        if (reason !== 'io client disconnect') {
          appendLog({ type: 'system', text: 'Disconnected from server', when: Date.now(), actor: SYSTEM_ACTOR });
        }
      });

      socket.on('snapshot', (data: MatchSnapshot | null) => {
        if (data?.viewer) {
          const current = joinRef.current;
          if (current) {
            if (current.role === 'spectator' && current.followSeat !== data.viewer.seat) {
              const updated = { ...current, followSeat: data.viewer.seat };
              joinRef.current = updated;
              setToken(updated);
              persistToken(updated);
            } else if (current.role === 'player' && current.seat !== data.viewer.seat) {
              const updated = { ...current, seat: data.viewer.seat };
              joinRef.current = updated;
              setToken(updated);
              persistToken(updated);
            }
          }
        }
        setSnapshot(data ?? null);
        setJoinStatus('joined');
        if (joinTimeoutRef.current) {
          window.clearTimeout(joinTimeoutRef.current);
          joinTimeoutRef.current = null;
        }
      });

      socket.on('roster', (data: Roster) => {
        setRoster(data ?? {});
      });

      socket.on('lobby', (data: RoomLobbyState) => {
        setLobby(data);
      });

      socket.on('errorMessage', (message: string) => {
        setError(message);
        if (joinStatus === 'joining') {
          setJoinStatus('join_failed');
        }
      });

      socket.on('joinAccepted', () => {
        if (joinTimeoutRef.current) {
          window.clearTimeout(joinTimeoutRef.current);
          joinTimeoutRef.current = null;
        }
        setJoinStatus('joined');
      });

      socket.on('joinRejected', (payload: { message: string; retryAfterMs?: number }) => {
        if (joinTimeoutRef.current) {
          window.clearTimeout(joinTimeoutRef.current);
          joinTimeoutRef.current = null;
        }
        const suffix = payload.retryAfterMs ? ` Retry in ${Math.ceil(payload.retryAfterMs / 1000)}s.` : '';
        setError(`${payload.message}${suffix}`);
        setJoinStatus('join_failed');
      });

      socket.on('log', (entry: ConsoleEntry) => {
        appendLog(entry);
      });

      socket.on('chat', (entry: ChatMessage) => {
        appendChat(entry);
      });

      socket.on('matchReset', () => {
        setSnapshot(null);
        setLogs([]);
      });

      socket.on('connect_error', (err) => {
        setStatus('connecting');
        setError(err.message);
        appendLog({
          type: 'system',
          text: `Connection error: ${err.message}`,
          when: Date.now(),
          actor: SYSTEM_ACTOR,
        });
      });

      socket.io.on('reconnect_attempt', (attempt) => {
        reconnectingRef.current = true;
        appendLog({
          type: 'system',
          text: `Reconnecting to server… (attempt ${attempt})`,
          when: Date.now(),
          actor: SYSTEM_ACTOR,
        });
      });

      socket.connect();
    },
    [appendChat, appendLog, defaultServerUrl, emitJoin, joinStatus, resetState, token?.sessionKey],
  );

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setStatus('disconnected');
    setSnapshot(null);
    setRoster({});
    setLobby(null);
    setJoinStatus('idle');
  }, []);

  const emitAction = useCallback(
    (event: string, payload: unknown) => {
      const socket = socketRef.current;
      const join = joinRef.current;
      if (!socket || status !== 'connected') {
        appendLog({ type: 'system', text: 'Not connected to server', when: Date.now(), actor: SYSTEM_ACTOR });
        return;
      }
      if (join?.role === 'spectator') {
        appendLog({
          type: 'system',
          text: 'Spectators cannot perform in-game actions',
          when: Date.now(),
          actor: SYSTEM_ACTOR,
        });
        return;
      }
      socket.emit(event, payload);
    },
    [appendLog, status],
  );

  const setReady = useCallback(
    (ready: boolean) => {
      const socket = socketRef.current;
      const join = joinRef.current;
      if (!socket || status !== 'connected') {
        appendLog({ type: 'system', text: 'Not connected to server', when: Date.now(), actor: SYSTEM_ACTOR });
        return;
      }
      if (join?.role !== 'player') {
        appendLog({
          type: 'system',
          text: 'Only seated players can change ready state',
          when: Date.now(),
          actor: SYSTEM_ACTOR,
        });
        return;
      }
      socket.emit('setReady', { ready });
    },
    [appendLog, status],
  );

  const setFollowSeat = useCallback(
    (seat: PlayerId) => {
      const socket = socketRef.current;
      const join = joinRef.current;
      if (!socket || !join || join.role !== 'spectator') {
        return;
      }
      if (!PLAYER_ID_SET.has(seat)) {
        return;
      }
      if (join.followSeat === seat) {
        return;
      }
      const updated: RejoinToken = { ...join, followSeat: seat };
      joinRef.current = updated;
      setToken(updated);
      persistToken(updated);
      if (status === 'connected') {
        socket.emit('spectateSeat', { seat });
      }
    },
    [setToken, status],
  );

  const sendChat = useCallback(
    (text: string) => {
      const socket = socketRef.current;
      const join = joinRef.current;
      if (!socket || !join || status !== 'connected') {
        appendLog({
          type: 'system',
          text: 'Unable to send chat message right now',
          when: Date.now(),
          actor: SYSTEM_ACTOR,
        });
        return false;
      }
      const trimmed = text.trim();
      if (!trimmed) {
        return false;
      }
      socket.emit('chat', { roomId: join.roomId, name: join.name, text: trimmed });
      return true;
    },
    [appendLog, status],
  );

  const clearToken = useCallback(() => {
    setToken(null);
    persistToken(null);
  }, []);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!attemptedAutoJoinRef.current && token) {
      attemptedAutoJoinRef.current = true;
      if (token.role === 'spectator') {
        connect({
          serverUrl: token.serverUrl || defaultServerUrl,
          roomId: token.roomId,
          name: token.name,
          role: 'spectator',
          followSeat: token.followSeat,
        });
      } else if (token.seat) {
        connect({
          serverUrl: token.serverUrl || defaultServerUrl,
          roomId: token.roomId,
          seat: token.seat,
          name: token.name,
          role: 'player',
        });
      }
    }
  }, [connect, defaultServerUrl, token]);

  const effectiveServerUrl = useMemo(
    () => token?.serverUrl ?? defaultServerUrl,
    [defaultServerUrl, token?.serverUrl],
  );

  return {
    status,
    snapshot,
    error,
    logs,
    chatMessages,
    connect,
    disconnect,
    emitAction,
    sendChat,
    setReady,
    setFollowSeat,
    roster,
    lobby,
    token,
    clearToken,
    defaultServer: effectiveServerUrl,
    joinStatus,
    joinAckEnabled: ENABLE_JOIN_ACK_PROTOCOL,
  } as const;
}
