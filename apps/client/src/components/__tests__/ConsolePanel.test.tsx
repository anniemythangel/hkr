/** @vitest-environment jsdom */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { ConsolePanel } from '../ConsolePanel';
import type { ConsoleEntry } from '../../hooks/useSocket';

function makeEntries(count: number): ConsoleEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    type: 'system' as const,
    text: `Entry ${index + 1}`,
    when: index + 1,
    actor: { seat: null, name: 'System' },
  }));
}

function setScrollMetrics(node: HTMLElement, values: { scrollHeight: number; clientHeight: number; scrollTop: number }) {
  Object.defineProperty(node, 'scrollHeight', { configurable: true, get: () => values.scrollHeight });
  Object.defineProperty(node, 'clientHeight', { configurable: true, get: () => values.clientHeight });
  Object.defineProperty(node, 'scrollTop', {
    configurable: true,
    get: () => values.scrollTop,
    set: (next: number) => {
      values.scrollTop = next;
    },
  });
}

describe('ConsolePanel sticky scrolling', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function mount(entries: ConsoleEntry[]) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<ConsolePanel entries={entries} />);
    });
    const log = container.querySelector('.log-region') as HTMLElement;
    return { container, root, log };
  }

  function update(root: Root, entries: ConsoleEntry[]) {
    act(() => {
      root.render(<ConsolePanel entries={entries} />);
    });
  }

  it('auto-scrolls on new entries while sticky', () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    const { root, log } = mount(makeEntries(2));
    const metrics = { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 };
    setScrollMetrics(log, metrics);

    act(() => {
      log.dispatchEvent(new Event('scroll'));
    });

    scrollIntoView.mockClear();
    update(root, makeEntries(3));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'end' });
  });

  it('does not force scroll while user is reading older entries', () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    const { root, log } = mount(makeEntries(2));
    const metrics = { scrollHeight: 1200, clientHeight: 400, scrollTop: 400 };
    setScrollMetrics(log, metrics);

    act(() => {
      log.dispatchEvent(new Event('scroll'));
    });

    scrollIntoView.mockClear();
    update(root, makeEntries(3));

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('resumes sticky scrolling once user returns near bottom', () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    const { root, log } = mount(makeEntries(2));
    const metrics = { scrollHeight: 1200, clientHeight: 400, scrollTop: 400 };
    setScrollMetrics(log, metrics);

    act(() => {
      log.dispatchEvent(new Event('scroll'));
    });

    update(root, makeEntries(3));
    expect(scrollIntoView).not.toHaveBeenCalled();

    metrics.scrollTop = 760; // 1200 - 760 - 400 = 40 (within near-bottom threshold)
    act(() => {
      log.dispatchEvent(new Event('scroll'));
    });

    scrollIntoView.mockClear();
    update(root, makeEntries(4));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'end' });
  });
});
