(() => {
  'use strict';
  const esc=(value)=>String(value??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mount(host,{setup,items,setups=[],context='Quick-dive checklist',onChecks,onSetup,onMove,onOpen,onAdd}) {
    const model=window.DMZGearModel;
    let current={checkedIds:[],itemIds:[],...setup},busy=false,query='',onlyUnpacked=false;
    const openGroups=new Set(model.GEAR_CATEGORIES);
    function draw(){
      const checked=new Set(current.checkedIds||[]),progress=model.setupProgress(current,items);
      const included=model.includedWithSelection(current.itemIds,items,current.accessoryChoices);
      const roots=model.sortGear(items.filter((item)=>current.itemIds.includes(item.id)&&!included.has(item.id)));
      host.innerHTML=`<section class="packing-hero"><div><small>${esc(context)}</small><h4>${esc(current.name||'Trip equipment')}</h4><p>${esc(current.description||'Check each piece as you pack it. Components and linked accessories are tracked separately.')}</p></div><div class="packing-total"><strong>${progress.checked}<span> / ${progress.total}</span></strong><small>pieces packed · ${Math.round(progress.ratio*100)}%</small></div><progress max="${progress.total||1}" value="${progress.checked}"></progress><div class="packing-hero-actions">${onSetup?'<button type="button" data-pack-review>Review setup</button>':''}${onAdd?'<button type="button" data-pack-add>Add equipment</button>':''}<button type="button" data-pack-reset ${progress.checked?'':'disabled'}>Reset checklist</button></div></section><div class="packing-filter"><input type="search" data-pack-search value="${esc(query)}" placeholder="Find equipment or a component" aria-label="Search packing checklist"><label><input type="checkbox" data-pack-unpacked ${onlyUnpacked?'checked':''}> Unpacked only</label></div><div data-packing-groups></div><div data-packing-review></div><p class="diving-status" role="status" data-packing-status></p>`;
      const groupHost=host.querySelector('[data-packing-groups]');
      const row=(key,label,meta,part=false)=>`<label class="packing-row ${part?'packing-part':''}"><input type="checkbox" data-pack-keys="${esc(JSON.stringify([key]))}" ${checked.has(key)?'checked':''}><span><strong>${esc(label)}</strong><small>${esc(meta||'')}</small></span></label>`;
      for(const category of model.GEAR_CATEGORIES){
        const members=roots.filter((item)=>item.category===category).map((item)=>({item,...model.checklistEntriesForItem(item,items,current)})).filter((entry)=>{
          const keys=[entry.itemKey,...entry.parts.map((part)=>part.key)];
          return (!onlyUnpacked||keys.some((key)=>!checked.has(key)))&&[entry.item.name,...entry.parts.map((part)=>part.label)].join(' ').toLowerCase().includes(query.toLowerCase());
        });
        if(!members.length)continue;
        const keys=members.flatMap((entry)=>[entry.itemKey,...entry.parts.map((part)=>part.key)]),done=keys.filter((key)=>checked.has(key)).length;
        const group=document.createElement('details');group.className='packing-category';group.open=openGroups.has(category);
        group.innerHTML=`<summary><span>${esc(category)}</span><b>${done}/${keys.length}</b></summary>`+members.map((entry)=>{
          const all=[entry.itemKey,...entry.parts.map((part)=>part.key)],count=all.filter((key)=>checked.has(key)).length;
          const status=model.serviceStatusForItem(entry.item),where=entry.item.floating?model.floatingLocation(entry.item,setups):null;
          return `<article class="packing-item"><div class="packing-item-top"><label class="packing-row"><input type="checkbox" data-pack-keys="${esc(JSON.stringify(all))}" data-partial="${count>0&&count<all.length}" ${count===all.length?'checked':''}><span><strong>${esc(entry.item.name)}</strong><small>${esc([entry.item.manufacturer,entry.item.model,status?.label].filter(Boolean).join(' · '))}${entry.parts.length?` · ${count}/${all.length} pieces`:''}</small></span></label>${onOpen?`<button type="button" data-pack-open="${esc(entry.item.id)}">Details</button>`:''}</div>${entry.item.floating&&entry.item.currentSetupId!==current.id?`<div class="packing-floating">${esc(where?`Currently on ${where.name}`:'Not assigned to a setup')}${onMove?`<button type="button" data-pack-move="${esc(entry.item.id)}">Move here</button>`:''}</div>`:''}${entry.parts.map((part)=>row(part.key,part.label,part.meta,true)).join('')}</article>`;
        }).join('');
        group.addEventListener('toggle',()=>group.open?openGroups.add(category):openGroups.delete(category));groupHost.append(group);
      }
      if(!groupHost.children.length)groupHost.innerHTML='<div class="diving-empty"><h4>No matching equipment</h4><p>Add gear to this setup or change the checklist filters.</p></div>';
      host.querySelectorAll('[data-partial="true"]').forEach((input)=>{input.indeterminate=true;});
      const review=host.querySelector('[data-packing-review]');
      if(onSetup){
        const questions=model.setupQuestions(current,items);
        review.innerHTML=questions.length?`<section class="packing-review"><h4>Complete your setup · ${questions.length} questions</h4>${questions.map((question)=>question.kind==='choice'?`<article><h5>Layers for ${esc(question.item.name)}</h5><p>Choose the undergarments to pack with this drysuit.</p><select multiple data-layer-choice="${esc(question.item.id)}" aria-label="Undergarments for ${esc(question.item.name)}">${question.options?.map((item)=>`<option value="${esc(item.id)}" ${(current.accessoryChoices?.[question.item.id]||[]).includes(item.id)?'selected':''}>${esc(item.name)}</option>`).join('')||''}</select><button type="button" data-layer-save="${esc(question.item.id)}">Save layer choices</button></article>`:`<article><h5>${esc(question.title)}</h5><p>${esc(question.body)}</p>${question.candidates?.length?`<select data-requirement="${esc(question.key)}" aria-label="Equipment for ${esc(question.label)}">${question.candidates.map((item)=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('')}</select><button type="button" data-requirement-add="${esc(question.key)}">Add to setup</button>`:''}<button type="button" data-requirement-skip="${esc(question.key)}">Leave this out</button></article>`).join('')}</section>`:'';
      }
      host.querySelector('[data-pack-search]').oninput=(event)=>{query=event.target.value;draw();const input=host.querySelector('[data-pack-search]');input.focus();input.setSelectionRange(query.length,query.length);};
      host.querySelector('[data-pack-unpacked]').onchange=(event)=>{onlyUnpacked=event.target.checked;draw();};
    }
    async function perform(action){
      if(busy)return;busy=true;host.querySelectorAll('input,button,select').forEach((el)=>{el.disabled=true;});
      try{const result=await action();if(result)current={...current,...result};draw();host.querySelector('[data-packing-status]').textContent='Checklist saved to your account.';}
      catch(error){draw();const el=host.querySelector('[data-packing-status]');el.textContent=error.message||'Unable to save. Your previous checks are unchanged.';el.classList.add('is-error');}
      finally{busy=false;}
    }
    host.addEventListener('change',(event)=>{if(event.target.matches('[data-pack-keys]'))perform(()=>onChecks(JSON.parse(event.target.dataset.packKeys),event.target.checked));});
    host.addEventListener('click',(event)=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.hasAttribute('data-pack-reset'))perform(()=>onChecks(current.checkedIds||[],false));
      else if(button.dataset.packOpen)onOpen?.(button.dataset.packOpen);
      else if(button.dataset.packMove)perform(()=>onMove?.(button.dataset.packMove));
      else if(button.hasAttribute('data-pack-add'))onAdd?.();
      else if(button.hasAttribute('data-pack-review'))perform(()=>onSetup(model.resetSetupReview(current)));
      else if(button.dataset.requirementSkip)perform(()=>onSetup(model.skipRequirement(current,button.dataset.requirementSkip,items)));
      else if(button.dataset.requirementAdd){const input=[...host.querySelectorAll('[data-requirement]')].find((el)=>el.dataset.requirement===button.dataset.requirementAdd);perform(()=>onSetup(model.addToSetupForRequirement(current,input.value,items)));}
      else if(button.dataset.layerSave){const input=[...host.querySelectorAll('[data-layer-choice]')].find((el)=>el.dataset.layerChoice===button.dataset.layerSave);perform(()=>onSetup(model.setAccessoryChoice(current,button.dataset.layerSave,[...input.selectedOptions].map((option)=>option.value),items)));}
    });
    draw();
  }
  window.DMZPacking={mount};
})();
