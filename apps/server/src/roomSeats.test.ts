import { describe, expect, it, vi } from 'vitest';
import { claimSeat, enterGrace, reclaimSeat, releaseSeat, restoreCheckpointSeat, shouldReleaseSeatOnSweep } from './roomSeats.js';

function blank(): any {
  return { state: 'open', claimantKey: null, name: null, profileId: undefined, socketId: null, ready: false, graceExpiresAt: null, timer: null };
}

describe('room seat lifecycle', () => {
  it('supports claim -> grace -> reclaim', () => {
    const entry = blank();
    claimSeat(entry, { claimantKey: 'k1', name: 'Ari', socketId: 's1', ready: true });
    expect(entry.state).toBe('claimed_active');
    const timer = setTimeout(() => {}, 1000);
    enterGrace(entry, Date.now() + 10_000, timer);
    expect(entry.state).toBe('claimed_grace');
    reclaimSeat(entry, 's2');
    expect(entry.state).toBe('claimed_active');
    expect(entry.socketId).toBe('s2');
    clearTimeout(timer);
  });

  it('releases claim and clears identity', () => {
    const entry: any = { state: 'claimed_active', claimantKey: 'k1', name: 'Ari', profileId: 'p1', socketId: 's1', ready: true, graceExpiresAt: null, timer: null };
    releaseSeat(entry);
    expect(entry.state).toBe('open');
    expect(entry.claimantKey).toBeNull();
    expect(entry.ready).toBe(false);
  });

  it('restores claimed_active checkpoints as grace with expiry when grace is enabled', () => {
    const now = 1_000;
    const entry = blank();
    const timer = setTimeout(() => {}, 1000);
    const createTimer = vi.fn(() => timer);

    restoreCheckpointSeat(entry, {
      state: 'claimed_active', claimantKey: 'k1', name: 'Ari', profileId: 'p1', ready: true, graceExpiresAt: null,
    }, { seat: 'A', reconnectGraceEnabled: true, reconnectGraceMs: 45_000, now, createTimer });

    expect(entry.state).toBe('claimed_grace');
    expect(entry.socketId).toBeNull();
    expect(entry.graceExpiresAt).toBe(now + 45_000);
    expect(createTimer).toHaveBeenCalledWith(45_000);
    clearTimeout(timer);
  });

  it('releases restored claims when grace is disabled', () => {
    const entry = blank();
    restoreCheckpointSeat(entry, {
      state: 'claimed_active', claimantKey: 'k1', name: 'Ari', ready: true, graceExpiresAt: null,
    }, { seat: 'A', reconnectGraceEnabled: false, reconnectGraceMs: 45_000, now: 1_000, createTimer: () => setTimeout(() => {}, 1) });
    expect(entry.state).toBe('open');
    expect(entry.claimantKey).toBeNull();
  });

  it('sweeps active claims that have no socket id', () => {
    const entry: any = { state: 'claimed_active', claimantKey: 'k1', name: 'Ari', profileId: 'p1', socketId: null, ready: true, graceExpiresAt: null, timer: null };
    expect(shouldReleaseSeatOnSweep(entry, Date.now())).toBe(true);
  });
});
