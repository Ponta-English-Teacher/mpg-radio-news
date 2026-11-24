import test from 'node:test'
import assert from 'node:assert/strict'
import { issueScript, verifyScript, audioQuota } from '../lib/audio-quota.js'
const env={KV_REST_API_URL:'https://mock.invalid',KV_REST_API_TOKEN:'test-secret'}
const now=Date.parse('2026-11-24T12:00:00Z')
const email='student@example.com'
const make=()=>verifyScript(issueScript(email,'A news script.',env,now),email,env)
function mockRedis(){
 const values=new Map()
 return async (_url,opts)=>{
  const [op,...args]=JSON.parse(opts.body)
  let result
  if(op==='MGET') result=args.map(k=>values.get(k)||0)
  else {
   const [script,,daily,per]=args
   let a=values.get(daily)||0,b=values.get(per)||0
   if(script.includes('PEXPIREAT')){
    const code=a>=20?0:b>=2?-1:1
    if(code===1){values.set(daily,++a);values.set(per,++b)}
    result=[code,a,b]
   } else {values.set(daily,Math.max(0,a-1));values.set(per,Math.max(0,b-1));result=1}
  }
  return {ok:true,json:async()=>({result})}
 }
}
test('signed script rejects modified or different owner tickets',()=>{
 const ticket=issueScript(email,'Original text',env,now)
 assert.equal(verifyScript(ticket,email,env).text,'Original text')
 assert.equal(verifyScript(ticket,'other@example.com',env),null)
 assert.equal(verifyScript(ticket+'x',email,env),null)
})
test('two audio generations per script even across midnight, daily cap of twenty',async()=>{
 const request=mockRedis(), script=make(),q=audioQuota(email,script,now,env,request)
 const results=await Promise.all(Array.from({length:5},()=>q.reserve()))
 assert.equal(results.filter(x=>x.code===1).length,2)
 assert.equal((await q.status()).perScript,2)
 assert.equal((await audioQuota(email,script,now+86400000,env,request).reserve()).code,-1)
 for(let i=0;i<9;i++){const other=audioQuota(email,make(),now,env,request);assert.equal((await other.reserve()).code,1);assert.equal((await other.reserve()).code,1)}
 assert.equal((await audioQuota(email,make(),now,env,request).reserve()).code,0)
 await q.refund()
 assert.equal((await q.status()).daily,19)
 assert.equal((await q.status()).perScript,1)
 assert.equal((await q.reserve()).code,1)
})
test('missing storage and expired tickets fail closed',()=>{
 assert.throws(()=>audioQuota(email,make(),now,{}))
 assert.throws(()=>audioQuota(email,make(),now+40*86400000,env))
})
