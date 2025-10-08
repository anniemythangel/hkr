import type { PlayerId } from '@hooker/shared';
import type { ReactNode } from 'react';
import DealerChip from './DealerChip';

interface SeatProps {
  seat: PlayerId;
  name: string;
  isSelf: boolean;
  isDealer: boolean;
  isActive: boolean;
  cardsRemaining?: number;
  children?: ReactNode;
}

export function Seat({
  seat,
  name,
  isSelf,
  isDealer,
  isActive,
  cardsRemaining,
  children,
}: SeatProps) {
  const seatLabel = isSelf ? 'You' : `Seat ${seat}`;
  return (
    <section
      className={`seat-panel${isSelf ? ' seat-panel-self' : ''}${isActive ? ' seat-panel-active' : ''}`}
      aria-label={`${seatLabel}${isActive ? ', currently acting' : ''}`.trim()}
    >
      <header className="seat-panel-header">
        <div className="seat-panel-names">
          <span className="seat-panel-seat">{seatLabel}</span>
          <span className="seat-panel-name" aria-live="polite">
            {name}
          </span>
        </div>
        <div className="seat-panel-badges">
          {isActive ? (
            <span className="badge badge-turn" role="status" aria-label={isSelf ? 'Your turn' : `${name}'s turn`}>
              {isSelf ? 'Your turn' : 'Acting'}
            </span>
          ) : null}
          {isDealer ? <DealerChip /> : null}
        </div>
      </header>
      {!isSelf && typeof cardsRemaining === 'number' ? (
        <p className="seat-panel-hand-count" aria-live="polite">
          {cardsRemaining} card{cardsRemaining === 1 ? '' : 's'} remaining
        </p>
      ) : null}
      {children ? <div className="seat-panel-body">{children}</div> : null}
    </section>
  );
}

export default Seat;
