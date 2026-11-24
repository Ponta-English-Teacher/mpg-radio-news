import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEmail, dayWindow, quota, LIMIT } from '../lib/news-quota.js'

const env = { KV_REST_API_URL:'https://mock.invalid', KV_REST_API_TOKEN:'fake-test-token' }
function mockRedis() {
  const values = new Map()
  return { values, request: async (_url, opts) => {
    const [op, ...args] = JSON.parse(opts.body)
    let result
    if (op === 'GET') result = values.get(args[0]) ?? null
    else {
      const [script, , key, max] = args
      const n = values.get(key) || 0
      if (script.includes('PEXPIREAT')) {
        result = n >= Number(max) ? -1 : n+1
        if (result !== -1) values.set(key,result)
      } else {
        result = Math.max(0,n-1)
        if(n>0) values.set(key,result)
      }
    }
    return {ok:true,json:async()=>({result})}
  }}
}
test('email normalization and validation', () => {
  assert.equal(normalizeEmail('  Test@Example.COM '),'test@example.com')
  for(const bad of ['',null,{},'abc','a@b','a b@example.com']) assert.equal(normalizeEmail(bad),null)
})
test('JST boundary', () => {
  assert.equal(dayWindow(Date.parse('2026-11-24T14:59:59Z')).day,'2026-11-24')
  assert.equal(dayWindow(Date.parse('2026-11-24T15:00:00Z')).day,'2026-11-25')
  assert.equal(dayWindow(Date.parse('2026-11-24T14:59:59Z')).reset,Date.parse('2026-11-24T15:00:00Z'))
})
test('ten reservations, reject eleventh, separate emails, refund, next day', async () => {
  const {request,values}=mockRedis()
  const now=Date.parse('2026-11-24T12:00:00Z')
  const q=quota('test@example.com',now,env,request)
  const results=await Promise.all(Array.from({length:15},()=>q.reserve()))
  assert.equal(results.filter(x=>x.allowed).length,LIMIT)
  assert.equal((await q.status()).remaining,0)
  assert.equal((await q.refund()).remaining,1)
  assert.equal((await q.reserve()).allowed,true)
  assert.equal((await q.reserve()).allowed,false)
  assert.equal((await quota('other@example.com',now,env,request).status()).remaining,10)
  assert.equal((await quota('test@example.com',now+86400000,env,request).status()).remaining,10)
  assert.ok([...values.keys()].every(k=>!k.includes('@')))
})
test('missing or unavailable storage rejects', async () => {
  assert.throws(()=>quota('a@b.com',Date.now(),{}))
  await assert.rejects(quota('a@b.com',Date.now(),env,async()=>({ok:false})).reserve())
})
