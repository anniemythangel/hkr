import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlayerId, Suit, Trick } from '@hooker/shared';
import { cardAssetUrl, suitFull } from '../utils/cardAssets';

interface TrickAreaProps {
  trick?: Trick;
  nameForSeat: (seat: PlayerId) => string;
  trump?: Suit;
  seatingOrder: PlayerId[];
}

type PlayedCard = Trick['cards'][number];

const POSITIONS = ['bottom', 'left', 'top', 'right'] as const;

export function TrickArea({ trick, nameForSeat, trump, seatingOrder }: TrickAreaProps) {
  const [displayedCards, setDisplayedCards] = useState<PlayedCard[]>(trick?.cards ?? []);
  const [collectingSeat, setCollectingSeat] = useState<PlayerId | null>(null);
  const previousTrickRef = useRef<Trick | undefined>(undefined);

  useEffect(() => {
    const previous = previousTrickRef.current;
    const previousCards = previous?.cards ?? [];
    const previousCount = previousCards.length;
    const nextCards = trick?.cards ?? [];
    const nextCount = nextCards.length;

    const leaderChanged = previous && trick && trick.leader !== previous.leader;
    if (previousCount === 4 && (nextCount === 0 || leaderChanged)) {
      setDisplayedCards(previousCards);
      setCollectingSeat(previous?.winner ?? null);
      const timeout = window.setTimeout(() => {
        setCollectingSeat(null);
        setDisplayedCards(nextCards);
      }, 600);
      previousTrickRef.current = trick;
      return () => window.clearTimeout(timeout);
    }

    setDisplayedCards(nextCards);
    previousTrickRef.current = trick;
    return undefined;
  }, [trick]);

  const slots = useMemo(() => {
    return seatingOrder.map((seat, index) => {
      const entry = displayedCards.find((card) => card.player === seat);
      const position = POSITIONS[index] ?? 'top';
      return { seat, entry, position } as const;
    });
  }, [displayedCards, seatingOrder]);

  return (
    <section className="trick-area" aria-label="Current trick" role="region">
      <header className="trick-area-header">
        <h3 className="trick-area-title">Trick in play</h3>
        {trump ? (
          <p className="trick-area-trump" role="status" aria-live="polite">
            Trump: {suitFull(trump)}
          </p>
        ) : null}
      </header>
      <div className="trick-ring" role="list">
        {slots.map(({ seat, entry, position }) => {
          const name = nameForSeat(seat);
          const collecting = collectingSeat === seat;
          const occupied = Boolean(entry);
          const cardLabel = entry ? `${entry.card.rank} of ${suitFull(entry.card.suit)}` : '';
          return (
            <div
              key={seat}
              className={`trick-ring-slot trick-ring-slot-${position}${
                occupied ? ' trick-ring-slot-filled' : ''
              }${collecting ? ' trick-ring-slot-collecting' : ''}
              }`}
              role={occupied ? 'listitem' : undefined}
              aria-label={occupied ? `${name} played ${cardLabel}` : `${name} has not played yet`}
            >
              <span className="trick-slot-name" aria-hidden="true">
                {name}
              </span>
              {entry ? (
                <div className="trick-card" data-seat={seat}>
                  <img
                    src={cardAssetUrl(entry.card)}
                    alt=""
                    className={`card-img trick-card-img card-appear-${position}`}
                    draggable={false}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default TrickArea;
