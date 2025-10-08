import { useState } from 'react';
import type { Card, Phase } from '@hooker/shared';
import { cardAssetUrl, suitFull } from '../utils/cardAssets';

interface HandProps {
  cards: Card[];
  legalKeys: Set<string>;
  actionable: boolean;
  phase: Phase;
  onDiscard: (card: Card) => void;
  onPlay: (card: Card) => void;
}

function cardKey(card: Card) {
  return `${card.rank}-${card.suit}`;
}

export function Hand({ cards, legalKeys, actionable, phase, onDiscard, onPlay }: HandProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleAction = (card: Card) => {
    if (!actionable) return;
    if (phase === 'Discard') {
      onDiscard(card);
    } else if (phase === 'TrickPlay') {
      onPlay(card);
    }
  };

  return (
    <ul className="hand" role="list" aria-label="Your cards">
      {cards.map((card) => {
        const key = cardKey(card);
        const legal = legalKeys.has(key);
        const isDisabled = !actionable || !legal;
        const labelParts = [`${card.rank} of ${suitFull(card.suit)}`];
        labelParts.push(isDisabled ? 'disabled' : 'legal');

        return (
          <li key={key} className="hand-card">
            <button
              type="button"
              className={`card card-button${legal ? ' card-legal' : ''}${selected === key ? ' card-selected' : ''}${
                isDisabled ? ' card-disabled' : ''
              }`}
              onClick={() => {
                if (isDisabled) return;
                handleAction(card);
              }}
              onKeyDown={(event) => {
                if (isDisabled) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleAction(card);
                }
              }}
              onPointerDown={(event) => {
                if (isDisabled) return;
                setSelected(key);
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerUp={(event) => {
                if (selected !== key) return;
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                setSelected(null);
                if (!isDisabled) {
                  handleAction(card);
                }
              }}
              onPointerCancel={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                setSelected((current) => (current === key ? null : current));
              }}
              onPointerLeave={() => {
                setSelected((current) => (current === key ? null : current));
              }}
              onBlur={() => {
                setSelected((current) => (current === key ? null : current));
              }}
              disabled={isDisabled}
              aria-label={labelParts.join(', ')}
            >
              <img src={cardAssetUrl(card)} alt="" className="card-img" draggable={false} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default Hand;
