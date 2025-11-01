const keepAliveEnabled = String(process.env.KEEP_ALIVE ?? '').toLowerCase() === 'true';

if (!keepAliveEnabled) {
  console.log('Keep-alive ping disabled. Set KEEP_ALIVE=true to enable.');
  process.exit(0);
}

const targetUrl = process.env.KEEP_ALIVE_URL ?? process.env.PUBLIC_URL;

if (!targetUrl) {
  console.error('Keep-alive target URL missing. Set KEEP_ALIVE_URL or PUBLIC_URL.');
  process.exit(1);
}

const intervalMs = Number(process.env.KEEP_ALIVE_INTERVAL_MS ?? 60_000);

const fetchWithTimeout = async (url: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};

const ping = async () => {
  const startedAt = Date.now();
  try {
    const response = await fetchWithTimeout(targetUrl, 10_000);
    const durationMs = Date.now() - startedAt;
    if (!response.ok) {
      console.warn(`Keep-alive request responded with status ${response.status} (${durationMs}ms).`);
      return;
    }
    console.log(`Keep-alive ping succeeded in ${durationMs}ms.`);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.error(`Keep-alive ping failed after ${durationMs}ms:`, error);
  }
};

void ping();
setInterval(() => {
  void ping();
}, intervalMs);
