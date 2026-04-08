import { createStatsStore } from '../src/statsStore.js';

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
if (!TURSO_DATABASE_URL) {
  throw new Error('TURSO_DATABASE_URL is required');
}
const store = createStatsStore({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
await store.runMigrations();

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'merge': {
    const [source, target] = args;
    if (!source || !target) throw new Error('Usage: merge <sourceProfileId> <targetProfileId>');
    await store.mergeProfiles(source, target);
    console.log(`Merged ${source} -> ${target}`);
    break;
  }
  case 'add-alias': {
    const [profileId, alias] = args;
    if (!profileId || !alias) throw new Error('Usage: add-alias <profileId> <alias>');
    await store.addAlias(profileId, alias);
    console.log(`Added alias ${alias} to ${profileId}`);
    break;
  }
  case 'remove-alias': {
    const [alias] = args;
    if (!alias) throw new Error('Usage: remove-alias <alias>');
    await store.removeAlias(alias);
    console.log(`Removed alias ${alias}`);
    break;
  }
  case 'rename': {
    const [profileId, ...nameParts] = args;
    const displayName = nameParts.join(' ').trim();
    if (!profileId || !displayName) throw new Error('Usage: rename <profileId> <displayName>');
    await store.renameProfile(profileId, displayName);
    console.log(`Renamed ${profileId} to ${displayName}`);
    break;
  }
  default:
    throw new Error('Usage: statsAdmin.ts <merge|add-alias|remove-alias|rename> ...args');
}
