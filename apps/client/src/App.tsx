import { FormEvent, useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Card, MatchSnapshot, PlayerId, Suit } from '@hooker/shared';

const DEFAULT_SERVER = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';
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

function getTrickPlayer(snapshot: MatchSnapshot): PlayerId | null {
  if (snapshot.phase !== 'TrickPlay' || !snapshot.currentTrick) {
    return null;
  }
  const { currentTrick, seating } = snapshot;
  const leaderIndex = seating.indexOf(currentTrick.leader);
  const turnIndex = (leaderIndex + currentTrick.cards.length) % seating.length;
  return seating[turnIndex];
}

function App() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const [roomId, setRoomId] = useState('demo');
  const [playerId, setPlayerId] = useState<PlayerId>('A');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      socket?.disconnect();
    };
  }, [socket]);

  const legalKeys = useMemo(() => {
    if (!snapshot) return new Set<string>();
    return new Set(snapshot.legalCards.map(cardKey));
  }, [snapshot]);

  const joinRoom = (event: FormEvent) => {
    event.preventDefault();
    if (!roomId.trim()) {
      setError('Room ID is required');
      return;
    }
    setError(null);
    socket?.disconnect();
    const client = io(serverUrl, { autoConnect: false });
    setSocket(client);
    setStatus('connecting');

    client.on('connect', () => {
      setStatus('connected');
      client.emit('join', { roomId, player: playerId });
    });

    client.on('disconnect', () => {
      setStatus('disconnected');
    });

    client.on('snapshot', (data: MatchSnapshot) => {
      setSnapshot(data);
    });

    client.on('errorMessage', (message: string) => {
      setError(message);
    });

    client.connect();
  };

  const emit = (event: string, payload: unknown) => {
    if (!socket || status !== 'connected') {
      setError('Not connected to server');
      return;
    }
    socket.emit(event, payload);
  };

  const handleKittyDecision = (accept: boolean) => emit('kittyDecision', { accept });
  const handleDiscard = (card: Card) => emit('discard', { card });
  const handleDeclareTrump = (suit: Suit) => emit('declareTrump', { suit });
  const handlePlayCard = (card: Card) => emit('playCard', { card });

  const myTurn = useMemo(() => {
    if (!snapshot) return false;
    if (snapshot.phase === 'KittyDecision') return snapshot.kittyOfferee === playerId;
    if (snapshot.phase === 'Discard') return snapshot.acceptor === playerId;
    if (snapshot.phase === 'TrumpDeclaration') return snapshot.dealer === playerId;
    if (snapshot.phase === 'TrickPlay') return getTrickPlayer(snapshot) === playerId;
    return false;
  }, [snapshot, playerId]);

  return (
    <div className="container">
      <header className="header">
        <h1>Hooker Engine Demo</h1>
        <span className="badge">Status: {status}</span>
      </header>

      <form className="panel" onSubmit={joinRoom}>
        <h2>Join a Room</h2>
        <div className="actions">
          <label>
            Server
            <input
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              placeholder="http://localhost:3001"
            />
          </label>
          <label>
            Room ID
            <input value={roomId} onChange={(event) => setRoomId(event.target.value)} />
          </label>
          <label>
            Seat
            <select value={playerId} onChange={(event) => setPlayerId(event.target.value as PlayerId)}>
              {PLAYER_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Join</button>
        </div>
        {error && <div className="error">{error}</div>}
      </form>

      {snapshot && (
        <section className="panel">
          <div className="status-bar">
            <div>
              <strong>Phase:</strong> {snapshot.phase}
            </div>
            <div>
              <strong>Dealer:</strong> {snapshot.dealer}
            </div>
            <div>
              <strong>Trump:</strong> {snapshot.trump ? SUIT_LABEL[snapshot.trump] : 'Pending'}
            </div>
            <div>
              <strong>Kitty:</strong>{' '}
              {snapshot.kittyTopCard ? `${snapshot.kittyTopCard.rank} ${snapshot.kittyTopCard.suit}` : 'Hidden'}
            </div>
          </div>

          <div className="scoreboard">
            {Object.entries(snapshot.scores).map(([team, value]) => (
              <div key={team}>
                <strong>{team}</strong>
                <div className="small">{snapshot.teamAssignments[team as keyof typeof snapshot.teamAssignments].join(' & ')}</div>
                <div>{value} / 10</div>
              </div>
            ))}
          </div>

          {snapshot.lastHandSummary && (
            <div className="small badge" style={{ marginTop: '1rem' }}>
              Last hand: Team {snapshot.lastHandSummary.winningTeam} +{snapshot.lastHandSummary.points} pts
            </div>
          )}

          <div style={{ marginTop: '1.5rem' }}>
            <h3>Your Hand</h3>
            <div>
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
                  >
                    {card.rank} {card.suit[0].toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="actions">
            {snapshot.phase === 'KittyDecision' && snapshot.kittyOfferee === playerId && (
              <>
                <button type="button" onClick={() => handleKittyDecision(true)}>
                  Accept Kitty
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
              <>
                {(['clubs', 'diamonds', 'hearts', 'spades'] as Suit[]).map((suit) => (
                  <button key={suit} type="button" onClick={() => handleDeclareTrump(suit)}>
                    Declare {SUIT_LABEL[suit]}
                  </button>
                ))}
              </>
            )}

            {snapshot.phase === 'Discard' && snapshot.acceptor === playerId && (
              <span className="small">Select a card above to discard.</span>
            )}

            {snapshot.phase === 'TrickPlay' && !myTurn && (
              <span className="small">Waiting for other players...</span>
            )}
          </div>

          <section className="panel" style={{ marginTop: '1.5rem' }}>
            <h3>Current Trick</h3>
            {snapshot.currentTrick ? (
              <div className="small">
                Leader: {snapshot.currentTrick.leader}
                <div>
                  {snapshot.currentTrick.cards.map((entry) => (
                    <span key={`${entry.player}-${cardKey(entry.card)}`} className="card">
                      {entry.player}: {entry.card.rank} {entry.card.suit[0].toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="small">No active trick.</div>
            )}
          </section>

          <section className="panel">
            <h3>Completed Tricks</h3>
            <div className="trick-list">
              {snapshot.completedTricks.map((trick, index) => (
                <div key={index} className="small">
                  <strong>Trick {index + 1}</strong> — Winner: {trick.winner}
                  <div>
                    {trick.cards.map((entry) => (
                      <span key={`${entry.player}-${cardKey(entry.card)}`} className="card">
                        {entry.player}: {entry.card.rank} {entry.card.suit[0].toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      )}
    </div>
  );
}

export default App;
