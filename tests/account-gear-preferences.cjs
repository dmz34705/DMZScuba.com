const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/account-gear-advice.js'),'utf8');
const cache=new Map(),cloud=new Map();let events=0,offline=false;
const window={dispatchEvent(){events++;},DMZAtlasGuideEngine:{normalizePreferences:v=>structuredClone(v),preferenceError:()=>null}};
vm.runInNewContext(source,{window,localStorage:{getItem:k=>cache.get(k),setItem:(k,v)=>cache.set(k,v)},CustomEvent:function(){},crypto:require('node:crypto').webcrypto});
const api=window.DMZGearAdvice;
const request=(owner)=>async(path,options)=>{
  assert.equal(path,'/api/account/sync/preferences/gear-advice');
  if(offline)throw Object.assign(new Error('Offline'),{status:503});
  const row=cloud.get(owner);
  if(!options){if(!row)throw Object.assign(new Error('Missing'),{status:404});return {record:structuredClone(row)};}
  const body=JSON.parse(options.body);
  if(body.baseRevision!==(row?.revision||0))throw Object.assign(new Error('Conflict'),{status:409});
  const next={revision:body.baseRevision+1,deleted:false,data:body.data};cloud.set(owner,next);return {record:next};
};
(async()=>{
  const prefs={drysuitBelowC:22,thermalTendency:'cold',motionSensitive:true,suits:{s1:{minC:18,maxC:30}},combinations:[{id:'combo',itemIds:['s1','hood'],minC:18,maxC:24}],setups:{rig:['Technical','Overhead']}};
  await api.connect('alice',request('alice'));await api.store(prefs);
  assert.deepEqual(cloud.get('alice').data.value,prefs);
  assert.equal(api.preferences().drysuitBelowC,22);
  cloud.get('alice').data.value.drysuitBelowC=24;cloud.get('alice').revision++;
  await assert.rejects(api.store({...prefs,drysuitBelowC:20}),/another device/);
  assert.equal(api.preferences().drysuitBelowC,22,'conflicts preserve the previous cache and the form draft');
  await api.refresh();assert.equal(api.preferences().drysuitBelowC,24);
  offline=true;await assert.rejects(api.store(prefs),/Offline/);assert.equal(api.preferences().drysuitBelowC,24);offline=false;
  await api.connect('bob',request('bob'));assert.equal(Object.keys(api.preferences()).length,0);
  await api.store({...prefs,drysuitBelowC:18});assert.equal(cloud.get('alice').data.value.drysuitBelowC,24);
  await api.connect('alice',request('alice'));assert.equal(api.preferences().drysuitBelowC,24);
  let release;const delayed=()=>new Promise(resolve=>{release=resolve;});
  const pending=api.connect('charlie',delayed);api.connect('');release({record:cloud.get('alice')});await pending;
  assert.equal(Object.keys(api.preferences()).length,0,'late account response cannot populate the guest cache');
  await api.store({drysuitBelowC:19});assert.equal(api.preferences().drysuitBelowC,19);assert.ok(events>0);
  console.log('PASS: comfort upload/download, full outfits, revision conflicts, offline failure, guest fallback, account isolation, and late-response guards.');
})().catch(error=>{console.error(error);process.exitCode=1;});
