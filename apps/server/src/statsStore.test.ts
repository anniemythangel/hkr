import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyMatchHonorOutcome } from '@hooker/shared';
import { createStatsStore, normalizeAlias } from './statsStore.js';

async function createTestStore() {
  const dir = mkdtempSync(join(tmpdir(), 'hkr-stats-'));
  const store = createStatsStore({ url: `file:${join(dir, 'stats.sqlite')}` });
  await store.runMigrations();
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
  it('records outcomes idempotently per match/profile', async () => {
    const store = await createTestStore();
    const p = await store.resolveProfile({ aliasRaw: 'Azri' });
    await store.recordMatchOutcomes({
      matchId: 'm1',
      outcomes: [{ profileId: p.profileId, outcome: 'Talson' }],
    });
    await store.recordMatchOutcomes({
      matchId: 'm1',
      outcomes: [{ profileId: p.profileId, outcome: 'Talson' }],
    });
    const row = (await store.listPlayerStats()).find((item) => item.profileId === p.profileId);
    expect(row?.matches).toBe(1);
    expect(row?.talson).toBe(1);
  });

  it('resolves alias fallback and merges profiles', async () => {
    const store = await createTestStore();
    const a = await store.resolveProfile({ aliasRaw: 'Bravi' });
    const b = await store.resolveProfile({ aliasRaw: 'Brucha' });
    await store.recordMatchOutcomes({ matchId: 'm1', outcomes: [{ profileId: a.profileId, outcome: 'Neutral' }] });
    await store.recordMatchOutcomes({ matchId: 'm2', outcomes: [{ profileId: b.profileId, outcome: 'Usha' }] });
    await store.mergeProfiles(b.profileId, a.profileId);

    const details = await store.getPlayerDetails(a.profileId);
    expect(details?.aliases.length).toBeGreaterThan(0);
    const row = (await store.listPlayerStats()).find((item) => item.profileId === a.profileId);
    expect(row?.matches).toBe(2);

    const fromAlias = await store.resolveProfile({ aliasRaw: 'BRUCHA' });
    expect(fromAlias.profileId).toBe(a.profileId);
  });
});
