import { randomUUID } from 'node:crypto';
import { createClient, type Client } from '@libsql/client';
import type { MatchHonorOutcome } from '@hooker/shared';
import { assertAllowedPlayerName, normalizePlayerName } from './playerNamePolicy.js';

export interface ResolveProfileInput {
  profileId?: string;
  aliasRaw: string;
}

export interface MatchOutcomeRecordInput {
  profileId: string;
  outcome: MatchHonorOutcome;
}

export interface RecordMatchOutcomesInput {
  matchId: string;
  outcomes: MatchOutcomeRecordInput[];
}

export interface RecordMatchHistoryInput {
  matchId: string;
  recordedAt?: string;
  playerAProfileId: string | null;
  playerBProfileId: string | null;
  playerCProfileId: string | null;
  playerDProfileId: string | null;
  r1NorthSouth: number;
  r1EastWest: number;
  r2NorthSouth: number;
  r2EastWest: number;
  r3NorthSouth: number;
  r3EastWest: number;
  honorA: MatchHonorOutcome;
  honorB: MatchHonorOutcome;
  honorC: MatchHonorOutcome;
  honorD: MatchHonorOutcome;
}

export interface RecordManualMatchAtomicInput {
  matchId: string;
  recordedAt: string;
  A: string;
  B: string;
  C: string;
  D: string;
  r1NorthSouth: number;
  r1EastWest: number;
  r2NorthSouth: number;
  r2EastWest: number;
  r3NorthSouth: number;
  r3EastWest: number;
  honorA: MatchHonorOutcome;
  honorB: MatchHonorOutcome;
  honorC: MatchHonorOutcome;
  honorD: MatchHonorOutcome;
  failAfterHistoryInsert?: boolean;
}

export interface PlayerStatsRow {
  profileId: string;
  displayName: string;
  talson: number;
  usha: number;
  neutral: number;
  matches: number;
  lastPlayed: string | null;
}

export interface PlayerDetails {
  profileId: string;
  displayName: string;
  aliases: Array<{ aliasRaw: string; aliasNormalized: string }>;
  recentOutcomes: Array<{ matchId: string; outcome: MatchHonorOutcome; recordedAt: string }>;
  recentOutcomesNextCursor: string | null;
}

export interface MatchHistoryRow {
  matchId: string;
  recordedAt: string;
  players: {
    A: { profileId: string | null; displayName: string };
    B: { profileId: string | null; displayName: string };
    C: { profileId: string | null; displayName: string };
    D: { profileId: string | null; displayName: string };
  };
  rounds: Array<{ round: 1 | 2 | 3; northSouth: number; eastWest: number }>;
  honors: {
    A: MatchHonorOutcome;
    B: MatchHonorOutcome;
    C: MatchHonorOutcome;
    D: MatchHonorOutcome;
  };
}

type SeatHonors = Record<'A' | 'B' | 'C' | 'D', MatchHonorOutcome>;

export interface PlayerStatsStore {
  runMigrations(): Promise<void>;
  resolveProfile(input: ResolveProfileInput): Promise<{ profileId: string; displayName: string }>;
  recordMatchOutcomes(input: RecordMatchOutcomesInput): Promise<void>;
  recordMatchHistory(input: RecordMatchHistoryInput): Promise<void>;
  recordManualMatchAtomic(input: RecordManualMatchAtomicInput): Promise<string>;
  listPlayerStats(): Promise<PlayerStatsRow[]>;
  listMatchHistory(input?: { limit?: number; before?: string; profileId?: string }): Promise<{ rows: MatchHistoryRow[]; nextCursor: string | null }>;
  getPlayerDetails(profileId: string, input?: { limit?: number; beforeRecordedAt?: string }): Promise<PlayerDetails | null>;
  mergeProfiles(sourceProfileId: string, targetProfileId: string): Promise<void>;
  addAlias(profileId: string, aliasRaw: string): Promise<void>;
  removeAlias(aliasRaw: string): Promise<void>;
  renameProfile(profileId: string, displayName: string): Promise<void>;
  listInvalidMixedHonorMatches(): Promise<Array<{ matchId: string; recordedAt: string }>>;
  normalizeInvalidMixedHonorMatches(): Promise<number>;
}

