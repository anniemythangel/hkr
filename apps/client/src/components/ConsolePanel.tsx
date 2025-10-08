import { useEffect, useMemo, useRef } from 'react';
import type { ConsoleEntry } from '../hooks/useSocket';

interface ConsolePanelProps {
  entries: ConsoleEntry[];
}

const NEAR_BOTTOM_OFFSET = 60;

function isNearBottom(element: HTMLElement, offset = NEAR_BOTTOM_OFFSET) {
  const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
  return distanceFromBottom <= offset;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

export function ConsolePanel({ entries }: ConsolePanelProps) {
  const scrollRef = useRef<HTMLElement | null>(null);
  const shouldStickRef = useRef(true);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const handleScroll = () => {
      shouldStickRef.current = isNearBottom(node);
    };

    handleScroll();
    node.addEventListener('scroll', handleScroll);
    return () => {
      node.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const items = useMemo(() => {
    return entries.slice(-100).sort((a, b) => a.when - b.when);
  }, [entries]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    if (shouldStickRef.current) {
      node.scrollTop = node.scrollHeight;
    }
  }, [items]);

  return (
    <div className="panel-block">
      <h2 className="panel-title">Action Console</h2>
      <section
        aria-label="Game log"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-atomic="false"
        tabIndex={0}
        className="log-region"
        ref={scrollRef}
      >
        {/*
          role="log" with aria-live="polite" ensures assistive tech announces new entries in order.
          See MDN for guidance on log role and polite live regions:
          https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/log_role
          https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live
        */}
        <ul className="log-list">
          {items.map((entry) => {
            const actorName = entry.actor?.name ?? entry.actor?.seat ?? 'System';
            const key = `${entry.when}-${entry.text}`;
            return (
              <li
                key={key}
                className={`log-entry log-entry-${entry.type} ${entry.private ? 'log-entry-private' : ''}`.trim()}
              >
                <div className="log-meta">
                  <span className="log-time" aria-hidden="true">
                    {formatTime(entry.when)}
                  </span>
                  <span className="log-actor">{actorName}</span>
                  {entry.private ? <span className="log-private">Private</span> : null}
                </div>
                <span className="log-text">{entry.text}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export default ConsolePanel;
