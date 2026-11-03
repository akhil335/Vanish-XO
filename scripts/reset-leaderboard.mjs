import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { Redis } from '@upstash/redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables from .env.local if not already in process.env
const envLocalPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  console.error('❌ Error: Redis credentials not found in environment or .env.local');
  console.error('Please ensure UPSTASH_REDIS_REST_URL / KV_REST_API_URL and UPSTASH_REDIS_REST_TOKEN / KV_REST_API_TOKEN are set.');
  process.exit(1);
}

const redis = new Redis({ url, token });
const LEADERBOARD_KEY = 'vanish_xo:leaderboard';
const PROFILE_KEY_PREFIX = 'vanish_xo:player:';

async function confirmReset() {
  const args = process.argv.slice(2);
  if (
    args.includes('--confirm') ||
    args.includes('--confirm=yes') ||
    args.includes('--confirm=RESET') ||
    args.includes('-y')
  ) {
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('\n⚠️  WARNING: This will permanently delete ALL global leaderboard data');
    console.log('   (all player profiles, ratings, wins, losses, and game counts).');
    rl.question('   Type "RESET" to confirm deletion: ', (answer) => {
      rl.close();
      resolve(answer.trim() === 'RESET');
    });
  });
}

async function main() {
  const isConfirmed = await confirmReset();
  if (!isConfirmed) {
    console.log('\n❌ Reset cancelled. No data was deleted.\n');
    process.exit(0);
  }

  console.log('\n🔄 Connecting to Upstash Redis to purge all leaderboard data...');

  // 1. Delete the leaderboard sorted set
  const deletedLeaderboard = await redis.del(LEADERBOARD_KEY);
  console.log(`🗑️  Deleted leaderboard sorted set "${LEADERBOARD_KEY}": ${deletedLeaderboard} key removed`);

  // 2. Scan and delete all player profile keys
  let cursor = '0';
  let totalProfilesDeleted = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: `${PROFILE_KEY_PREFIX}*`, count: 100 });
    cursor = nextCursor;
    if (keys && keys.length > 0) {
      await redis.del(...keys);
      totalProfilesDeleted += keys.length;
      console.log(`🗑️  Deleted ${keys.length} player profile keys (total so far: ${totalProfilesDeleted})...`);
    }
  } while (cursor !== '0');

  console.log(`\n✅ Leaderboard reset complete!`);
  console.log(`   - Sorted set cleared`);
  console.log(`   - ${totalProfilesDeleted} player profile(s) purged`);
  console.log(`   The global leaderboard is now completely empty.\n`);
}

main().catch((err) => {
  console.error('❌ Failed to reset leaderboard:', err);
  process.exit(1);
});