export function normalizeAlias(aliasRaw: string): string {
  return normalizePlayerName(aliasRaw);
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  return Number(value ?? 0);
}

function toSafeHonorOutcome(value: unknown): MatchHonorOutcome {
  const text = String(value);
  if (text === 'Talson' || text === 'Usha' || text === 'Neutral') {
    return text;
  }
  return 'Neutral';
}

export function hasMixedOpposingHonors(honors: SeatHonors): boolean {
  const values = Object.values(honors);
  return values.includes('Talson') && values.includes('Usha');
}

export function sanitizeSeatHonors(
  honors: SeatHonors,
  options?: { matchId?: string; logInvalid?: boolean },
): SeatHonors {
  if (!hasMixedOpposingHonors(honors)) {
    return honors;
  }
  if (options?.logInvalid) {
    console.warn(
      `Invalid mixed honor state in match ${options.matchId ?? '(unknown)'}; mapping honors to Neutral for UI safety.`,
    );
  }
  return { A: 'Neutral', B: 'Neutral', C: 'Neutral', D: 'Neutral' };
}

export function createStatsStore(config: { url: string; authToken?: string }): PlayerStatsStore {
  const db: Client = createClient({ url: config.url, authToken: config.authToken });

  const runMigrations = async () => {
    await db.batch(
      [
        `CREATE TABLE IF NOT EXISTS player_profiles (
          id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS player_aliases (
          alias_normalized TEXT PRIMARY KEY,
          alias_raw TEXT NOT NULL,
          profile_id TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS match_outcomes (
          match_id TEXT NOT NULL,
          profile_id TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
          outcome TEXT NOT NULL CHECK(outcome IN ('Talson', 'Usha', 'Neutral')),
          recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(match_id, profile_id)
        )`,
        `CREATE TABLE IF NOT EXISTS match_history (
          match_id TEXT PRIMARY KEY,
          recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          player_a_profile_id TEXT REFERENCES player_profiles(id) ON DELETE SET NULL,
          player_b_profile_id TEXT REFERENCES player_profiles(id) ON DELETE SET NULL,
          player_c_profile_id TEXT REFERENCES player_profiles(id) ON DELETE SET NULL,
          player_d_profile_id TEXT REFERENCES player_profiles(id) ON DELETE SET NULL,
          r1_ns INTEGER NOT NULL,
          r1_ew INTEGER NOT NULL,
          r2_ns INTEGER NOT NULL,
          r2_ew INTEGER NOT NULL,
          r3_ns INTEGER NOT NULL,
          r3_ew INTEGER NOT NULL,
          honor_a TEXT NOT NULL CHECK(honor_a IN ('Talson', 'Usha', 'Neutral')),
          honor_b TEXT NOT NULL CHECK(honor_b IN ('Talson', 'Usha', 'Neutral')),
          honor_c TEXT NOT NULL CHECK(honor_c IN ('Talson', 'Usha', 'Neutral')),
          honor_d TEXT NOT NULL CHECK(honor_d IN ('Talson', 'Usha', 'Neutral'))
        )`,
        'CREATE INDEX IF NOT EXISTS idx_aliases_profile_id ON player_aliases(profile_id)',
        'CREATE INDEX IF NOT EXISTS idx_match_outcomes_profile_id ON match_outcomes(profile_id)',
        'CREATE INDEX IF NOT EXISTS idx_match_outcomes_match_id ON match_outcomes(match_id)',
        'CREATE INDEX IF NOT EXISTS idx_match_history_recorded_at ON match_history(recorded_at DESC)',
        'CREATE INDEX IF NOT EXISTS idx_match_history_player_a ON match_history(player_a_profile_id)',
        'CREATE INDEX IF NOT EXISTS idx_match_history_player_b ON match_history(player_b_profile_id)',
        'CREATE INDEX IF NOT EXISTS idx_match_history_player_c ON match_history(player_c_profile_id)',
        'CREATE INDEX IF NOT EXISTS idx_match_history_player_d ON match_history(player_d_profile_id)',
      ],
      'write',
    );
  };

  const resolveProfile = async ({ profileId, aliasRaw }: ResolveProfileInput) => {
    assertAllowedPlayerName(aliasRaw);
    const aliasNormalized = normalizeAlias(aliasRaw);
    const now = new Date().toISOString();

    if (profileId) {
      const existingProfile = await db.execute({
        sql: 'SELECT id, display_name AS displayName FROM player_profiles WHERE id = ?',
        args: [profileId],
      });
      if (existingProfile.rows.length > 0) {
        const found = existingProfile.rows[0] as Record<string, string>;
        await db.execute({
          sql: `INSERT INTO player_aliases(alias_normalized, alias_raw, profile_id)
                VALUES (?, ?, ?)
                ON CONFLICT(alias_normalized) DO UPDATE SET alias_raw=excluded.alias_raw, profile_id=excluded.profile_id`,
          args: [aliasNormalized, aliasRaw, found.id],
        });
        await db.execute({
          sql: 'UPDATE player_profiles SET updated_at = ? WHERE id = ?',
          args: [now, found.id],
        });
        return { profileId: found.id, displayName: found.displayName };
      }
    }

    const existingByAlias = await db.execute({
      sql: `SELECT p.id, p.display_name AS displayName
            FROM player_aliases a
            JOIN player_profiles p ON p.id = a.profile_id
            WHERE a.alias_normalized = ?`,
      args: [aliasNormalized],
    });

    if (existingByAlias.rows.length > 0) {
      const found = existingByAlias.rows[0] as Record<string, string>;
      await db.execute({
        sql: 'UPDATE player_aliases SET alias_raw = ? WHERE alias_normalized = ?',
        args: [aliasRaw, aliasNormalized],
      });
      await db.execute({
        sql: 'UPDATE player_profiles SET updated_at = ? WHERE id = ?',
        args: [now, found.id],
      });
      return { profileId: found.id, displayName: found.displayName };
    }

    const createdProfileId = profileId ?? randomUUID();
    const displayName = aliasRaw.trim() || 'Player';
    await db.batch(
      [
        {
          sql: 'INSERT INTO player_profiles(id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)',
          args: [createdProfileId, displayName, now, now],
        },
        {
          sql: 'INSERT INTO player_aliases(alias_normalized, alias_raw, profile_id) VALUES (?, ?, ?)',
          args: [aliasNormalized, aliasRaw, createdProfileId],
        },
      ],
      'write',
    );

    return { profileId: createdProfileId, displayName };
  };

  const recordMatchOutcomes = async ({ matchId, outcomes }: RecordMatchOutcomesInput) => {
    if (outcomes.length === 0) return;
    await db.batch(
      outcomes.map((row) => ({
        sql: `INSERT OR IGNORE INTO match_outcomes(match_id, profile_id, outcome, recorded_at)
              VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        args: [matchId, row.profileId, row.outcome],
      })),
      'write',
    );
  };

  const recordMatchHistory = async (input: RecordMatchHistoryInput) => {
    const honors = {
      A: input.honorA,
      B: input.honorB,
      C: input.honorC,
      D: input.honorD,
    } satisfies SeatHonors;
    if (hasMixedOpposingHonors(honors)) {
      throw new Error(`Invalid match history honors for ${input.matchId}: cannot mix Talson and Usha.`);
    }
    await db.execute({
      sql: `INSERT INTO match_history(
        match_id, recorded_at,
        player_a_profile_id, player_b_profile_id, player_c_profile_id, player_d_profile_id,
        r1_ns, r1_ew, r2_ns, r2_ew, r3_ns, r3_ew,
        honor_a, honor_b, honor_c, honor_d
      ) VALUES (?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        input.matchId,
        input.recordedAt ?? null,
        input.playerAProfileId,
        input.playerBProfileId,
        input.playerCProfileId,
        input.playerDProfileId,
        input.r1NorthSouth,
        input.r1EastWest,
        input.r2NorthSouth,
        input.r2EastWest,
        input.r3NorthSouth,
        input.r3EastWest,
        input.honorA,
        input.honorB,
        input.honorC,
        input.honorD,
      ],
    });
  };

  const recordManualMatchAtomic = async (input: RecordManualMatchAtomicInput) => {
    await db.execute('BEGIN');
    try {
      const a = await resolveProfile({ aliasRaw: input.A });
      const b = await resolveProfile({ aliasRaw: input.B });
      const c = await resolveProfile({ aliasRaw: input.C });
      const d = await resolveProfile({ aliasRaw: input.D });

      await recordMatchHistory({
        matchId: input.matchId,
        recordedAt: input.recordedAt,
        playerAProfileId: a.profileId,
        playerBProfileId: b.profileId,
        playerCProfileId: c.profileId,
        playerDProfileId: d.profileId,
        r1NorthSouth: input.r1NorthSouth,
        r1EastWest: input.r1EastWest,
        r2NorthSouth: input.r2NorthSouth,
        r2EastWest: input.r2EastWest,
        r3NorthSouth: input.r3NorthSouth,
        r3EastWest: input.r3EastWest,
        honorA: input.honorA,
        honorB: input.honorB,
        honorC: input.honorC,
        honorD: input.honorD,
      });

      if (input.failAfterHistoryInsert) {
        throw new Error('Forced atomic failure');
      }

      await recordMatchOutcomes({
        matchId: input.matchId,
        outcomes: [
          { profileId: a.profileId, outcome: input.honorA },
          { profileId: b.profileId, outcome: input.honorB },
          { profileId: c.profileId, outcome: input.honorC },
          { profileId: d.profileId, outcome: input.honorD },
        ],
      });

      await db.execute('COMMIT');
      return input.matchId;
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
  };

  const listPlayerStats = async () => {
    const result = await db.execute(`SELECT
      p.id AS profileId,
      p.display_name AS displayName,
      COALESCE(SUM(CASE WHEN m.outcome = 'Talson' THEN 1 ELSE 0 END), 0) AS talson,
      COALESCE(SUM(CASE WHEN m.outcome = 'Usha' THEN 1 ELSE 0 END), 0) AS usha,
      COALESCE(SUM(CASE WHEN m.outcome = 'Neutral' THEN 1 ELSE 0 END), 0) AS neutral,
      COUNT(m.match_id) AS matches,
      MAX(m.recorded_at) AS lastPlayed
    FROM player_profiles p
    LEFT JOIN match_outcomes m ON p.id = m.profile_id
    GROUP BY p.id
    ORDER BY talson DESC, matches DESC, p.display_name ASC`);

    return result.rows.map((row) => {
      const mapped = row as Record<string, unknown>;
      return {
        profileId: String(mapped.profileId),
        displayName: String(mapped.displayName),
        talson: asNumber(mapped.talson),
        usha: asNumber(mapped.usha),
        neutral: asNumber(mapped.neutral),
        matches: asNumber(mapped.matches),
        lastPlayed: mapped.lastPlayed ? String(mapped.lastPlayed) : null,
      };
    });
  };

  const listMatchHistory = async (input?: { limit?: number; before?: string; profileId?: string }) => {
    const safeLimit = Math.min(Math.max(input?.limit ?? 25, 1), 100);
    const args: Array<string | number> = [];
    let where = '';
    if (input?.profileId) {
      where += ` WHERE (? IN (player_a_profile_id, player_b_profile_id, player_c_profile_id, player_d_profile_id))`;
      args.push(input.profileId);
    }
    if (input?.before) {
      where += where ? ' AND ' : ' WHERE ';
      where += ' recorded_at < ?';
      args.push(input.before);
    }
    args.push(safeLimit + 1);
    const result = await db.execute({
      sql: `SELECT
        mh.match_id AS matchId,
        mh.recorded_at AS recordedAt,
        mh.player_a_profile_id AS playerAProfileId,
        mh.player_b_profile_id AS playerBProfileId,
        mh.player_c_profile_id AS playerCProfileId,
        mh.player_d_profile_id AS playerDProfileId,
        mh.r1_ns AS r1Ns,
        mh.r1_ew AS r1Ew,
        mh.r2_ns AS r2Ns,
        mh.r2_ew AS r2Ew,
        mh.r3_ns AS r3Ns,
        mh.r3_ew AS r3Ew,
        mh.honor_a AS honorA,
        mh.honor_b AS honorB,
        mh.honor_c AS honorC,
        mh.honor_d AS honorD,
        pa.display_name AS playerADisplayName,
        pb.display_name AS playerBDisplayName,
        pc.display_name AS playerCDisplayName,
        pd.display_name AS playerDDisplayName
      FROM match_history mh
      LEFT JOIN player_profiles pa ON pa.id = mh.player_a_profile_id
      LEFT JOIN player_profiles pb ON pb.id = mh.player_b_profile_id
      LEFT JOIN player_profiles pc ON pc.id = mh.player_c_profile_id
      LEFT JOIN player_profiles pd ON pd.id = mh.player_d_profile_id
      ${where}
      ORDER BY mh.recorded_at DESC
      LIMIT ?`,
      args,
    });
    const rows = result.rows.map((row) => {
      const mapped = row as Record<string, unknown>;
      const safeHonors = sanitizeSeatHonors(
        {
          A: toSafeHonorOutcome(mapped.honorA),
          B: toSafeHonorOutcome(mapped.honorB),
          C: toSafeHonorOutcome(mapped.honorC),
          D: toSafeHonorOutcome(mapped.honorD),
        },
        { matchId: String(mapped.matchId), logInvalid: true },
      );
      return {
        matchId: String(mapped.matchId),
        recordedAt: String(mapped.recordedAt),
        players: {
          A: {
            profileId: mapped.playerAProfileId ? String(mapped.playerAProfileId) : null,
            displayName: String(mapped.playerADisplayName ?? mapped.playerAProfileId ?? 'A'),
          },
          B: {
            profileId: mapped.playerBProfileId ? String(mapped.playerBProfileId) : null,
            displayName: String(mapped.playerBDisplayName ?? mapped.playerBProfileId ?? 'B'),
          },
          C: {
            profileId: mapped.playerCProfileId ? String(mapped.playerCProfileId) : null,
            displayName: String(mapped.playerCDisplayName ?? mapped.playerCProfileId ?? 'C'),
          },
          D: {
            profileId: mapped.playerDProfileId ? String(mapped.playerDProfileId) : null,
            displayName: String(mapped.playerDDisplayName ?? mapped.playerDProfileId ?? 'D'),
          },
        },
        rounds: [
          { round: 1 as const, northSouth: asNumber(mapped.r1Ns), eastWest: asNumber(mapped.r1Ew) },
          { round: 2 as const, northSouth: asNumber(mapped.r2Ns), eastWest: asNumber(mapped.r2Ew) },
          { round: 3 as const, northSouth: asNumber(mapped.r3Ns), eastWest: asNumber(mapped.r3Ew) },
        ],
        honors: {
          A: safeHonors.A,
          B: safeHonors.B,
          C: safeHonors.C,
          D: safeHonors.D,
        },
      } satisfies MatchHistoryRow;
    });
    const sliced = rows.slice(0, safeLimit);
    return {
      rows: sliced,
      nextCursor: rows.length > safeLimit ? sliced[sliced.length - 1]?.recordedAt ?? null : null,
    };
  };

  const getPlayerDetails = async (profileId: string, input?: { limit?: number; beforeRecordedAt?: string }): Promise<PlayerDetails | null> => {
    const profileResult = await db.execute({
      sql: 'SELECT id AS profileId, display_name AS displayName FROM player_profiles WHERE id = ?',
      args: [profileId],
    });

    if (profileResult.rows.length === 0) {
      return null;
    }

    const profile = profileResult.rows[0] as Record<string, string>;

    const aliasesResult = await db.execute({
      sql: 'SELECT alias_raw AS aliasRaw, alias_normalized AS aliasNormalized FROM player_aliases WHERE profile_id = ? ORDER BY alias_raw ASC',
      args: [profileId],
    });

    const safeLimit = Math.min(Math.max(input?.limit ?? 30, 1), 100);
    const outcomesArgs: Array<string | number> = [profileId];
    const beforeClause = input?.beforeRecordedAt ? ' AND recorded_at < ?' : '';
    if (input?.beforeRecordedAt) outcomesArgs.push(input.beforeRecordedAt);
    outcomesArgs.push(safeLimit + 1);
    const outcomesResult = await db.execute({
      sql: `SELECT match_id AS matchId, outcome, recorded_at AS recordedAt
            FROM match_outcomes
            WHERE profile_id = ?
            ${beforeClause}
            ORDER BY recorded_at DESC
            LIMIT ?`,
      args: outcomesArgs,
    });
    const recentOutcomes = outcomesResult.rows.slice(0, safeLimit).map((row) => ({
      matchId: String((row as Record<string, unknown>).matchId),
      outcome: String((row as Record<string, unknown>).outcome) as MatchHonorOutcome,
      recordedAt: String((row as Record<string, unknown>).recordedAt),
    }));

    return {
      profileId: profile.profileId,
      displayName: profile.displayName,
      aliases: aliasesResult.rows.map((row) => ({
        aliasRaw: String((row as Record<string, unknown>).aliasRaw),
        aliasNormalized: String((row as Record<string, unknown>).aliasNormalized),
      })),
      recentOutcomes,
      recentOutcomesNextCursor:
        outcomesResult.rows.length > safeLimit
          ? String((recentOutcomes[recentOutcomes.length - 1] as { recordedAt: string }).recordedAt)
          : null,
    };
  };

  const mergeProfiles = async (sourceProfileId: string, targetProfileId: string) => {
    await db.execute('BEGIN');
    try {
      await db.execute({
        sql: `UPDATE OR IGNORE player_aliases
              SET profile_id = ?
              WHERE profile_id = ?`,
        args: [targetProfileId, sourceProfileId],
      });
      await db.execute({
        sql: `INSERT OR IGNORE INTO match_outcomes(match_id, profile_id, outcome, recorded_at)
              SELECT match_id, ?, outcome, recorded_at
              FROM match_outcomes
              WHERE profile_id = ?`,
        args: [targetProfileId, sourceProfileId],
      });
      await db.execute({ sql: 'DELETE FROM match_outcomes WHERE profile_id = ?', args: [sourceProfileId] });
      await db.execute({ sql: 'DELETE FROM player_profiles WHERE id = ?', args: [sourceProfileId] });
      await db.execute({ sql: 'UPDATE player_profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', args: [targetProfileId] });
      await db.execute('COMMIT');
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
  };

  const addAlias = async (profileId: string, aliasRaw: string) => {
    const normalized = normalizeAlias(aliasRaw);
    await db.execute({
      sql: `INSERT INTO player_aliases(alias_normalized, alias_raw, profile_id)
            VALUES (?, ?, ?)
            ON CONFLICT(alias_normalized) DO UPDATE SET alias_raw=excluded.alias_raw, profile_id=excluded.profile_id`,
      args: [normalized, aliasRaw, profileId],
    });
  };

  const removeAlias = async (aliasRaw: string) => {
    await db.execute({
      sql: 'DELETE FROM player_aliases WHERE alias_normalized = ?',
      args: [normalizeAlias(aliasRaw)],
    });
  };

  const renameProfile = async (profileId: string, displayName: string) => {
    await db.execute({
      sql: 'UPDATE player_profiles SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [displayName, profileId],
    });
  };

  const listInvalidMixedHonorMatches = async () => {
    const result = await db.execute(`SELECT match_id AS matchId, recorded_at AS recordedAt
      FROM match_history
      WHERE (
        honor_a = 'Talson' OR honor_b = 'Talson' OR honor_c = 'Talson' OR honor_d = 'Talson'
      ) AND (
        honor_a = 'Usha' OR honor_b = 'Usha' OR honor_c = 'Usha' OR honor_d = 'Usha'
      )
      ORDER BY recorded_at DESC`);
    return result.rows.map((row) => ({
      matchId: String((row as Record<string, unknown>).matchId),
      recordedAt: String((row as Record<string, unknown>).recordedAt),
    }));
  };

  const normalizeInvalidMixedHonorMatches = async () => {
    const result = await db.execute(`UPDATE match_history
      SET honor_a = 'Neutral', honor_b = 'Neutral', honor_c = 'Neutral', honor_d = 'Neutral'
      WHERE (
        honor_a = 'Talson' OR honor_b = 'Talson' OR honor_c = 'Talson' OR honor_d = 'Talson'
      ) AND (
        honor_a = 'Usha' OR honor_b = 'Usha' OR honor_c = 'Usha' OR honor_d = 'Usha'
      )`);
    return Number(result.rowsAffected ?? 0);
  };

  return {
    runMigrations,
    resolveProfile,
    recordMatchOutcomes,
    recordMatchHistory,
    recordManualMatchAtomic,
    listPlayerStats,
    listMatchHistory,
    getPlayerDetails,
    mergeProfiles,
    addAlias,
    removeAlias,
    renameProfile,
    listInvalidMixedHonorMatches,
    normalizeInvalidMixedHonorMatches,
  };
}
