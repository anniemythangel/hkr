import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Card, MatchSnapshot, PlayerId, Suit } from '@hooker/shared';
import ConsolePanel from './components/ConsolePanel';
import ChatBox from './components/ChatBox';
import { useSocket } from './hooks/useSocket';
import { cardAssetUrl, suitFull } from './utils/cardAssets';


const DEFAULT_SERVER = import.meta.env.VITE_WS_URL ?? 'http://localhost:3001';
const PLAYER_IDS: PlayerId[] = ['A', 'B', 'C', 'D'];
const SUIT_LABEL: Record<Suit, string> = {
  clubs: 'Clubs ♣',
  diamonds: 'Diamonds ♦',
  hearts: 'Hearts ♥',
  spades: 'Spades ♠',
};

function cardKey(card: Card) {
  return `${card.rank}-${card.suit}`;
}

function getActiveSeat(snapshot: MatchSnapshot): PlayerId | null {
  switch (snapshot.phase) {
    case 'KittyDecision':
      return snapshot.kittyOfferee ?? null;
    case 'Discard':
      return snapshot.acceptor ?? null;
    case 'TrumpDeclaration':
      return snapshot.dealer;
    case 'TrickPlay': {
      if (!snapshot.currentTrick) return null;
      const { currentTrick, seating } = snapshot;
      const leaderIndex = seating.indexOf(currentTrick.leader);
      const turnIndex = (leaderIndex + currentTrick.cards.length) % seating.length;
      return seating[turnIndex];
    }
    default:
      return null;
  }
}

function formatCard(card: Card) {
  return `${card.rank} ${card.suit[0].toUpperCase()}`;
}

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

  const legalKeys = useMemo(() => {
    if (!snapshot) return new Set<string>();
    return new Set(snapshot.legalCards.map(cardKey));
  }, [snapshot]);

  const myTurn = useMemo(() => {
    if (!snapshot) return false;
    const active = getActiveSeat(snapshot);
    return active === playerId;
  }, [snapshot, playerId]);

  const activeSeat = snapshot ? getActiveSeat(snapshot) : null;

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
              <div className="table-status">
                <div>
                  <strong>Phase:</strong> {snapshot.phase}
                </div>
                <div className="dealer-line">
                  <strong>Dealer:</strong> {snapshot.dealer}
                  {snapshot.trump && (
                    <span className="trump-badge" aria-label={`Trump is ${SUIT_LABEL[snapshot.trump]}`}>
                      {SUIT_LABEL[snapshot.trump]}
                    </span>
                  )}
                </div>
                <div>
                  <strong>Kitty:</strong>{' '}
                  {snapshot.kittyTopCard ? formatCard(snapshot.kittyTopCard) : 'Hidden'}
                </div>
              </div>

              <div className="seat-grid" role="list" aria-label="Table seating">
                {snapshot.seating.map((seat) => {
                  const isDealer = snapshot.dealer === seat;
                  const isActive = activeSeat === seat;
                  const isSelf = seat === playerId;
                  const indicatorLabel = isSelf ? 'Your turn' : 'Acting';
                  return (
                    <div
                      key={seat}
                      className={`seat-card${isSelf ? ' seat-card-self' : ''}${isActive ? ' seat-card-active' : ''}`}
                      role="listitem"
                    >
                      <div className="seat-label-row">
                        <span className="seat-label">Seat {seat}</span>
                        {isDealer && <span className="badge badge-dealer">Dealer</span>}
                      </div>
                      <div className="seat-name">
                        {isSelf ? displayName : `Player ${seat}`}
                        {isActive && (
                          <span className="turn-indicator" aria-hidden="true">
                            {indicatorLabel}
                          </span>
                        )}
                      </div>
                      {isActive && isSelf && <span className="sr-only">It is your turn.</span>}
                    </div>
                  );
                })}
              </div>

              <div className="scoreboard" aria-label="Scores">
                {Object.entries(snapshot.scores).map(([team, value]) => (
                  <div key={team} className="score-card">
                    <div className="score-team">{team}</div>
                    <div className="score-players">
                      {snapshot.teamAssignments[team as keyof typeof snapshot.teamAssignments].join(' & ')}
                    </div>
                    <div className="score-value">{value} / 10</div>
                  </div>
                ))}
              </div>

              {snapshot.lastHandSummary && (
                <div className="badge badge-info">
                  Last hand: Team {snapshot.lastHandSummary.winningTeam} +{snapshot.lastHandSummary.points}
                </div>
              )}

              <section className="hand-panel" aria-label="Your hand">
                <header className="hand-header">
                  <h3>Your Hand</h3>
                  {myTurn ? (
                    <span className="badge badge-turn" aria-live="polite">
                      Your move
                    </span>
                  ) : (
                    <span className="subtle">Waiting for other players</span>
                  )}
                </header>
                <div className="hand-cards">
                  {snapshot.selfHand.map((card) => {
                    const key = cardKey(card);
                    const legal = legalKeys.has(key);
                    const actionable = myTurn && legal;
                    return (
                      <button
                        type="button"
                          key={key}
                          className={`card ${legal ? 'legal' : ''} ${actionable ? 'actionable' : ''}`}
                          onClick={() => {
                            if (!actionable) return;
                            if (snapshot.phase === 'Discard') {
                              handleDiscard(card);
                            } else if (snapshot.phase === 'TrickPlay') {
                              handlePlayCard(card);
                            }
                          }}
                          disabled={!actionable}
                          aria-label={`${card.rank} of ${suitFull(card.suit)}`}  // so SR users hear the card
                        >
                          <img
                            src={cardAssetUrl(card)}
                            alt=""                     // img itself is decorative; the button has the label
                            className="card-img"
                            draggable={false}
                          />
                      </button>
                    );
                  })}
                </div>
              </section>

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

              <section className="current-trick" aria-live="polite">
                <h3>Current Trick</h3>
                {snapshot.currentTrick ? (
                  <ul className="trick-cards">
                    {snapshot.currentTrick.cards.map((entry) => (
                      <li key={`${entry.player}-${cardKey(entry.card)}`} className="trick-card">
                        <span className="trick-player">{entry.player}</span>
                        <img
                          src={cardAssetUrl(entry.card)}
                          alt={formatCard(entry.card)} // Alt text describes the card
                          className="card-img"
                          draggable={false}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="subtle">No active trick.</p>
                )}
              </section>

              <section className="completed-tricks">
                <h3>Completed Tricks</h3>
                <div className="trick-list">
                  {snapshot.completedTricks.map((trick, index) => (
                    <div key={index} className="trick-summary">
                      <div className="trick-header">
                        <strong>Trick {index + 1}</strong>
                        <span>Winner: {trick.winner}</span>
                      </div>
                      <ul className="trick-cards">
                        {trick.cards.map((entry) => (
                          <li key={`${entry.player}-${cardKey(entry.card)}`} className="trick-card">
                            <span className="trick-player">{entry.player}</span>
                            <img
                              src={cardAssetUrl(entry.card)}
                              alt={formatCard(entry.card)}
                              className="card-img"
                              draggable={false}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
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
