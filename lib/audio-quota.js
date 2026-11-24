import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { dayWindow } from './news-quota.js'
function config(env) {
  const url=env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL
  const token=env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN
  if(!url || !token) throw Error('Usage storage unavailable')
  return {url,token,secret:env.QUOTA_HASH_SECRET || token}
}
const sign=(value,secret)=>createHmac('sha256',secret).update(value).digest('hex')
export function issueScript(email,text,env=process.env,now=Date.now()) {
  const {secret}=config(env)
  const payload=Buffer.from(JSON.stringify({id:randomUUID(),owner:sign(email,secret),text,day:dayWindow(now).day})).toString('base64url')
  return payload+'.'+sign(payload,secret)
}
export function verifyScript(ticket,email,env=process.env) {
  const {secret}=config(env)
  if(typeof ticket!=='string'||ticket.length>12000) return null
  const [payload,sig,extra]=ticket.split('.')
  if(!payload||!sig||extra!==undefined||!/^[a-f0-9]{64}$/.test(sig)) return null
  if(!timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(sign(payload,secret),'hex'))) return null
  try {
    const p=JSON.parse(Buffer.from(payload,'base64url').toString())
    if(p.owner!==sign(email,secret)||typeof p.text!=='string'||!p.text.trim()||p.text.length>4000||typeof p.id!=='string') return null
    return p
  } catch { return null }
}
// Per-script counters are persistent for the lifetime of the signed ticket (30 days).
// Daily counters expire at midnight JST. Both checks are atomic.
const reserveLua="local a=tonumber(redis.call('GET',KEYS[1]) or '0'); local b=tonumber(redis.call('GET',KEYS[2]) or '0'); if a>=20 then return {0,a,b} end; if b>=2 then return {-1,a,b} end; a=redis.call('INCR',KEYS[1]); b=redis.call('INCR',KEYS[2]); redis.call('PEXPIREAT',KEYS[1],ARGV[1]); redis.call('PEXPIREAT',KEYS[2],ARGV[2]); return {1,a,b}"
const refundLua="for i=1,2 do local n=tonumber(redis.call('GET',KEYS[i]) or '0'); if n>0 then redis.call('DECR',KEYS[i]) end end; return 1"
export function audioQuota(email,script,now=Date.now(),env=process.env,request=fetch) {
  const {url,token,secret}=config(env)
  const {day,reset}=dayWindow(now)
  const expiry=Date.parse(script.day+'T00:00:00Z')-9*3600000+31*86400000
  if(!Number.isFinite(expiry)||now>=expiry) throw Error('This news script is too old to generate new audio.')
  const owner=sign(email,secret)
  const keys=['mpg:tts:day:'+day+':'+owner,'mpg:tts:script:'+owner+':'+script.id]
  async function command(args){
    const r=await request(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args)})
    if(!r.ok) throw Error('Usage storage unavailable')
    const data=await r.json()
    if(data.error) throw Error('Usage storage unavailable')
    return data.result
  }
  const usage=(daily,perScript)=>({daily,perScript,dailyLimit:20,scriptLimit:2})
  return {
    async status(){const [a,b]=await command(['MGET',...keys]);return usage(Number(a||0),Number(b||0))},
    async reserve(){const [code,a,b]=await command(['EVAL',reserveLua,'2',...keys,String(reset),String(expiry)]);return {code:Number(code),...usage(Number(a),Number(b))}},
    async refund(){await command(['EVAL',refundLua,'2',...keys])}
  }
}
