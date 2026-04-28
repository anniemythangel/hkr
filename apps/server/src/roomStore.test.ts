import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { RoomStore } from './roomStore.js';

describe('room checkpoints', () => {
  it('saves and loads latest checkpoint', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'room-store-'));
    try {
      const store = new RoomStore(dir, 60_000);
      await store.save({
        roomId: 'demo',
        updatedAt: Date.now(),
        gameState: null,
        seats: {
          A: { state: 'claimed_active', claimantKey: 'k', name: 'A', ready: true, graceExpiresAt: null },
          B: { state: 'open', claimantKey: null, name: null, ready: false, graceExpiresAt: null },
          C: { state: 'open', claimantKey: null, name: null, ready: false, graceExpiresAt: null },
          D: { state: 'open', claimantKey: null, name: null, ready: false, graceExpiresAt: null },
        },
      });
      const loaded = await store.loadAll();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.roomId).toBe('demo');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
