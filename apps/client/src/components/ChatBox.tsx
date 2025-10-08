import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '../hooks/useSocket';

interface ChatBoxProps {
  messages: ChatMessage[];
  onSend: (message: string) => boolean;
  disabled?: boolean;
  name: string;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

export function ChatBox({ messages, onSend, disabled = false, name }: ChatBoxProps) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  const visibleMessages = useMemo(() => messages.slice(-100), [messages]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim()) return;
    const success = onSend(draft);
    if (success) {
      setDraft('');
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!draft.trim()) return;
      const success = onSend(draft);
      if (success) {
        setDraft('');
      }
    }
  };

  return (
    <div className="panel-block">
      <h2 className="panel-title">Table Chat</h2>
      <section
        aria-label="Chat log"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-atomic="false"
        tabIndex={0}
        className="log-region"
      >
        <ul ref={listRef} className="log-list">
          {visibleMessages.map((message) => (
            <li key={`${message.when}-${message.text}`} className="chat-entry">
              <span className="chat-meta" aria-hidden="true">
                {formatTime(message.when)} · {message.name}
              </span>
              <span className="chat-text">{message.text}</span>
            </li>
          ))}
        </ul>
      </section>
      <form className="chat-form" onSubmit={handleSubmit}>
        <label htmlFor="chat-input" className="sr-only">
          Send a message as {name}
        </label>
        <textarea
          id="chat-input"
          name="chat"
          placeholder={disabled ? 'Connect to chat' : `Message as ${name}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={2}
        />
        <button type="submit" disabled={disabled || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatBox;
