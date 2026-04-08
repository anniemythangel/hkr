import { createStatsStore } from '../src/statsStore.js';

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
if (!TURSO_DATABASE_URL) {
  throw new Error('TURSO_DATABASE_URL is required');
}
const store = createStatsStore({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
await store.runMigrations();

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
  const profile = await store.resolveProfile({ aliasRaw: seed.canonical });
  await store.renameProfile(profile.profileId, seed.canonical);
  for (const alias of seed.aliases) {
    await store.addAlias(profile.profileId, alias);
  }
}

console.log(`Seeded player profiles into ${TURSO_DATABASE_URL}`);
