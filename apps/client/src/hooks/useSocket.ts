import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { MatchSnapshot, PlayerId } from '@hooker/shared';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

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

type Roster = Partial<Record<PlayerId, { name: string }>>;

export type ChatMessage = {
  name: string;
  text: string;
  when: number;
};

export type RejoinToken = {
  roomId: string;
  seat: PlayerId;
  name: string;
  serverUrl: string;
};

const STORAGE_KEY = 'hkr.rejoinToken';

function readToken(): RejoinToken | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RejoinToken;
    if (!parsed.roomId || !parsed.seat || !parsed.name) {
      return null;
    }
    return parsed;
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
  const [token, setToken] = useState<RejoinToken | null>(() => readToken());

  const socketRef = useRef<Socket | null>(null);
  const joinRef = useRef<RejoinToken | null>(token);
  const attemptedAutoJoinRef = useRef(false);
  const reconnectingRef = useRef(false);

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
      socket.emit('join', { roomId: join.roomId, player: join.seat, name: join.name });
      const message =
        reason === 'reconnect'
          ? `Restored seat ${join.seat} in room ${join.roomId}`
          : `Joining room ${join.roomId} as seat ${join.seat}`;
      appendLog({ type: 'system', text: message, when: Date.now(), actor: SYSTEM_ACTOR });
    },
    [appendLog],
  );

  const resetState = useCallback(() => {
    setSnapshot(null);
    setLogs([]);
    setChatMessages([]);
    setRoster({});
  }, []);

  const connect = useCallback(
    (params: { serverUrl?: string; roomId: string; seat: PlayerId; name: string }) => {
      const trimmedRoom = params.roomId.trim();
      const trimmedName = params.name.trim();
      const effectiveServer = (params.serverUrl?.trim() || defaultServerUrl).replace(/\/?$/, '');
      const join: RejoinToken = {
        roomId: trimmedRoom,
        seat: params.seat,
        name: trimmedName,
        serverUrl: effectiveServer,
      };

      joinRef.current = join;
      setToken(join);
      persistToken(join);

      socketRef.current?.disconnect();
      resetState();
      setError(null);
      setStatus('connecting');

      const socket = io(effectiveServer, {
        autoConnect: false,
        transports: ['websocket'],
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
        if (reason !== 'io client disconnect') {
          appendLog({ type: 'system', text: 'Disconnected from server', when: Date.now(), actor: SYSTEM_ACTOR });
        }
      });

      socket.on('snapshot', (data: MatchSnapshot) => {
        setSnapshot(data);
      });

      socket.on('roster', (data: Roster) => {
        setRoster(data ?? {});
      });

      socket.on('errorMessage', (message: string) => {
        setError(message);
      });

      socket.on('log', (entry: ConsoleEntry) => {
        appendLog(entry);
      });

      socket.on('chat', (entry: ChatMessage) => {
        appendChat(entry);
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
    [appendChat, appendLog, defaultServerUrl, emitJoin, resetState],
  );

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setStatus('disconnected');
    setSnapshot(null);
    setRoster({});
  }, []);

  const emitAction = useCallback(
    (event: string, payload: unknown) => {
      const socket = socketRef.current;
      if (!socket || status !== 'connected') {
        appendLog({ type: 'system', text: 'Not connected to server', when: Date.now(), actor: SYSTEM_ACTOR });
        return;
      }
      socket.emit(event, payload);
    },
    [appendLog, status],
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
      connect({
        serverUrl: token.serverUrl || defaultServerUrl,
        roomId: token.roomId,
        seat: token.seat,
        name: token.name,
      });
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
    roster,
    token,
    clearToken,
    defaultServer: effectiveServerUrl,
  } as const;
}
