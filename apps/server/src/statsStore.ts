import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
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
  runMigrations(): void;
  resolveProfile(input: ResolveProfileInput): { profileId: string; displayName: string };
  recordMatchOutcomes(input: RecordMatchOutcomesInput): void;
  listPlayerStats(): PlayerStatsRow[];
  getPlayerDetails(profileId: string): PlayerDetails | null;
  mergeProfiles(sourceProfileId: string, targetProfileId: string): void;
  addAlias(profileId: string, aliasRaw: string): void;
  removeAlias(aliasRaw: string): void;
  renameProfile(profileId: string, displayName: string): void;
}

export function normalizeAlias(aliasRaw: string): string {
  return aliasRaw.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

export function createStatsStore(dbPath: string): PlayerStatsStore {
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  const runMigrations = () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS player_profiles (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS player_aliases (
        alias_normalized TEXT PRIMARY KEY,
        alias_raw TEXT NOT NULL,
        profile_id TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS match_outcomes (
        match_id TEXT NOT NULL,
        profile_id TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
        outcome TEXT NOT NULL CHECK(outcome IN ('Talson', 'Usha', 'Neutral')),
        recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(match_id, profile_id)
      );

      CREATE INDEX IF NOT EXISTS idx_aliases_profile_id ON player_aliases(profile_id);
      CREATE INDEX IF NOT EXISTS idx_match_outcomes_profile_id ON match_outcomes(profile_id);
      CREATE INDEX IF NOT EXISTS idx_match_outcomes_match_id ON match_outcomes(match_id);
    `);
  };

  const resolveProfile = ({ profileId, aliasRaw }: ResolveProfileInput) => {
    const aliasNormalized = normalizeAlias(aliasRaw);
    const now = new Date().toISOString();

    if (profileId) {
      const existingProfile = db
        .prepare('SELECT id, display_name AS displayName FROM player_profiles WHERE id = ?')
        .get(profileId) as { id: string; displayName: string } | undefined;
      if (existingProfile) {
        db.prepare(
          `INSERT INTO player_aliases(alias_normalized, alias_raw, profile_id)
           VALUES (?, ?, ?)
           ON CONFLICT(alias_normalized) DO UPDATE SET alias_raw=excluded.alias_raw, profile_id=excluded.profile_id`,
        ).run(aliasNormalized, aliasRaw, existingProfile.id);
        db.prepare('UPDATE player_profiles SET updated_at = ? WHERE id = ?').run(now, existingProfile.id);
        return { profileId: existingProfile.id, displayName: existingProfile.displayName };
      }
    }

    const existingByAlias = db
      .prepare(
        `SELECT p.id, p.display_name AS displayName
         FROM player_aliases a
         JOIN player_profiles p ON p.id = a.profile_id
         WHERE a.alias_normalized = ?`,
      )
      .get(aliasNormalized) as { id: string; displayName: string } | undefined;

    if (existingByAlias) {
      db.prepare('UPDATE player_aliases SET alias_raw = ? WHERE alias_normalized = ?').run(aliasRaw, aliasNormalized);
      db.prepare('UPDATE player_profiles SET updated_at = ? WHERE id = ?').run(now, existingByAlias.id);
      return { profileId: existingByAlias.id, displayName: existingByAlias.displayName };
    }

    const createdProfileId = profileId ?? randomUUID();
    const displayName = aliasRaw.trim() || 'Player';
    const insert = db.transaction(() => {
      db.prepare(
        'INSERT INTO player_profiles(id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)',
      ).run(createdProfileId, displayName, now, now);
      db.prepare('INSERT INTO player_aliases(alias_normalized, alias_raw, profile_id) VALUES (?, ?, ?)').run(
        aliasNormalized,
        aliasRaw,
        createdProfileId,
      );
    });
    insert();
    return { profileId: createdProfileId, displayName };
  };

  const recordMatchOutcomes = ({ matchId, outcomes }: RecordMatchOutcomesInput) => {
    if (outcomes.length === 0) return;
    const insert = db.prepare(
      `INSERT OR IGNORE INTO match_outcomes(match_id, profile_id, outcome, recorded_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    );
    const tx = db.transaction(() => {
      for (const row of outcomes) {
        insert.run(matchId, row.profileId, row.outcome);
      }
    });
    tx();
  };

  const listPlayerStats = () => {
    return db
      .prepare(
        `SELECT
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
        ORDER BY talson DESC, matches DESC, p.display_name ASC`,
      )
      .all() as PlayerStatsRow[];
  };

  const getPlayerDetails = (profileId: string): PlayerDetails | null => {
    const profile = db
      .prepare('SELECT id AS profileId, display_name AS displayName FROM player_profiles WHERE id = ?')
      .get(profileId) as { profileId: string; displayName: string } | undefined;
    if (!profile) return null;

    const aliases = db
      .prepare(
        'SELECT alias_raw AS aliasRaw, alias_normalized AS aliasNormalized FROM player_aliases WHERE profile_id = ? ORDER BY alias_raw ASC',
      )
      .all(profileId) as PlayerDetails['aliases'];

    const recentOutcomes = db
      .prepare(
        `SELECT match_id AS matchId, outcome, recorded_at AS recordedAt
         FROM match_outcomes
         WHERE profile_id = ?
         ORDER BY recorded_at DESC
         LIMIT 30`,
      )
      .all(profileId) as PlayerDetails['recentOutcomes'];

    return {
      ...profile,
      aliases,
      recentOutcomes,
    };
  };

  const mergeProfiles = (sourceProfileId: string, targetProfileId: string) => {
    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE OR IGNORE player_aliases
         SET profile_id = ?
         WHERE profile_id = ?`,
      ).run(targetProfileId, sourceProfileId);
      db.prepare(
        `INSERT OR IGNORE INTO match_outcomes(match_id, profile_id, outcome, recorded_at)
         SELECT match_id, ?, outcome, recorded_at
         FROM match_outcomes
         WHERE profile_id = ?`,
      ).run(targetProfileId, sourceProfileId);
      db.prepare('DELETE FROM match_outcomes WHERE profile_id = ?').run(sourceProfileId);
      db.prepare('DELETE FROM player_profiles WHERE id = ?').run(sourceProfileId);
      db.prepare('UPDATE player_profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(targetProfileId);
    });
    tx();
  };

  const addAlias = (profileId: string, aliasRaw: string) => {
    const normalized = normalizeAlias(aliasRaw);
    db.prepare(
      `INSERT INTO player_aliases(alias_normalized, alias_raw, profile_id)
       VALUES (?, ?, ?)
       ON CONFLICT(alias_normalized) DO UPDATE SET alias_raw=excluded.alias_raw, profile_id=excluded.profile_id`,
    ).run(normalized, aliasRaw, profileId);
  };

  const removeAlias = (aliasRaw: string) => {
    db.prepare('DELETE FROM player_aliases WHERE alias_normalized = ?').run(normalizeAlias(aliasRaw));
  };

  const renameProfile = (profileId: string, displayName: string) => {
    db.prepare('UPDATE player_profiles SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      displayName,
      profileId,
    );
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
