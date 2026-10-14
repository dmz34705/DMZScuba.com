(() => {
  'use strict';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const valid = (value) => typeof value === 'number' && Number.isFinite(value);
  const clock = (seconds) => { const n=Math.max(0,Math.round(seconds));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`; };
  const name = (log,index) => [log.device?.vendor,log.device?.product||log.device?.model].filter(Boolean).join(' ')||log.computer?.model||`Computer ${index+1}`;
  const nonnegative=(n)=>valid(n)&&n>=0;
  const statusTime=(n)=>nonnegative(n)?`${Math.floor(Math.round(n)/60)}m ${Math.round(n)%60}s`:'—';
  function statusReader(rawSamples,log={}) {
    // Status must come from this computer at this exact recorded timestamp.
    // Do not use schema defaults, interpolation, or another computer's value.
    const ndl=(row)=>nonnegative(row?.ndl)?row.ndl:row?.deco?.type==='ndl'&&nonnegative(row.deco.seconds)?row.deco.seconds:null;
    const stops={safetystop:'Safety stop',decostop:'Deco stop',deepstop:'Deep stop'};
    const byTime=new Map();for(const row of rawSamples)if(row&&valid(row.t))byTime.set(row.t,{...byTime.get(row.t),...row});
    const has={ndl:rawSamples.some((row)=>ndl(row)!==null),cns:rawSamples.some((row)=>nonnegative(row?.cns)),rbt:rawSamples.some((row)=>nonnegative(row?.rbt)),stop:rawSamples.some((row)=>stops[row?.deco?.type])};
    return (time)=>{
    const at=byTime.get(time)||{};
    const fields=[];
    if(has.ndl)fields.push({label:'No-deco limit',value:statusTime(ndl(at)),title:'NDL · recorded no-decompression limit (minutes and seconds)'});
    if(has.cns)fields.push({label:'CNS exposure',value:nonnegative(at.cns)?`${Number(at.cns.toFixed(1))}%`:'—',title:'CNS oxygen exposure · recorded percentage; not recalculated'});
    if(has.rbt){const gas=window.DMZRecordedReadings.gasTime(at.rbt,log);fields.push({label:gas.label,value:gas.value,title:gas.description});}
    if(has.stop){
      const stop=at.deco,label=stops[stop?.type];
      const ceiling=stop?.type==='decostop'&&window.DMZRecordedReadings.isEon(log);
      fields.push({label:ceiling?'Deco ceiling':label||'Stop',stop:label?stop:null,ceiling,value:label?'':ndl(at)!==null?'NDL mode':'—',title:ceiling?'EON decompression ceiling. The download parser does not supply stop duration; its zero placeholder is not shown as a real stop time.':'Recorded stop type, depth, and duration; a dash means no stop reading at this sample'});
    }
    return fields;
    };
  }
  const computerStatus=(rawSamples,time,log={})=>statusReader(rawSamples,log)(time);
  function flatten(value,prefix='',result={}) {
    for(const [key,entry] of Object.entries(value||{})) {
      const path=prefix?`${prefix}.${key}`:key;
      if(entry && typeof entry==='object' && !Array.isArray(entry))flatten(entry,path,result);
      else result[path]=Array.isArray(entry)?JSON.stringify(entry):entry;
    }
    return result;
  }
  function nearest(rows,time) {
    if(!rows.length)return null;
    let low=0,high=rows.length-1;
    while(low<high){const middle=(low+high)>>1;if(rows[middle].t<time)low=middle+1;else high=middle;}
    return low>0&&Math.abs(rows[low-1].t-time)<=Math.abs(rows[low].t-time)?rows[low-1]:rows[low];
  }
  function download(filename,content,type) {
    const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');
    link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function mount(host,tableHost,{dive,logs,imperial=false}) {
    const depth=(n)=>valid(n)?`${(n*(imperial?3.28084:1)).toFixed(1)} ${imperial?'ft':'m'}`:'—';
    const temp=(n)=>valid(n)?`${(imperial?n*1.8+32:n).toFixed(1)} °${imperial?'F':'C'}`:'—';
    const pressure=(n)=>valid(n)?`${(n*(imperial?14.5038:1)).toFixed(0)} ${imperial?'psi':'bar'}`:'—';
    const data=logs.map((log,index)=>{const rawSamples=Array.isArray(log.profile?.samples)?log.profile.samples:[];return {log,index,label:name(log,index),rawSamples,statusAt:statusReader(rawSamples,log),recordedAt:window.DMZRecordedReadings.reader(log,{imperial}),samples:window.DMZProfileSamples.cleanProfileSamples(rawSamples.filter((s)=>s&&valid(s.t)))};});
    const fallback=data.find((entry)=>entry.samples.length>1);
    let selected=data.findIndex((entry)=>entry.log.id===dive.primaryLogId&&entry.samples.length>1);
    if(selected<0)selected=fallback?.index||0;
    let index=0,windowRange=null,page=0,fieldsOnly=false,tableFilter='all',disposed=false;
    const overlays={temperature:true,pressure:true,oxygen:true};
    const colors=['#b9a1ff','#ff8fbe','#70bfff','#a9e589','#ffbc78'];
    const dialog=document.createElement('dialog');dialog.className='profile-fullscreen';dialog.setAttribute('aria-label','Expanded dive profile');
    document.body.append(dialog);
    const recordedDialog=document.createElement('dialog');recordedDialog.className='profile-recorded-dialog';recordedDialog.setAttribute('aria-label','All recorded computer readings');document.body.append(recordedDialog);
    let inspectorComputer=selected,inspectorIndex=0;
    function updateInspector(){
      const entry=data[inspectorComputer],rows=entry.rawSamples.filter((row)=>row&&valid(row.t)).slice().sort((a,b)=>a.t-b.t);
      inspectorIndex=Math.max(0,Math.min(inspectorIndex,rows.length-1));const time=rows[inspectorIndex]?.t;
      const slider=recordedDialog.querySelector('[data-recorded-time]');slider.max=Math.max(0,rows.length-1);slider.value=inspectorIndex;slider.disabled=!rows.length;
      recordedDialog.querySelector('[data-recorded-position]').textContent=rows.length?`${clock(time)} · original sample ${inspectorIndex+1} of ${rows.length}`:'No recorded samples';
      recordedDialog.querySelector('tbody').innerHTML=entry.recordedAt(time).map((field)=>`<tr><th scope="row"><strong>${esc(field.label)}</strong><code>${esc(field.key)}</code><small>${esc(field.description)}</small></th><td><strong>${esc(field.display)}</strong><small>${esc(field.state)}</small></td><td><code>${esc(field.raw)}</code><small>${esc(field.unit==='unverified'?'Unit unverified':field.unit)}</small></td></tr>`).join('');
      const events=(entry.log.profile?.events||[]).filter((event)=>event.t===time);
      recordedDialog.querySelector('[data-recorded-events]').innerHTML=events.length?`<h4>Events at this timestamp</h4>${events.map((event)=>`<dl>${Object.entries(flatten(event)).map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`).join('')}`:'<p>No event recorded at this timestamp.</p>';
    }
    function openInspector(){
      inspectorComputer=selected;const rows=primary.rawSamples.filter((row)=>row&&valid(row.t)).slice().sort((a,b)=>a.t-b.t);inspectorIndex=Math.max(0,rows.indexOf(nearest(rows,primary.samples[index]?.t)));
      recordedDialog.innerHTML=`<header><div><p class="diving-kicker">COMPUTER RECORD</p><h3>All recorded readings</h3></div><button type="button" class="btn secondary" data-recorded-close>Close</button></header><p>Every synced sample field from the selected computer. Missing values are not interpolated. Unmapped fields retain their original names; unknown units are not guessed.</p><div class="recorded-controls"><label>Source computer<select data-recorded-computer>${data.map((entry)=>`<option value="${entry.index}" ${entry.index===selected?'selected':''}>${esc(entry.label)}</option>`).join('')}</select></label><label>Original sample<input type="range" data-recorded-time min="0" step="1"></label><output data-recorded-position></output></div><div class="recorded-table-scroll" tabindex="0" aria-label="All recorded sample fields"><table><thead><tr><th>Reading</th><th>Display value</th><th>Stored value / unit</th></tr></thead><tbody></tbody></table><section data-recorded-events></section></div><footer>NDL and stop times use seconds in the synced schema. CNS is already a percentage. EON gas-time units require verification. Full sample CSV and source JSON remain available in Sample Explorer.</footer>`;
      recordedDialog.querySelector('[data-recorded-close]').onclick=()=>recordedDialog.close();
      recordedDialog.querySelector('[data-recorded-computer]').onchange=(event)=>{inspectorComputer=Number(event.target.value);inspectorIndex=0;updateInspector();};
      recordedDialog.querySelector('[data-recorded-time]').oninput=(event)=>{inspectorIndex=Number(event.target.value);updateInspector();};
      updateInspector();recordedDialog.showModal();
    }
    const marker=document.createComment('profile explorer position');
    let board,geometry,series,primary,origin,fullEnd,visibleRows,readers,plotWidth,plotHeight,resizeObserver,lastSize='';
    const samples=data.flatMap((entry)=>entry.rawSamples.map((sample,i)=>({computer:entry.label,computerId:entry.log.id,sampleIndex:i,...flatten(sample)})));
    const allKeys=[...new Set(samples.flatMap((row)=>Object.keys(row)))];
    const priorities=['computer','sampleIndex','t','depth','tempC','pressureBar','ppo2','setpoint','ndl','cns','rbt'];
    const keys=[...priorities.filter((key)=>allKeys.includes(key)),...allKeys.filter((key)=>!priorities.includes(key))];
    const labels={computer:'Computer',computerId:'Computer ID',sampleIndex:'Sample #',t:'Time (s)',depth:'Depth (m)',tempC:'Temp (°C)',pressureBar:'Pressure (bar)',ppo2:'ppO₂ (bar)',setpoint:'Setpoint (bar)',ndl:'NDL (s)',cns:'CNS (%)',rbt:'RBT (stored source units)','deco.depth':'Recorded ceiling / stop depth (m)','deco.seconds':'Stop / legacy NDL time (s)','deco.type':'Decompression mode'};
    tableHost.innerHTML=`<header class="sample-heading"><div><p class="diving-kicker">SAMPLE EXPLORER</p><h4>Every recorded reading</h4><p>${samples.length.toLocaleString()} samples across ${data.length} computer record${data.length===1?'':'s'}. Original values in SI units; no samples are discarded.</p></div><button type="button" class="btn secondary" data-samples-export>Download sample CSV</button></header><div class="sample-controls"><label>Computer<select data-samples-computer><option value="all">All computers</option>${data.map((entry)=>`<option value="${entry.index}">${esc(entry.label)}</option>`).join('')}</select></label><label class="sample-toggle"><input type="checkbox" data-samples-fields> Show only columns with readings</label></div><div class="sample-navigation"><span data-samples-count></span><button type="button" data-samples-page="-1" aria-label="Previous samples">Previous</button><button type="button" data-samples-page="1" aria-label="Next samples">Next</button></div><div class="sample-table-scroll" tabindex="0" aria-label="Complete recorded samples"><table class="sample-table"><thead></thead><tbody></tbody></table></div><section class="profile-events"><h4>Recorded events</h4><div data-profile-events></div></section><details class="diving-raw"><summary>Source record · complete JSON download</summary><button type="button" class="btn secondary" data-source-export>Download full dive record</button><pre data-full-record></pre></details>`;
    tableHost.querySelector('.sample-heading p:last-child').textContent=`${samples.length.toLocaleString()} samples across ${data.length} computer record${data.length===1?'':'s'}. Original stored values; no samples are discarded. RBT source units can require verification for EON logs. Use All readings for field meanings and interpreted units.`;
    tableHost.querySelector('[data-full-record]').textContent=JSON.stringify({dive,computerLogs:logs},null,2);
    tableHost.querySelector('[data-source-export]').onclick=()=>download(`dmz-dive-${dive.id}.json`,JSON.stringify({dive,computerLogs:logs},null,2),'application/json');
    const events=data.flatMap((entry)=>(entry.log.profile?.events||[]).map((event)=>({label:entry.label,event})));
    tableHost.querySelector('[data-profile-events]').innerHTML=events.map(({label,event})=>`<div class="profile-event"><b>${esc(clock(event.t))}</b><span>${esc(label)} · ${esc(event.type)}</span><p>${esc(event.note||'')}</p></div>`).join('')||'<p>No events were recorded by these computers.</p>';
    const tableRows=()=>tableFilter==='all'?samples:samples.filter((row)=>row.computerId===data[Number(tableFilter)].log.id);
    function renderTable() {
      const rows=tableRows(),columns=keys.filter((key)=>!fieldsOnly||rows.some((row)=>row[key]!=null&&row[key]!==''));
      page=Math.max(0,Math.min(page,Math.ceil(rows.length/100)-1));
      tableHost.querySelector('thead').innerHTML=`<tr>${columns.map((key)=>`<th scope="col">${esc(labels[key]||key)}</th>`).join('')}</tr>`;
      tableHost.querySelector('tbody').innerHTML=rows.slice(page*100,(page+1)*100).map((row)=>`<tr tabindex="0" data-sample-time="${row.t}" data-sample-computer="${esc(row.computerId)}" data-sample-index="${row.sampleIndex}" aria-label="Inspect sample ${row.sampleIndex} at ${row.t} seconds">${columns.map((key)=>`<td>${esc(row[key]??'—')}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${Math.max(1,columns.length)}">No synced samples are available.</td></tr>`;
      tableHost.querySelector('[data-samples-count]').textContent=rows.length?`${page*100+1}–${Math.min(rows.length,(page+1)*100)} of ${rows.length.toLocaleString()} samples`:'0 samples';
      tableHost.querySelector('[data-samples-page="-1"]').disabled=page===0;
      tableHost.querySelector('[data-samples-page="1"]').disabled=(page+1)*100>=rows.length;
    }
    tableHost.querySelector('[data-samples-computer]').onchange=(event)=>{tableFilter=event.target.value;page=0;renderTable();};
    tableHost.querySelector('[data-samples-fields]').onchange=(event)=>{fieldsOnly=event.target.checked;renderTable();};
    tableHost.querySelectorAll('[data-samples-page]').forEach((button)=>button.onclick=()=>{page+=Number(button.dataset.samplesPage);renderTable();tableHost.querySelector('.sample-table-scroll').scrollTop=0;});
    tableHost.querySelector('[data-samples-export]').onclick=()=>{
      const quote=(value)=>`"${String(value??'').replace(/"/g,'""')}"`;
      download(`dmz-dive-samples-${dive.id}.csv`,[keys,...tableRows().map((row)=>keys.map((key)=>row[key]))].map((row)=>row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');
    };
    function chooseSample(row) {
      if(!Number.isFinite(Number(row.dataset.sampleTime)))return;
      selected=data.findIndex((entry)=>entry.log.id===row.dataset.sampleComputer);windowRange=null;index=Math.max(0,data[selected].samples.indexOf(nearest(data[selected].samples,Number(row.dataset.sampleTime))));draw();
      host.closest('[role="tabpanel"]')?.parentElement.querySelector('[data-tool-tab="profile"]')?.click();
      host.querySelector('[data-profile-plot]')?.focus();
    }
    tableHost.querySelector('tbody').onclick=(event)=>{const row=event.target.closest('[data-sample-time]');if(row)chooseSample(row);};
    tableHost.querySelector('tbody').onkeydown=(event)=>{if(['Enter',' '].includes(event.key)){const row=event.target.closest('[data-sample-time]');if(row){event.preventDefault();chooseSample(row);}}};
    renderTable();
    const metric=(label,value,color,kind='',title=label)=>`<div class="profile-metric ${kind}" style="--reading-color:${color||'#d7eef4'}" title="${esc(title)}"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`;
    function draw() {
      if(disposed)return;
      primary=data[selected];
      const rows=primary?.samples||[];
      if(rows.length<2){host.innerHTML='<div class="diving-empty"><h4>No recorded profile samples</h4><p>This dive has no synced computer curve. Its complete record is available in Sample Explorer.</p></div>';return;}
      origin=rows[0].t;fullEnd=rows.at(-1).t;
      const [start,end]=windowRange||[origin,fullEnd];
      visibleRows=rows.filter((sample)=>sample.t>=start&&sample.t<=end);
      if(visibleRows.length<2){windowRange=null;visibleRows=rows;}
      const oldPlot=host.querySelector('[data-profile-plot]')?.getBoundingClientRect();
      plotWidth=Math.max(180,(oldPlot?.width||Math.max(320,host.clientWidth-250))-125);plotHeight=Math.max(85,(oldPlot?.height||270)-62);
      geometry=window.DMZProfileGeometry.buildLogProfileGeometry(visibleRows,plotWidth,plotHeight,{maxDepthMeters:primary.log.water?.maxDepthMeters??dive.water?.maxDepthMeters});
      series=[];
      for(const entry of data){
        const sensors=[...new Set(entry.samples.flatMap((s)=>Object.keys(s.pressuresByTank||{})))];
        const device=entry.log.device?.product||entry.log.device?.model||entry.log.computer?.model||entry.label;
        const add=(label,values,shortLabel)=>{const readings=values.filter((s)=>valid(s.pressureBar)&&s.pressureBar>=0);if(readings.length>1)series.push({label,shortLabel,samples:readings,color:colors[series.length%colors.length]});};
        if(sensors.length)sensors.forEach((sensor)=>add(`${entry.label} · Tank ${sensor}`,entry.samples.map((s)=>({t:s.t,pressureBar:s.pressuresByTank?.[sensor]})),`${device} · Tank ${sensor}`));
        else add(entry.label,entry.samples,device);
      }
      const maxBar=series.reduce((n,s)=>s.samples.reduce((m,p)=>Math.max(m,p.pressureBar),n),1);
      const clippedSeries=series.map((s)=>({...s,samples:s.samples.filter((p)=>p.t>=visibleRows[0].t&&p.t<=visibleRows.at(-1).t)}));
      readers={temperature:rows.filter((s)=>valid(s.tempC)),oxygen:rows.filter((s)=>valid(s.ppo2)),setpoint:rows.filter((s)=>valid(s.setpoint))};
      const recordedWater=primary.log.water||{},water={...dive.water};for(const [key,value]of Object.entries(recordedWater))if(value!=null)water[key]=value;
      const temps=readers.temperature.map((p)=>p.tempC),firstPressure=series[0]?.samples[0]?.pressureBar,lastPressure=series[0]?.samples.at(-1)?.pressureBar;
      host.innerHTML=`<div class="profile-workbench"><header class="profile-heading"><div><p class="diving-kicker">DIVE PROFILE</p><h4>Explore your dive</h4></div><div class="profile-actions"><label>Depth source<select data-profile-computer aria-label="Profile computer">${data.map((entry)=>`<option value="${entry.index}" ${entry.index===selected?'selected':''}>${esc(entry.label)}</option>`).join('')}</select></label><button type="button" class="btn secondary" data-profile-expand>${dialog.open?'Close expanded view':'Expand profile'}</button></div></header><div class="profile-summary">${metric('Max depth',depth(water.maxDepthMeters??geometry.maxDepthMeters))}${metric('Dive time',clock(primary.log.durationSeconds??dive.durationSeconds??(fullEnd-origin)))}${metric('Min temperature',temp(water.tempMinC??(temps.length?Math.min(...temps):null)),'#ffc771')}${metric('Tank pressure',firstPressure!=null?`${pressure(firstPressure)} → ${pressure(lastPressure)}`:'Not recorded','#b9a1ff')}</div><div class="profile-toolbar"><span>Overlays</span><button type="button" data-overlay="temperature" aria-pressed="${overlays.temperature}" ${geometry.hasTemp?'':'disabled'}>Temperature</button><button type="button" data-overlay="pressure" aria-pressed="${overlays.pressure}" ${series.length?'':'disabled'}>Tank pressure</button><button type="button" data-overlay="oxygen" aria-pressed="${overlays.oxygen}" ${geometry.hasOxygen?'':'disabled'}>ppO₂ / setpoint</button><div class="profile-zoom"><button type="button" data-profile-zoom="in" aria-label="Zoom in on selected time">+</button><button type="button" data-profile-zoom="out" aria-label="Zoom out">−</button><button type="button" data-profile-reset>Full dive</button></div></div><div class="profile-readings" data-profile-readout aria-live="off"></div><p class="profile-instruction">Click or drag across the graph to inspect recorded readings. Arrow keys move between samples.</p><svg class="profile-plot" data-profile-plot viewBox="-55 -18 ${plotWidth+125} ${plotHeight+62}" tabindex="0" role="slider" aria-label="Dive profile time cursor" aria-valuemin="0" aria-valuemax="${rows.length-1}" aria-valuenow="${index}"><defs><clipPath id="profile-clip-${dive.id}"><rect x="0" y="0" width="${plotWidth}" height="${plotHeight}"/></clipPath></defs><g class="profile-grid">${geometry.depthTicks.map((tick)=>`<path d="M0 ${tick.y}H${plotWidth}"/><text x="-7" y="${tick.y+4}" text-anchor="end">${esc(depth(tick.meters))}</text>`).join('')}${geometry.timeTicks.map((tick)=>`<path d="M${tick.x} 0V${plotHeight}"/><text x="${tick.x}" y="${plotHeight+23}" text-anchor="middle">${clock(tick.seconds+visibleRows[0].t-origin)}</text>`).join('')}<text x="-7" y="4" text-anchor="end">0</text><text x="0" y="${plotHeight+23}">${clock(visibleRows[0].t-origin)}</text><text x="${plotWidth}" y="${plotHeight+23}" text-anchor="end">${clock(visibleRows.at(-1).t-origin)}</text></g><g clip-path="url(#profile-clip-${dive.id})"><path d="${geometry.areaPath}" fill="#64d6cb" opacity=".12"/><path data-curve="depth" d="${geometry.linePath}" stroke="#64d6cb"/>${geometry.hasTemp&&overlays.temperature?`<path data-curve="temperature" d="${geometry.tempPath}" stroke="#ffc771"/>`:''}${overlays.pressure?clippedSeries.map((s)=>`<path data-curve="pressure" d="${geometry.pressureOverlay(s.samples,maxBar)}" stroke="${s.color}"/>`).join(''):''}${overlays.oxygen&&geometry.hasOxygen?`<path data-curve="oxygen" d="${geometry.ppo2Path}" stroke="#ff8f94"/><path data-curve="setpoint" d="${geometry.setpointPath}" stroke="#ff8f94" stroke-dasharray="6 5"/>`:''}<g data-profile-cursor><path d="M0 0V${plotHeight}" stroke="#e8faff" stroke-dasharray="4 4"/><circle r="5" fill="#071725" stroke="#e8faff" stroke-width="2"/></g>${(primary.log.profile?.events||[]).filter((event)=>event.t>=visibleRows[0].t&&event.t<=visibleRows.at(-1).t).map((event)=>`<g transform="translate(${(event.t-visibleRows[0].t)/Math.max(1,visibleRows.at(-1).t-visibleRows[0].t)*plotWidth} ${plotHeight-10})"><title>${esc(`${clock(event.t-origin)} ${event.type} ${event.note||''}`)}</title><path d="M-4 0L0 -8L4 0Z" fill="#ffc771"/></g>`).join('')}</g></svg><div class="profile-legend"><span style="--legend:#64d6cb">Depth</span>${geometry.hasTemp&&overlays.temperature?`<span style="--legend:#ffc771">Temperature · ${temp(geometry.tempRange.min)} to ${temp(geometry.tempRange.max)}</span>`:''}${overlays.pressure?series.map((s)=>`<span style="--legend:${s.color}">${esc(s.label)} · 0–${pressure(maxBar)}</span>`).join(''):''}${geometry.hasOxygen&&overlays.oxygen?'<span style="--legend:#ff8f94">ppO₂ · dashed setpoint</span>':''}</div><label class="profile-timeline">Profile time<input type="range" data-profile-scrub min="0" max="${rows.length-1}" value="${index}" aria-label="Profile time sample"></label><p class="profile-source">${rows.length.toLocaleString()} recorded samples · ${esc(primary.label)} · selected readings are original samples. Temperature curve uses the app’s smoothing.</p></div>`;
      board=host.firstElementChild;
      const controls=document.createElement('header');controls.className='profile-controlbar';
      controls.append(board.querySelector('.profile-toolbar'),board.querySelector('.profile-actions'));
      const chart=document.createElement('section');chart.className='profile-chart-stage';
      const graph=board.querySelector('[data-profile-plot]');graph.setAttribute('preserveAspectRatio','xMidYMid meet');graph.setAttribute('aria-description','Click and drag to inspect readings. Arrow keys move between recorded samples.');
      chart.append(graph,board.querySelector('.profile-legend'),board.querySelector('.profile-timeline'));
      const rail=document.createElement('aside');rail.className='profile-sensor-rail';
      const summary=document.createElement('section');summary.className='profile-static';summary.innerHTML='<h5>Dive summary</h5>';summary.append(board.querySelector('.profile-summary'));
      const live=document.createElement('section');live.className='profile-live';live.innerHTML='<h5><span class="profile-live-dot" aria-hidden="true"></span>Selected moment<span data-profile-sample-number></span></h5>';live.append(board.querySelector('[data-profile-readout]'));
      rail.append(summary,live,board.querySelector('.profile-source'));
      const allReadings=document.createElement('button');allReadings.type='button';allReadings.className='profile-all-readings';allReadings.textContent='All readings ↗';allReadings.setAttribute('aria-label','Explore all recorded computer readings');allReadings.onclick=openInspector;live.querySelector('[data-profile-sample-number]').hidden=true;live.querySelector('h5').append(allReadings);
      rail.querySelector('.profile-source').textContent=`${rows.length.toLocaleString()} profile points · ${primary.label}`;
      rail.querySelector('.profile-source').title='Profile points use the app’s missing-depth repair. Original samples remain in Sample Explorer and CSV. The temperature curve uses the app’s smoothing.';
      board.replaceChildren(controls,chart,rail);
      const plot=host.querySelector('[data-profile-plot]');
      function atPointer(event){const point=plot.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const matrix=plot.getScreenCTM();if(!matrix)return;const x=Math.max(0,Math.min(plotWidth,point.matrixTransform(matrix.inverse()).x)),time=visibleRows[0].t+x/plotWidth*(visibleRows.at(-1).t-visibleRows[0].t);const closest=nearest(rows,time);index=rows.indexOf(closest);update();}
      plot.onpointerdown=(event)=>{if(event.button!==0)return;plot.focus();plot.setPointerCapture(event.pointerId);atPointer(event);};
      plot.onpointermove=(event)=>{if(plot.hasPointerCapture(event.pointerId)||event.pointerType==='mouse')atPointer(event);};
      plot.onpointerup=(event)=>{if(plot.hasPointerCapture(event.pointerId))plot.releasePointerCapture(event.pointerId);};
      plot.onkeydown=(event)=>{if(!['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(event.key))return;event.preventDefault();index=event.key==='Home'?0:event.key==='End'?rows.length-1:index+({ArrowLeft:-1,ArrowRight:1,PageUp:-10,PageDown:10}[event.key]);update();};
      host.querySelector('[data-profile-scrub]').oninput=(event)=>{index=Number(event.target.value);update();};
      host.querySelector('[data-profile-computer]').onchange=(event)=>{selected=Number(event.target.value);index=0;windowRange=null;draw();};
      host.querySelectorAll('[data-overlay]').forEach((button)=>button.onclick=()=>{overlays[button.dataset.overlay]=!overlays[button.dataset.overlay];draw();});
      host.querySelectorAll('[data-profile-zoom]').forEach((button)=>button.onclick=()=>{const span=(windowRange?windowRange[1]-windowRange[0]:fullEnd-origin)*(button.dataset.profileZoom==='in'?.5:2),center=rows[index]?.t??origin;if(span>=fullEnd-origin)windowRange=null;else{const start=Math.max(origin,Math.min(fullEnd-span,center-span/2));windowRange=[start,start+span];}draw();});
      host.querySelector('[data-profile-reset]').onclick=()=>{windowRange=null;draw();};
      host.querySelector('[data-profile-expand]').onclick=()=>{
        if(dialog.open){dialog.close();return;}
        host.before(marker);dialog.append(host);dialog.showModal();draw();
      };
      update();
    }
    function update(){
      const rows=primary?.samples||[];if(!rows.length||!board)return;
      index=Math.max(0,Math.min(rows.length-1,index));const point=rows[index];
      const x=(point.t-visibleRows[0].t)/Math.max(1,visibleRows.at(-1).t-visibleRows[0].t)*plotWidth;
      const nearestPoint=nearest(geometry.points,point.t);
      const cursor=host.querySelector('[data-profile-cursor]');cursor.style.display=x<0||x>plotWidth?'none':'';
      cursor.setAttribute('transform',`translate(${x} 0)`);cursor.querySelector('circle').setAttribute('cy',nearestPoint?.y||0);
      const extras=[],gas=[],readings=[metric('Elapsed time',clock(point.t-origin),null,'is-primary'),metric('Depth',depth(point.depth),'#64d6cb','is-primary')];
      if(overlays.temperature)readings.push(metric('Temperature',temp(nearest(readers.temperature,point.t)?.tempC),'#ffc771','is-temperature'));
      if(overlays.pressure)series.forEach((s)=>gas.push(metric(s.shortLabel,pressure(nearest(s.samples,point.t)?.pressureBar),s.color,'',s.label)));
      if(overlays.oxygen&&geometry.hasOxygen){readings.push(metric('ppO₂',nearest(readers.oxygen,point.t)?.ppo2?.toFixed(2)??'—','#ff8f94'));readings.push(metric('Setpoint',nearest(readers.setpoint,point.t)?.setpoint?.toFixed(2)??'—','#ff8f94'));}
      for(const field of primary.statusAt(point.t))extras.push(metric(field.label,field.stop?field.ceiling?depth(field.stop.depth):`${depth(field.stop.depth)} · ${statusTime(field.stop.seconds)}`:field.value,null,'',field.title));
      host.querySelector('[data-profile-readout]').innerHTML=readings.join('')+(gas.length?'<h6 class="profile-reading-group">Tank pressures</h6>'+gas.join(''):'')+(extras.length?'<h6 class="profile-reading-group">Computer status</h6>'+extras.join(''):'');
      host.querySelector('[data-profile-sample-number]').textContent=`#${index+1}`;
      host.querySelector('[data-profile-scrub]').value=index;
      const plot=host.querySelector('[data-profile-plot]');plot.setAttribute('aria-valuenow',index);plot.setAttribute('aria-valuetext',`${clock(point.t-origin)}, ${depth(point.depth)}`);
    }
    dialog.addEventListener('close',()=>{if(marker.isConnected){marker.replaceWith(host);if(!disposed)draw();}});
    draw();
    resizeObserver=new ResizeObserver(()=>{const size=`${host.clientWidth}/${host.clientHeight}`;if(size!==lastSize&&host.clientWidth&&host.clientHeight){lastSize=size;requestAnimationFrame(()=>{if(!disposed)draw();});}});resizeObserver.observe(host);
    requestAnimationFrame(()=>{if(!disposed&&host.isConnected)draw();});
    return ()=>{disposed=true;resizeObserver?.disconnect();if(recordedDialog.open)recordedDialog.close();recordedDialog.remove();if(dialog.open)dialog.close();if(marker.isConnected)marker.replaceWith(host);dialog.remove();};
  }
  window.DMZProfileExplorer={mount,flatten,nearest,computerStatus};
})();
