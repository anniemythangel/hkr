import { useEffect, useMemo, useState } from 'react';
import type { GameAction, GameSnapshot } from '../types/game';
import { mockGameClient, MockGameClient } from '../services/mockGameClient';

export interface GameClientHook {
  snapshot: GameSnapshot | null;
  loading: boolean;
  lastError: string | null;
  toast: string | null;
  send: (action: GameAction) => void;
}

const isDevelopment = typeof import.meta !== 'undefined' ? import.meta.env?.DEV ?? true : true;

export const useGameClient = (): GameClientHook => {
  const client = useMemo(() => {
    if (isDevelopment) {
      return mockGameClient;
    }
    return new MockGameClient();
  }, []);

  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const unsub = client.subscribe((event) => {
      if (event.type === 'snapshot') {
        setSnapshot(event.payload);
        setLoading(false);
      }
      if (event.type === 'error') {
        setLastError(event.payload);
        setLoading(false);
      }
      if (event.type === 'toast') {
        setToast(event.payload);
        setTimeout(() => setToast(null), 2500);
      }
    });

    client.connect();
    return () => {
      unsub();
      client.disconnect();
    };
  }, [client]);

  const send = (action: GameAction) => client.send(action);

  return { snapshot, loading, lastError, toast, send };
};
