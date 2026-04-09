import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { classifyMatchHonorOutcome } from '@hooker/shared';
import { createStatsStore, normalizeAlias } from './statsStore.js';

async function createTestStore() {
  const dir = mkdtempSync(join(tmpdir(), 'hkr-stats-'));
  const url = `file:${join(dir, 'stats.sqlite')}`;
  const store = createStatsStore({ url });
  await store.runMigrations();
  return { store, url };
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
  it('creates and reads match_history rows with pagination/filtering', async () => {
    const { store } = await createTestStore();
    const a = await store.resolveProfile({ aliasRaw: 'Avi' });
    const b = await store.resolveProfile({ aliasRaw: 'Beni' });
    const c = await store.resolveProfile({ aliasRaw: 'Chaim' });
    const d = await store.resolveProfile({ aliasRaw: 'Dov' });

    await store.recordMatchHistory({
      matchId: 'mh-1',
      recordedAt: '2026-01-03T00:00:00.000Z',
      playerAProfileId: a.profileId,
      playerBProfileId: b.profileId,
      playerCProfileId: c.profileId,
      playerDProfileId: d.profileId,
      r1NorthSouth: 16,
      r1EastWest: 12,
      r2NorthSouth: 9,
      r2EastWest: 16,
      r3NorthSouth: 16,
      r3EastWest: 8,
      honorA: 'Talson',
      honorB: 'Neutral',
      honorC: 'Usha',
      honorD: 'Neutral',
    });
    await store.recordMatchHistory({
      matchId: 'mh-2',
      recordedAt: '2026-01-04T00:00:00.000Z',
      playerAProfileId: a.profileId,
      playerBProfileId: b.profileId,
      playerCProfileId: c.profileId,
      playerDProfileId: d.profileId,
      r1NorthSouth: 16,
      r1EastWest: 0,
      r2NorthSouth: 16,
      r2EastWest: 0,
      r3NorthSouth: 16,
      r3EastWest: 0,
      honorA: 'Talson',
      honorB: 'Talson',
      honorC: 'Usha',
      honorD: 'Usha',
    });

    const firstPage = await store.listMatchHistory({ limit: 1 });
    expect(firstPage.rows).toHaveLength(1);
    expect(firstPage.rows[0]?.matchId).toBe('mh-2');
    expect(firstPage.rows[0]?.rounds[0]).toEqual({ round: 1, northSouth: 16, eastWest: 0 });
    expect(firstPage.nextCursor).toBeTruthy();

    const secondPage = await store.listMatchHistory({ limit: 5, before: firstPage.nextCursor ?? undefined, profileId: c.profileId });
    expect(secondPage.rows.map((row) => row.matchId)).toContain('mh-1');
    expect(secondPage.rows[0]?.players.A.displayName).toBe('Avi');
  });

  it('records outcomes idempotently per match/profile', async () => {
    const { store } = await createTestStore();
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
    const { store } = await createTestStore();
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

  it('paginates player recent outcomes', async () => {
    const { store } = await createTestStore();
    const p = await store.resolveProfile({ aliasRaw: 'Paged Player' });
    await store.recordMatchOutcomes({
      matchId: 'p-1',
      outcomes: [{ profileId: p.profileId, outcome: 'Talson' }],
    });
    await store.recordMatchOutcomes({
      matchId: 'p-2',
      outcomes: [{ profileId: p.profileId, outcome: 'Usha' }],
    });

    const first = await store.getPlayerDetails(p.profileId, { limit: 1 });
    expect(first?.recentOutcomes).toHaveLength(1);
    expect(first?.recentOutcomesNextCursor).toBeTruthy();

    const second = await store.getPlayerDetails(p.profileId, {
      limit: 5,
      beforeRecordedAt: first?.recentOutcomesNextCursor ?? undefined,
    });
    expect(second?.recentOutcomes.some((entry) => entry.matchId === 'p-1')).toBe(true);
  });

  it('rejects mixed Talson/Usha match history writes', async () => {
    const { store } = await createTestStore();
    await expect(
      store.recordMatchHistory({
        matchId: 'invalid-1',
        playerAProfileId: null,
        playerBProfileId: null,
        playerCProfileId: null,
        playerDProfileId: null,
        r1NorthSouth: 16,
        r1EastWest: 8,
        r2NorthSouth: 8,
        r2EastWest: 16,
        r3NorthSouth: 16,
        r3EastWest: 12,
        honorA: 'Talson',
        honorB: 'Neutral',
        honorC: 'Usha',
        honorD: 'Neutral',
      }),
    ).rejects.toThrow('cannot mix Talson and Usha');
  });

  it('maps invalid mixed honors to Neutral during reads', async () => {
    const { store, url } = await createTestStore();
    const db = createClient({ url });
    await db.execute({
      sql: `INSERT INTO match_history(
        match_id, recorded_at, r1_ns, r1_ew, r2_ns, r2_ew, r3_ns, r3_ew, honor_a, honor_b, honor_c, honor_d
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ['mixed-row', '2026-01-01T00:00:00.000Z', 16, 10, 12, 16, 16, 9, 'Talson', 'Neutral', 'Usha', 'Neutral'],
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rows = await store.listMatchHistory();
    expect(rows.rows[0]?.honors).toEqual({ A: 'Neutral', B: 'Neutral', C: 'Neutral', D: 'Neutral' });
    expect(warnSpy).toHaveBeenCalled();
  });
});
