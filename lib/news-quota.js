import { createHmac } from 'node:crypto'
export const LIMIT = 10
export const LIMIT_MESSAGE = 'You have reached your daily limit of 10 news generations. Please try again tomorrow!'
export function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}
export function dayWindow(now = Date.now()) {
  const shifted = new Date(now + 9 * 3600000)
  const day = shifted.toISOString().slice(0, 10)
  const reset = Date.parse(day + 'T00:00:00Z') - 9 * 3600000 + 86400000
  return { day, reset }
}
const reserveScript = "local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>=tonumber(ARGV[1]) then return -1 end; n=redis.call('INCR',KEYS[1]); redis.call('PEXPIREAT',KEYS[1],ARGV[2]); return n"
const refundScript = "local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>0 then return redis.call('DECR',KEYS[1]) end; return 0"
export function quota(email, now = Date.now(), env = process.env, request = fetch) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN
  if (!url || !token) throw new Error('Usage storage is not configured')
  const { day, reset } = dayWindow(now)
  const hash = createHmac('sha256', env.QUOTA_HASH_SECRET || token).update(email).digest('hex')
  const key = 'mpg:news:' + day + ':' + hash
  async function command(args) {
    const response = await request(url, {method:'POST', headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args)})
    if (!response.ok) throw new Error('Usage storage unavailable')
    const data = await response.json()
    if (data.error) throw new Error('Usage storage unavailable')
    return data.result
  }
  const usage = n => ({ used: n, limit: LIMIT, remaining: LIMIT - n, resetAt: new Date(reset).toISOString() })
  return {
    async status() { return usage(Number(await command(['GET',key]) || 0)) },
    async reserve() { const n = Number(await command(['EVAL',reserveScript,'1',key,String(LIMIT),String(reset)])); return {allowed:n!==-1, ...usage(n===-1?LIMIT:n)} },
    async refund() { return usage(Number(await command(['EVAL',refundScript,'1',key]))) }
  }
}
