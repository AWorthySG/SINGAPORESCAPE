// A tiny Upstash Redis client over its REST API (no dependencies). Vercel's
// Upstash integration sets KV_REST_API_URL / KV_REST_API_TOKEN (older setups
// use UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const configured = () => !!(URL_ && TOKEN);

/** Run several commands in one round trip; returns their results in order. */
export async function pipeline(cmds) {
  const res = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!res.ok) throw new Error(`store ${res.status}`);
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

export const cmd = async (...args) => (await pipeline([args]))[0];
