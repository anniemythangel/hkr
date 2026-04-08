import { randomUUID } from 'node:crypto';
import { createClient, type Client } from '@libsql/client';
import type { MatchHonorOutcome } from '@hooker/shared';

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
}

export interface PlayerStatsStore {
  runMigrations(): Promise<void>;
  resolveProfile(input: ResolveProfileInput): Promise<{ profileId: string; displayName: string }>;
  recordMatchOutcomes(input: RecordMatchOutcomesInput): Promise<void>;
  listPlayerStats(): Promise<PlayerStatsRow[]>;
  getPlayerDetails(profileId: string): Promise<PlayerDetails | null>;
  mergeProfiles(sourceProfileId: string, targetProfileId: string): Promise<void>;
  addAlias(profileId: string, aliasRaw: string): Promise<void>;
  removeAlias(aliasRaw: string): Promise<void>;
  renameProfile(profileId: string, displayName: string): Promise<void>;
}

export function normalizeAlias(aliasRaw: string): string {
  return aliasRaw.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  return Number(value ?? 0);
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
        'CREATE INDEX IF NOT EXISTS idx_aliases_profile_id ON player_aliases(profile_id)',
        'CREATE INDEX IF NOT EXISTS idx_match_outcomes_profile_id ON match_outcomes(profile_id)',
        'CREATE INDEX IF NOT EXISTS idx_match_outcomes_match_id ON match_outcomes(match_id)',
      ],
      'write',
    );
  };

  const resolveProfile = async ({ profileId, aliasRaw }: ResolveProfileInput) => {
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

  const getPlayerDetails = async (profileId: string): Promise<PlayerDetails | null> => {
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

    const outcomesResult = await db.execute({
      sql: `SELECT match_id AS matchId, outcome, recorded_at AS recordedAt
            FROM match_outcomes
            WHERE profile_id = ?
            ORDER BY recorded_at DESC
            LIMIT 30`,
      args: [profileId],
    });

    return {
      profileId: profile.profileId,
      displayName: profile.displayName,
      aliases: aliasesResult.rows.map((row) => ({
        aliasRaw: String((row as Record<string, unknown>).aliasRaw),
        aliasNormalized: String((row as Record<string, unknown>).aliasNormalized),
      })),
      recentOutcomes: outcomesResult.rows.map((row) => ({
        matchId: String((row as Record<string, unknown>).matchId),
        outcome: String((row as Record<string, unknown>).outcome) as MatchHonorOutcome,
        recordedAt: String((row as Record<string, unknown>).recordedAt),
      })),
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

  return {
    runMigrations,
    resolveProfile,
    recordMatchOutcomes,
    listPlayerStats,
    getPlayerDetails,
    mergeProfiles,
    addAlias,
    removeAlias,
    renameProfile,
  };
}
