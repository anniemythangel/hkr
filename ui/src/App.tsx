import { useMemo } from 'react';
import clsx from 'clsx';
import { useGameClient } from './hooks/useGameClient';
import type { CardSnapshot, GameSnapshot, SeatSnapshot, Suit } from './types/game';
import { suitToIcon, suitToLabel } from './utils/suits';

const suitOrder: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];

const suitColors: Record<Suit, string> = {
  clubs: '#16a34a',
  diamonds: '#f87171',
  hearts: '#f472b6',
  spades: '#38bdf8'
};

const formatRank = (rank: string) => rank.toUpperCase();

const Card = ({
  card,
  disabled,
  onClick,
  highlightLegal = true
}: {
  card: CardSnapshot;
  disabled: boolean;
  onClick: () => void;
  highlightLegal?: boolean;
}) => {
  return (
    <button
      type="button"
      className={clsx('card', disabled && 'card--disabled', highlightLegal && card.isLegal && 'card--legal')}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="card__rank">{formatRank(card.rank)}</span>
      <span className={clsx('card__suit', `card__suit--${card.suit}`)}>{suitToIcon(card.suit)}</span>
    </button>
  );
};

const Seat = ({
  seat,
  onSeatAction
}: {
  seat: SeatSnapshot;
  onSeatAction: (seat: SeatSnapshot) => void;
}) => {
  return (
    <div
      className={clsx('seat', seat.isTurn && 'seat--turn', seat.isYou && 'seat--you')}
      style={{ ['--avatar-color' as string]: seat.avatarColor }}
    >
      <div className="seat__header">
        <span className="seat__label">{seat.label}</span>
        <span className={clsx('seat__team', seat.isYou && 'seat__team--you')}>
          {seat.isYou ? 'You' : seat.playerName ? 'Teammate' : 'Open'}
        </span>
      </div>
      <div className="seat__avatar-ring">
        <div className="seat__avatar" aria-hidden>{seat.playerName?.charAt(0) ?? '?'}</div>
      </div>
      <div className="seat__body">
        <span className="seat__name">{seat.playerName ?? 'Seat open'}</span>
        <div className="seat__actions">
          {seat.playerName ? (
            <button type="button" onClick={() => onSeatAction(seat)} className="seat__action-btn">
              {seat.isYou ? 'Ready' : seat.canSwap ? 'Request swap' : seat.isReady ? 'Ready' : 'Not ready'}
            </button>
          ) : (
            <button type="button" onClick={() => onSeatAction(seat)} className="seat__action-btn">
              Take seat
            </button>
          )}
        </div>
      </div>
      {seat.isTurn && <div className="seat__turn-indicator" aria-hidden />}
    </div>
  );
};

const Scoreboard = ({ game }: { game: GameSnapshot }) => {
  const target = game.scoreboard.target;
  const teamAProgress = Math.min(game.scoreboard.teamA / target, 1);
  const teamBProgress = Math.min(game.scoreboard.teamB / target, 1);

  return (
    <aside className="scoreboard">
      <h2 className="scoreboard__title">Scoreboard</h2>
      <div className="scoreboard__row">
        <span>Team A</span>
        <div className="scoreboard__bar">
          <div className="scoreboard__bar-fill scoreboard__bar-fill--a" style={{ width: `${teamAProgress * 100}%` }} />
        </div>
        <span>{game.scoreboard.teamA}</span>
      </div>
      <div className="scoreboard__row">
        <span>Team B</span>
        <div className="scoreboard__bar">
          <div className="scoreboard__bar-fill scoreboard__bar-fill--b" style={{ width: `${teamBProgress * 100}%` }} />
        </div>
        <span>{game.scoreboard.teamB}</span>
      </div>
      <p className="scoreboard__target">First to {target} points wins</p>
    </aside>
  );
};

