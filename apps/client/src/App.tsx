import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Card, PlayerId, Suit } from '@hooker/shared';
import ConsolePanel from './components/ConsolePanel';
import ChatBox from './components/ChatBox';
import TableLayout from './components/TableLayout';
import { useSocket } from './hooks/useSocket';

const DEFAULT_SERVER = import.meta.env.VITE_WS_URL ?? 'http://localhost:3001';
const PLAYER_IDS: PlayerId[] = ['A', 'B', 'C', 'D'];
const SUIT_LABEL: Record<Suit, string> = {
  clubs: 'Clubs ♣',
  diamonds: 'Diamonds ♦',
  hearts: 'Hearts ♥',
  spades: 'Spades ♠',
};

function App() {
  const {
    status,
    snapshot,
    error: socketError,
    logs,
    chatMessages,
    connect,
    emitAction,
    sendChat,
    roster,
    token,
    clearToken,
    defaultServer,
  } = useSocket(DEFAULT_SERVER);

  const [serverUrl, setServerUrl] = useState(token?.serverUrl ?? defaultServer);
  const [roomId, setRoomId] = useState(token?.roomId ?? 'demo');
  const [playerId, setPlayerId] = useState<PlayerId>(token?.seat ?? 'A');
  const [name, setName] = useState(token?.name ?? `Player ${token?.seat ?? 'A'}`);
  const [formError, setFormError] = useState<string | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'chat'>('console');

  useEffect(() => {
    const query = window.matchMedia('(max-width: 960px)');
    const handleChange = () => setIsNarrow(query.matches);
    handleChange();
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!isNarrow) {
      setActiveTab('console');
    }
  }, [isNarrow]);

  useEffect(() => {
    if (token) {
      setServerUrl(token.serverUrl || DEFAULT_SERVER);
      setRoomId(token.roomId);
      setPlayerId(token.seat);
      setName(token.name);
    }
  }, [token]);

  useEffect(() => {
    setName((previous) => {
      if (!previous || /^Player [A-D]$/.test(previous)) {
        return `Player ${playerId}`;
      }
      return previous;
    });
  }, [playerId]);

  const combinedError = formError ?? socketError ?? null;
  const displayName = name.trim() || `Player ${playerId}`;

  const nameForSeat = useMemo(
    () => (seat: PlayerId) => roster?.[seat]?.name?.trim() || `Player ${seat}`,
    [roster],
  );

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!roomId.trim()) {
      setFormError('Room ID is required');
      return;
    }
    if (!name.trim()) {
      setFormError('Display name is required');
      return;
    }
    setFormError(null);
    connect({ serverUrl, roomId, seat: playerId, name });
  };

  const emit = (event: string, payload: unknown) => {
    emitAction(event, payload);
  };

  const handleKittyDecision = (accept: boolean) => emit('kittyDecision', { accept });
  const handleDiscard = (card: Card) => emit('discard', { card });
  const handleDeclareTrump = (suit: Suit) => emit('declareTrump', { suit });
  const handlePlayCard = (card: Card) => emit('playCard', { card });

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1 className="title">Hooker Engine Demo</h1>
          <p className="subtitle">Friendlier MVP preview</p>
        </div>
        <div className="status-chip" role="status" aria-live="polite">
          Status: {status}
        </div>
      </header>

      <main className="app-grid">
        <div className="table-area">
          <form className="panel join-panel" onSubmit={handleJoin}>
            <h2 className="panel-heading">Sit at a table</h2>
            <div className="form-grid">
              <label>
                <span>Server</span>
                <input
                  value={serverUrl}
                  onChange={(event) => setServerUrl(event.target.value)}
                  placeholder={defaultServer}
                  autoComplete="off"
                />
              </label>
              <label>
                <span>Room ID</span>
                <input value={roomId} onChange={(event) => setRoomId(event.target.value)} autoComplete="off" />
              </label>
              <label>
                <span>Seat</span>
                <select value={playerId} onChange={(event) => setPlayerId(event.target.value as PlayerId)}>
                  {PLAYER_IDS.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Display name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
              </label>
            </div>
            <div className="form-actions">
              <button type="submit">Join room</button>
              {token && (
                <button type="button" className="link-button" onClick={clearToken}>
                  Clear saved seat
                </button>
              )}
            </div>
            {combinedError && <div className="error">{combinedError}</div>}
          </form>

          {snapshot ? (
            <section className="panel table-panel" aria-live="polite">
              <TableLayout
                snapshot={snapshot}
                playerId={playerId}
                displayName={displayName}
                nameForSeat={nameForSeat}
                onDiscard={handleDiscard}
                onPlay={handlePlayCard}
              />

              <div className="action-row">
                {snapshot.phase === 'KittyDecision' && snapshot.kittyOfferee === playerId && (
                  <>
                    <button type="button" onClick={() => handleKittyDecision(true)}>
                      Accept kitty
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKittyDecision(false)}
                      disabled={snapshot.forcedAccept && snapshot.kittyOfferee === snapshot.acceptor}
                    >
                      Pass
                    </button>
                  </>
                )}

                {snapshot.phase === 'TrumpDeclaration' && snapshot.dealer === playerId && (
                  <div className="trump-actions" role="group" aria-label="Declare trump">
                    {(Object.keys(SUIT_LABEL) as Suit[]).map((suit) => (
                      <button key={suit} type="button" onClick={() => handleDeclareTrump(suit)}>
                        Declare {SUIT_LABEL[suit]}
                      </button>
                    ))}
                  </div>
                )}

                {snapshot.phase === 'Discard' && snapshot.acceptor === playerId && (
                  <span className="subtle">Select a card above to discard.</span>
                )}
              </div>
            </section>
          ) : (
            <section className="panel placeholder-panel" aria-live="polite">
              <p>Join a room to see cards and actions.</p>
            </section>
          )}
        </div>

        {isNarrow ? (
          <div className="tabbed-panel">
            <div className="tablist" role="tablist" aria-label="Console and chat">
              <button
                type="button"
                role="tab"
                id="console-tab"
                aria-selected={activeTab === 'console'}
                aria-controls="console-panel"
                onClick={() => setActiveTab('console')}
              >
                Console
              </button>
              <button
                type="button"
                role="tab"
                id="chat-tab"
                aria-selected={activeTab === 'chat'}
                aria-controls="chat-panel"
                onClick={() => setActiveTab('chat')}
              >
                Chat
              </button>
            </div>
            <div
              id="console-panel"
              role="tabpanel"
              aria-labelledby="console-tab"
              hidden={activeTab !== 'console'}
              className="tab-panel"
            >
              <ConsolePanel entries={logs} />
            </div>
            <div
              id="chat-panel"
              role="tabpanel"
              aria-labelledby="chat-tab"
              hidden={activeTab !== 'chat'}
              className="tab-panel"
            >
              <ChatBox messages={chatMessages} onSend={sendChat} disabled={status !== 'connected'} name={displayName} />
            </div>
          </div>
        ) : (
          <aside className="side-panel">
            <ConsolePanel entries={logs} />
            <ChatBox messages={chatMessages} onSend={sendChat} disabled={status !== 'connected'} name={displayName} />
          </aside>
        )}
      </main>
    </div>
  );
}

export default App;
