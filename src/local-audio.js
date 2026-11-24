// Audio and script history are stored on this device, never in Redis.
function openDB() {
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open('mpg-radio-local-v1',1)
    req.onupgradeneeded=()=>{req.result.createObjectStore('scripts',{keyPath:'ticket'});req.result.createObjectStore('audio',{keyPath:'id'})}
    req.onsuccess=()=>resolve(req.result)
    req.onerror=()=>reject(req.error)
  })
}
async function storeOp(store,mode,fn){
  const db=await openDB()
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(store,mode)
      const req=fn(tx.objectStore(store))
      tx.oncomplete=()=>resolve(req.result)
      tx.onerror=()=>reject(tx.error)
      tx.onabort=()=>reject(tx.error||Error('Local storage transaction aborted'))
    })
  }finally{db.close()}
}
export const saveScript=record=>storeOp('scripts','readwrite',s=>s.put(record))
export const saveAudio=record=>storeOp('audio','readwrite',s=>s.put(record))
export const loadScripts=async email=>(await storeOp('scripts','readonly',s=>s.getAll())).filter(x=>x.email===email).sort((a,b)=>b.created-a.created)
export const loadAudio=async ticket=>(await storeOp('audio','readonly',s=>s.getAll())).filter(x=>x.ticket===ticket).sort((a,b)=>a.created-b.created)
