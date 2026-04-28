import { describe, expect, it, vi } from 'vitest';
import { claimSeat, enterGrace, reclaimSeat, releaseSeat } from './roomSeats.js';

describe('room seat lifecycle', () => {
  it('supports claim -> grace -> reclaim', () => {
    const entry: any = { state: 'open', claimantKey: null, name: null, profileId: undefined, socketId: null, ready: false, graceExpiresAt: null, timer: null };
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
});
