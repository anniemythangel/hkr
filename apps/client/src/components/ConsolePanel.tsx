import { useEffect, useMemo, useRef } from 'react';
import type { ConsoleEntry } from '../hooks/useSocket';

interface ConsolePanelProps {
  entries: ConsoleEntry[];
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

export function ConsolePanel({ entries }: ConsolePanelProps) {
  const scrollRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [entries.length]);

  const items = useMemo(() => entries.slice(-100), [entries]);

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
      >
        <ul ref={scrollRef} className="log-list">
          {items.map((entry) => (
            <li key={`${entry.when}-${entry.text}`} className={`log-entry log-entry-${entry.type}`}>
              <span className="log-time" aria-hidden="true">
                {formatTime(entry.when)}
              </span>
              <span className="log-text">{entry.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default ConsolePanel;
