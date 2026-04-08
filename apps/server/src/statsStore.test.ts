import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyMatchHonorOutcome } from '@hooker/shared';
import { createStatsStore, normalizeAlias } from './statsStore.js';

function createTestStore() {
  const dir = mkdtempSync(join(tmpdir(), 'hkr-stats-'));
  const store = createStatsStore(join(dir, 'stats.sqlite'));
  store.runMigrations();
  return store;
}

describe('normalizeAlias', () => {
  it('normalizes latin casing and whitespace', () => {
    expect(normalizeAlias('  GuYGeR   Name  ')).toBe('guyger name');
  });

  it('keeps hebrew stable while trimming', () => {
    expect(normalizeAlias('  עזריקם  ')).toBe('עזריקם');
  });
});

describe('classifyMatchHonorOutcome', () => {
  it('classifies talson/usha/neutral', () => {
    expect(classifyMatchHonorOutcome(3, 3)).toBe('Talson');
    expect(classifyMatchHonorOutcome(0, 3)).toBe('Usha');
    expect(classifyMatchHonorOutcome(1, 3)).toBe('Neutral');
  });
});

describe('stats store', () => {
  it('records outcomes idempotently per match/profile', () => {
    const store = createTestStore();
    const p = store.resolveProfile({ aliasRaw: 'Azri' });
    store.recordMatchOutcomes({
      matchId: 'm1',
      outcomes: [{ profileId: p.profileId, outcome: 'Talson' }],
    });
    store.recordMatchOutcomes({
      matchId: 'm1',
      outcomes: [{ profileId: p.profileId, outcome: 'Talson' }],
    });
    const row = store.listPlayerStats().find((item) => item.profileId === p.profileId);
    expect(row?.matches).toBe(1);
    expect(row?.talson).toBe(1);
  });

  it('resolves alias fallback and merges profiles', () => {
    const store = createTestStore();
    const a = store.resolveProfile({ aliasRaw: 'Bravi' });
    const b = store.resolveProfile({ aliasRaw: 'Brucha' });
    store.recordMatchOutcomes({ matchId: 'm1', outcomes: [{ profileId: a.profileId, outcome: 'Neutral' }] });
    store.recordMatchOutcomes({ matchId: 'm2', outcomes: [{ profileId: b.profileId, outcome: 'Usha' }] });
    store.mergeProfiles(b.profileId, a.profileId);

    const details = store.getPlayerDetails(a.profileId);
    expect(details?.aliases.length).toBeGreaterThan(0);
    const row = store.listPlayerStats().find((item) => item.profileId === a.profileId);
    expect(row?.matches).toBe(2);

    const fromAlias = store.resolveProfile({ aliasRaw: 'BRUCHA' });
    expect(fromAlias.profileId).toBe(a.profileId);
  });
});
