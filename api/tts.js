import OpenAI from 'openai'
import { normalizeEmail } from '../lib/news-quota.js'
import { verifyScript, audioQuota } from '../lib/audio-quota.js'
const VOICE_MAP={'american-female':'coral','american-male':'echo','british-female':'shimmer','british-male':'onyx'}
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'})
  const {email:raw,ticket,accent,gender,speed,action}=req.body??{}
  const email=normalizeEmail(raw)
  if(!email) return res.status(400).json({error:'Please enter a valid email address.'})
  let script,counter
  try{
    script=verifyScript(ticket,email)
    if(!script) return res.status(403).json({error:'A valid news script is required.'})
    counter=audioQuota(email,script)
    if(action==='usage') return res.status(200).json({usage:await counter.status()})
  }catch{return res.status(503).json({error:'Audio usage service unavailable or script expired.'})}
  const voice=VOICE_MAP[accent+'-'+gender]
  const speechSpeed=Number(speed)
  if(!voice||![0.8,1,1.2].includes(speechSpeed)) return res.status(400).json({error:'Invalid voice settings.'})
  if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:'Audio service not configured.'})
  let usage
  try{usage=await counter.reserve()}catch{return res.status(503).json({error:'Audio usage service unavailable.'})}
  if(usage.code!==1) return res.status(429).json({usage,error:usage.code===0?'You have reached your daily limit of 20 audio generations. Please try again tomorrow!':'You have reached the limit of 2 audio generations for this news script. You can still listen to your saved audio.'})
  let succeeded=false
  try{
    const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0})
    const audio=await client.audio.speech.create({model:'gpt-4o-mini-tts',voice,input:script.text,speed:speechSpeed,response_format:'mp3'})
    const buffer=Buffer.from(await audio.arrayBuffer())
    if(!buffer.length) throw Error('Empty audio')
    succeeded=true
    res.setHeader('Content-Type','audio/mpeg')
    res.setHeader('Cache-Control','no-store')
    res.setHeader('X-Audio-Usage',JSON.stringify(usage))
    return res.send(buffer)
  }catch{return res.status(502).json({error:'Audio generation failed. Please try again.'})}
  finally{if(!succeeded){try{await counter.refund()}catch{console.error('Audio quota refund failed')}}}
}