const TrickPile = ({ game }: { game: GameSnapshot }) => {
  if (!game.trick) {
    return (
      <div className="trick trick--empty">
        <p>Trick pile empty</p>
      </div>
    );
  }

  const leaderSeat = game.seats.find((seat) => seat.id === game.trick?.leaderSeatId);

  return (
    <div className="trick">
      <header className="trick__header">
        <span className="trick__title">Trick #{game.trick.id.split('-').pop()}</span>
        {leaderSeat && <span className="trick__subtitle">Led by {leaderSeat.playerName ?? leaderSeat.label}</span>}
      </header>
      <div className="trick__plays">
        {game.trick.plays.map((play) => {
          const seat = game.seats.find((s) => s.id === play.seatId);
          return (
            <div key={play.card.id} className="trick__play">
              <span className="trick__play-seat">{seat?.playerName ?? seat?.label ?? 'Unknown'}</span>
              <Card card={play.card} disabled onClick={() => {}} highlightLegal={false} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const KittyPanel = ({ game, onDiscard }: { game: GameSnapshot; onDiscard: (cardId: string) => void }) => {
  if (!game.kitty) return null;

  return (
    <section className="kitty">
      <header className="kitty__header">
        <span className="kitty__title">Kitty</span>
        <span className="kitty__subtitle">Owner: {game.seats.find((seat) => seat.id === game.kitty?.ownerSeatId)?.playerName ?? 'Unknown'}</span>
      </header>
      <div className="kitty__cards">
        {game.kitty.cards.map((card) => (
          <div key={card.id} className="kitty__card">
            <span className="kitty__rank">{formatRank(card.rank)}</span>
            <span className={clsx('kitty__suit', `kitty__suit--${card.suit}`)}>{suitToIcon(card.suit)}</span>
          </div>
        ))}
      </div>
      {game.kitty.trumpSuit && (
        <div className="kitty__trump">
          Trump: <span className={clsx('kitty__trump-badge', `kitty__trump-badge--${game.kitty.trumpSuit}`)}>{suitToLabel(game.kitty.trumpSuit)}</span>
        </div>
      )}
      {game.phase === 'KittyExchange' && game.kitty.cards.length > 0 && (
        <button type="button" className="kitty__discard-btn" onClick={() => onDiscard(game.kitty!.cards[0]!.id)}>
          Discard first card
        </button>
      )}
    </section>
  );
};

const Toast = ({ message }: { message: string }) => {
  return (
    <div className="toast" role="alert">
      {message}
    </div>
  );
};

const suitSelection = suitOrder.map((suit) => ({ suit, label: suitToLabel(suit), color: suitColors[suit] }));

const TrumpSelector = ({ onSelect }: { onSelect: (suit: Suit) => void }) => (
  <div className="trump-selector">
    <span className="trump-selector__label">Choose trump</span>
    <div className="trump-selector__options">
      {suitSelection.map((option) => (
        <button
          key={option.suit}
          type="button"
          className="trump-selector__option"
          style={{ ['--color' as string]: option.color }}
          onClick={() => onSelect(option.suit)}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

const LobbyActions = ({ game, onReady, onCopyLink }: { game: GameSnapshot; onReady: () => void; onCopyLink: () => void }) => (
  <div className="lobby-actions">
    <div className="lobby-actions__group">
      <span className="lobby-actions__label">Room code</span>
      <div className="lobby-actions__code">{game.roomCode}</div>
    </div>
    <button type="button" className="lobby-actions__button" onClick={onReady}>
      Ready up
    </button>
    <button type="button" className="lobby-actions__button lobby-actions__button--secondary" onClick={onCopyLink}>
      Copy invite link
    </button>
  </div>
);

const StatusLog = ({ game }: { game: GameSnapshot }) => (
  <section className="status-log">
    <h3 className="status-log__title">Log</h3>
    <ul className="status-log__list">
      {game.statusLog.map((entry) => (
        <li key={entry.id} className="status-log__item">
          <span className="status-log__time">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="status-log__message">{entry.message}</span>
        </li>
      ))}
    </ul>
  </section>
);

export default function App() {
  const { snapshot, loading, lastError, toast, send } = useGameClient();

  const game = snapshot;

  const handActions = useMemo(() => {
    if (!game) return null;
    return {
      onPlay: (cardId: string) => send({ type: 'PlayCard', cardId }),
      onDiscard: (cardId: string) => send({ type: 'DiscardCard', cardId })
    };
  }, [game, send]);

  if (loading) {
    return <div className="app app--loading">Loading latest game…</div>;
  }

  if (lastError) {
    return <div className="app app--error">{lastError}</div>;
  }

  if (!game) {
    return <div className="app app--error">No game snapshot available.</div>;
  }

  return (
    <div className="app">
      {toast && <Toast message={toast} />}
      {game.isYourTurn && <div className="app__turn-banner">Your turn</div>}
      <header className="app__header">
        <div>
          <h1>Room {game.roomCode}</h1>
          <p className="app__phase">Phase: {game.phase}</p>
        </div>
        {game.phase === 'Lobby' && (
          <LobbyActions
            game={game}
            onReady={() => send({ type: 'ReadyUp', seatId: game.youSeatId ?? '' })}
            onCopyLink={() => {
              const invite = `${window.location.origin}/join/${game.roomCode}`;
              if ('clipboard' in navigator && navigator.clipboard) {
                navigator.clipboard.writeText(invite).catch(() => {
                  window.alert(`Invite link: ${invite}`);
                });
              } else {
                window.alert(`Invite link: ${invite}`);
              }
            }}
          />
        )}
        {game.phase === 'TrumpDeclaration' && <TrumpSelector onSelect={(suit) => send({ type: 'DeclareTrump', suit })} />}
      </header>

      <main className="app__layout">
        <Scoreboard game={game} />
        <div className="app__table">
          <section className="seats">
            {game.seats.map((seat) => (
              <Seat
                key={seat.id}
                seat={seat}
                onSeatAction={(target) => {
                  if (!target.playerName) {
                    send({ type: 'TakeSeat', seatId: target.id });
                    return;
                  }
                  if (target.isYou) {
                    send({ type: 'ReadyUp', seatId: target.id });
                  } else if (target.canSwap) {
                    send({ type: 'RequestSwap', seatId: target.id });
                  }
                }}
              />
            ))}
          </section>

          <TrickPile game={game} />

          <section className="hand">
            <header className="hand__header">
              <h2>Your hand</h2>
              <div className="hand__hint">
                {game.pendingAction === 'Discard'
                  ? 'Choose a card to discard back to the kitty'
                  : game.pendingAction === 'DeclareTrump'
                  ? 'Declare a trump suit to continue'
                  : 'Drag or tap a highlighted card to play'}
              </div>
            </header>
            <div className="hand__cards">
              {game.yourHand.map((card) => (
                <Card
                  key={card.id}
                  card={card}
                  disabled={!game.legalCardIds.includes(card.id)}
                  highlightLegal={game.legalCardIds.includes(card.id)}
                  onClick={() => handActions?.onPlay(card.id)}
                />
              ))}
            </div>
            {game.phase === 'KittyExchange' && game.legalCardIds.length > 0 && (
              <div className="hand__helper">
                <button type="button" onClick={() => handActions?.onDiscard(game.legalCardIds[0])}>
                  Discard selected card
                </button>
              </div>
            )}
          </section>

          <KittyPanel game={game} onDiscard={(cardId) => handActions?.onDiscard(cardId)} />

          <StatusLog game={game} />
        </div>
      </main>
    </div>
  );
}
