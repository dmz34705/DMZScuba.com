(() => {
  'use strict';
  let owner='',pending,request,revision=0,ready=null,ticket=0,writing=false;
  const path='/api/account/sync/preferences/gear-advice';
  const announce=()=>window.dispatchEvent(new CustomEvent('dmz-gear-preferences-changed'));
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key=()=>`dmzGearAdviceV2:${owner||'guest'}`;
  const preferences=()=>{try{return JSON.parse(localStorage.getItem(key())||'{}')||{};}catch{return {};}};
  async function refresh(){
    const current=ticket,send=request;
    if(!owner||!send)return;
    try{const result=await send(path);if(current!==ticket)return;revision=result.record.revision;localStorage.setItem(key(),JSON.stringify(result.record.deleted?{}:result.record.data.value||{}));announce();}
    catch(error){if(current!==ticket)return;if(error.status!==404)throw error;revision=0;}
  }
  function connect(id,send){
    if(owner===(id||'')&&request===send&&ready)return ready;
    owner=id||'';request=send;revision=0;ticket++;ready=null;
    if(owner&&request){ready=refresh();ready.catch(()=>{if(owner===(id||''))ready=null;});}
    return ready;
  }
  async function store(value){
    const api=window.DMZAtlasGuideEngine,normalized=api?.normalizePreferences?api.normalizePreferences(value):value,error=api?.preferenceError?.(normalized);
    if(error)throw new Error(error);
    if(writing)throw new Error('Preferences are still saving. Please wait.');
    const current=ticket;
    if(owner){
      if(!request)throw new Error('Reconnect your account before saving preferences.');
      if(ready)await ready;else await refresh();
      if(current!==ticket)throw new Error('Your account changed. Reopen preferences.');
      writing=true;
      try{const result=await request(path,{method:'PUT',body:JSON.stringify({baseRevision:revision,mutationId:crypto.randomUUID(),deleted:false,data:{id:'gear-advice',value:normalized}})});if(current!==ticket)throw new Error('Your account changed. Reopen preferences.');revision=result.record.revision;}
      catch(error){if(error.status===409)throw new Error('Preferences changed on another device. Your draft is still here. Close and reopen preferences to load the account version.');throw error;}
      finally{writing=false;}
    }
    localStorage.setItem(key(),JSON.stringify(normalized));announce();
  }
  function engine(){if(window.DMZAtlasGuideEngine)return Promise.resolve(window.DMZAtlasGuideEngine);if(!pending)pending=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/js/ocean-atlas-guide-engine.js?v=20261014-gearlogic1';script.onload=()=>resolve(window.DMZAtlasGuideEngine);script.onerror=()=>{pending=null;reject(new Error('Gear advice could not load. Try again.'));};document.head.append(script);});return pending;}
  async function open({items,setups}){
    const draftTicket=ticket;
    if(owner&&request)await refresh();
    if(draftTicket!==ticket)throw new Error('Your account changed. Reopen preferences.');
    const api=await engine(),dialog=document.createElement('dialog');dialog.className='diving-dialog gear-advice-dialog';document.body.append(dialog);let draft=api.normalizePreferences(preferences()),tab='basics';
    const number=(value)=>value===''?null:Number(value);
    const range=(name,min,max)=>`<label>Coldest water · °C<input type="number" step="any" min="-2" max="40" data-min="${esc(name)}" value="${min??''}"></label><label>Warmest water · °C<input type="number" step="any" min="-2" max="40" data-max="${esc(name)}" value="${max??''}"></label>`;
    function collect(){const form=dialog.querySelector('form');if(!form)return;draft.drysuitBelowC=number(form.elements.threshold.value);draft.thermalTendency=form.elements.tendency.value;draft.motionSensitive=form.elements.motion.checked;
      for(const suit of items.filter((item)=>['Exposure suit','Undergarment'].includes(item.category))){const min=[...form.querySelectorAll('[data-min]')].find((el)=>el.dataset.min===suit.id),max=[...form.querySelectorAll('[data-max]')].find((el)=>el.dataset.max===suit.id);if(min&&max)draft.suits[suit.id]={...draft.suits[suit.id],minC:number(min.value),maxC:number(max.value),coverage:form.querySelector(`[data-coverage="${CSS.escape(suit.id)}"]`).value};}
      for(const setup of setups)draft.setups[setup.id]=[...form.querySelectorAll('[data-setup-use]:checked')].filter((el)=>el.dataset.setupUse===setup.id).map((el)=>el.value);
      draft.combinations=draft.combinations.map((combo)=>{const node=[...form.querySelectorAll('[data-combination]')].find((el)=>el.dataset.combination===combo.id);return {...combo,name:node.querySelector('[data-combo-name]').value,minC:number(node.querySelector('[data-min]').value),maxC:number(node.querySelector('[data-max]').value),itemIds:[...node.querySelectorAll('[data-combo-item]:checked')].map((el)=>el.value)};});
    }
    function draw(){dialog.innerHTML=`<h3>Gear matching & comfort preferences</h3><p>Shared by your Gear Locker, trip planner, and Atlas. Signed-in preferences sync with your account and updated app; guest preferences stay in this browser. These are your preferences, not a guarantee of suitable exposure protection.</p><form class="diving-form"><label>How you feel in the water<select name="tendency">${[['cold','I run cold'],['typical','Typical'],['warm','I run warm']].map(([value,label])=>`<option value="${value}" ${draft.thermalTendency===value?'selected':''}>${label}</option>`).join('')}</select></label><label>Prefer drysuit below · °C<input name="threshold" type="number" min="0" max="30" step="any" value="${draft.drysuitBelowC}"></label><label class="diving-check wide"><input name="motion" type="checkbox" ${draft.motionSensitive?'checked':''}>Motion sensitive</label><fieldset class="wide"><legend>Personal exposure ranges</legend>${items.filter((item)=>['Exposure suit','Undergarment'].includes(item.category)).map((item)=>`<article class="gear-comfort-row"><h4>${esc(item.name)}</h4>${range(item.id,draft.suits[item.id]?.minC,draft.suits[item.id]?.maxC)}<label>Coverage<select data-coverage="${esc(item.id)}">${['','Full','Shorty'].map((value)=>`<option ${draft.suits[item.id]?.coverage===value?'selected':''}>${value}</option>`).join('')}</select></label></article>`).join('')||'<p>Add exposure equipment first.</p>'}</fieldset><fieldset class="wide"><legend>Exposure combinations</legend><p>Choose complete outfits, including layers, hoods, gloves, and boots. Matching uses the app’s temperature ranges and service checks.</p>${draft.combinations.map((combo)=>`<article data-combination="${esc(combo.id)}" class="gear-comfort-row"><label>Name<input data-combo-name value="${esc(combo.name)}" required></label>${range(combo.id,combo.minC,combo.maxC)}${items.filter((item)=>['Exposure suit','Undergarment','Hood','Gloves','Boots'].includes(item.category)).map((item)=>`<label class="diving-check"><input data-combo-item type="checkbox" value="${esc(item.id)}" ${combo.itemIds.includes(item.id)?'checked':''}>${esc(item.name)}</label>`).join('')}<button type="button" data-combo-remove="${esc(combo.id)}">Remove combination</button></article>`).join('')}<button type="button" data-combo-add>Add combination</button></fieldset><fieldset class="wide"><legend>Setup uses</legend><p>Technical and overhead eligibility must be explicitly selected, just as in the app. Setup type alone does not establish suitability.</p>${setups.map((setup)=>`<article><h4>${esc(setup.name)}</h4>${['Open water','Technical','Overhead','Freedive'].map((use)=>`<label class="diving-check"><input type="checkbox" data-setup-use="${esc(setup.id)}" value="${use}" ${(draft.setups[setup.id]||[]).includes(use)?'checked':''}>${use}</label>`).join('')}</article>`).join('')}</fieldset><p class="wide diving-status" role="status" data-advice-status></p><div class="wide diving-actions"><button type="button" data-cancel>Cancel</button><button type="submit" class="btn primary">Save preferences</button></div></form>`;
      dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.querySelector('[data-combo-add]').onclick=()=>{collect();draft.combinations.push({id:crypto.randomUUID(),name:'New exposure combination',minC:null,maxC:null,itemIds:[]});draw();};dialog.querySelectorAll('[data-combo-remove]').forEach((button)=>button.onclick=()=>{collect();draft.combinations=draft.combinations.filter((combo)=>combo.id!==button.dataset.comboRemove);draw();});
      dialog.querySelector('form').onsubmit=async(event)=>{event.preventDefault();collect();const normalized=api.normalizePreferences(draft),error=api.preferenceError(normalized);if(error){dialog.querySelector('[data-advice-status]').textContent=error;return;}const button=dialog.querySelector('[type=submit]');button.disabled=true;try{if(draftTicket!==ticket)throw new Error('Your account changed. Reopen preferences.');await store(normalized);dialog.close();}catch(error){dialog.querySelector('[data-advice-status]').textContent=error.message||'Preferences could not save. Your draft is still here.';}finally{button.disabled=false;}};
      window.DMZTools?.editor(dialog.querySelector('form'),tab,(key)=>{tab=key;});
    }
    dialog.addEventListener('close',()=>dialog.remove());draw();dialog.showModal();
  }
  window.DMZGearAdvice={connect,refresh,preferences,store,engine,open};
})();
