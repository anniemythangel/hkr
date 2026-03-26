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
    const { root, log } = mount(makeEntries(2));
    const metrics = { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 };
    setScrollMetrics(log, metrics);

    act(() => {
      log.dispatchEvent(new Event('scroll'));
    });

    metrics.scrollTop = 500;
    update(root, makeEntries(3));

    expect(metrics.scrollTop).toBe(1000);
  });

  it('does not force scroll while user is reading older entries', () => {
    const { root, log } = mount(makeEntries(2));
    const metrics = { scrollHeight: 1200, clientHeight: 400, scrollTop: 400 };
    setScrollMetrics(log, metrics);

    act(() => {
      log.dispatchEvent(new Event('scroll'));
    });

    metrics.scrollTop = 300;
    update(root, makeEntries(3));

    expect(metrics.scrollTop).toBe(300);
  });

  it('resumes sticky scrolling once user returns near bottom', () => {
    const { root, log } = mount(makeEntries(2));
    const metrics = { scrollHeight: 1200, clientHeight: 400, scrollTop: 400 };
    setScrollMetrics(log, metrics);

    act(() => {
      log.dispatchEvent(new Event('scroll'));
    });

    update(root, makeEntries(3));
    expect(metrics.scrollTop).toBe(400);

    metrics.scrollTop = 760; // 1200 - 760 - 400 = 40 (within near-bottom threshold)
    act(() => {
      log.dispatchEvent(new Event('scroll'));
    });

    metrics.scrollTop = 700;
    update(root, makeEntries(4));

    expect(metrics.scrollTop).toBe(1200);
  });

  it('only updates the log region scroll state when appending entries', () => {
    const windowScrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const documentElement = document.documentElement;
    Object.defineProperty(documentElement, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 125,
    });

    const { root, log } = mount(makeEntries(2));
    const metrics = { scrollHeight: 900, clientHeight: 300, scrollTop: 600 };
    setScrollMetrics(log, metrics);

    act(() => {
      log.dispatchEvent(new Event('scroll'));
    });

    metrics.scrollTop = 550;
    update(root, makeEntries(3));

    expect(metrics.scrollTop).toBe(900);
    expect(windowScrollTo).not.toHaveBeenCalled();
    expect(documentElement.scrollTop).toBe(125);
  });
});
