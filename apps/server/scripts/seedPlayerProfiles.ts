import { createStatsStore } from '../src/statsStore.js';

const STATS_DB_PATH = process.env.STATS_DB_PATH ?? './player-stats.sqlite';
const store = createStatsStore(STATS_DB_PATH);
store.runMigrations();

const seeds: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: 'Azri', aliases: ['Azri', 'Azrikam', 'עזריקם'] },
  { canonical: 'Guyger', aliases: ['guyger'] },
  { canonical: 'Yahavlul', aliases: ['Yahavlul'] },
  { canonical: 'Kuba', aliases: ['Kuba', 'Hanan'] },
  { canonical: 'Cheche', aliases: ['cheche'] },
  { canonical: 'On', aliases: ['On'] },
  { canonical: 'Talson', aliases: ['Talson'] },
  { canonical: 'Asi', aliases: ['Asi'] },
  { canonical: 'Baki', aliases: ['Baki'] },
  { canonical: 'Bravi', aliases: ['Bravi', 'Brucha'] },
];

for (const seed of seeds) {
  const profile = store.resolveProfile({ aliasRaw: seed.canonical });
  store.renameProfile(profile.profileId, seed.canonical);
  for (const alias of seed.aliases) {
    store.addAlias(profile.profileId, alias);
  }
}

console.log(`Seeded player profiles into ${STATS_DB_PATH}`);
