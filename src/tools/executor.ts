import { env } from '../config/env';

export async function runTool(tool: any, args: Record<string, unknown>) {
  const cfg = tool.http_config as {
    method: 'GET' | 'POST';
    url: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
  };

  const url = new URL(cfg.url);

  // Safety: only call hosts you explicitly allow in .env, even without auth
  const allowed = env.TOOL_HOST_ALLOWLIST.split(',').map((h) => h.trim());
  if (!allowed.includes(url.hostname)) {
    throw new Error(`Host "${url.hostname}" is not in TOOL_HOST_ALLOWLIST`);
  }

  const init: RequestInit = {
    method: cfg.method,
    headers: { 'Content-Type': 'application/json', ...(cfg.headers ?? {}) },
    signal: AbortSignal.timeout(cfg.timeoutMs ?? 5000),
  };

  if (cfg.method === 'GET') {
    for (const [key, value] of Object.entries(args)) {
      url.searchParams.set(key, String(value));
    }
  } else {
    init.body = JSON.stringify(args);
  }

  const res = await fetch(url, init);
  const body = (await res.text()).slice(0, 10_000); // cap what goes back into the prompt
  return { status: res.status, body };
}