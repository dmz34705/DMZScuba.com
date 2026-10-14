// Presentation of synced readings only. Never modify records or infer unknown units.
(() => {
  'use strict';
  const number=(value)=>typeof value==='number'&&Number.isFinite(value);
  const text=(value)=>typeof value==='object'?JSON.stringify(value):String(value);
  const duration=(value)=>`${Math.floor(Math.round(value)/60)}m ${Math.round(value)%60}s`;
  const isEon=(log={})=>/eon/i.test([log.device?.product,log.device?.model,log.computer?.model].filter(Boolean).join(' '));
  function gasTime(value,log={}) {
    const eon=isEon(log);
    const explicit=log.profile?.units?.rbt;
    const unit=explicit==='min'||explicit==='minutes'?'min':explicit==='s'||explicit==='seconds'?'s':eon?'unverified':'s';
    return {label:eon?'Gas time':'Remaining bottom time',unit,
      value:!number(value)||value<0?'—':unit==='unverified'?'Unverified':unit==='min'?`${value} min`:duration(value),
      description:unit==='unverified'?'EON gas-time units are unverified: the download parser divides its source value by 60, while the callback contract says seconds. The exact stored value is shown; no duration is inferred.':'Recorded computer estimate, not recalculated from tank pressure. RBT is not elapsed dive time.'};
  }
  const definitions={
    t:['Sample timestamp','s','Recorded elapsed timestamp from the computer profile.'],
    depth:['Depth','m','Recorded depth; a missing depth is not replaced by the chart’s repaired value here.'],
    tempC:['Water temperature','°C','Recorded sensor temperature, not the smoothed chart curve.'],
    pressureBar:['Primary tank pressure','bar','Recorded primary pressure channel; individual tank channels appear separately.'],
    pressureTank:['Primary tank slot','index','Original zero-based tank identifier, not a pressure reading.'],
    ppo2:['Oxygen partial pressure (ppO₂)','bar','Recorded oxygen partial pressure; not calculated from depth or gas mix.'],
    setpoint:['Oxygen setpoint','bar','Recorded target oxygen partial pressure; not a measured ppO₂ reading.'],
    ndl:['No-decompression limit (NDL)','s','Recorded NDL duration.'],
    cns:['CNS oxygen exposure','%','The app download bridge already converts the library fraction to percent.'],
    rbt:['Remaining bottom time','s','Recorded RBT duration.'],
    heartbeat:['Heart rate','bpm','Recorded heartbeat sample.'],
    bearing:['Compass bearing','°','Recorded bearing in degrees.'],
    'deco.tts':['Time to surface (TTS)','s','Recorded time-to-surface estimate, distinct from an individual stop duration.'],
    'deco.type':['Decompression mode','enum','Computer-recorded NDL, safety-stop, decompression-stop, or deep-stop mode.'],
    'deco.depth':['Recorded ceiling / stop depth','m','Meaning depends on the computer and mode; this is not a website-generated stop schedule.'],
    'deco.seconds':['Recorded stop / NDL time','s','Legacy NDL records store their limit here; other modes store the recorded stop time.']
  };
  const modes={ndl:'No-decompression mode',safetystop:'Safety stop',decostop:'Decompression stop',deepstop:'Deep stop'};
  function flatten(value,prefix='',out={}) {
    for(const [key,item]of Object.entries(value||{})){
      const path=prefix?`${prefix}.${key}`:key;
      if(item&&typeof item==='object'&&!Array.isArray(item))flatten(item,path,out);else out[path]=item;
    }
    return out;
  }
  function reader(log,{imperial=false}={}) {
    const samples=Array.isArray(log.profile?.samples)?log.profile.samples:[],byTime=new Map(),keys=new Set();
    for(const sample of samples){const row=flatten(sample);Object.keys(row).forEach((key)=>keys.add(key));if(number(sample?.t))byTime.set(sample.t,{...byTime.get(sample.t),...row});}
    const ordered=[...Object.keys(definitions).filter((key)=>keys.has(key)),...[...keys].filter((key)=>!definitions[key])];
    return (time)=>{
      const at=byTime.get(time)||{};
      return ordered.map((key)=>{
        const value=at[key],tank=key.match(/^pressuresByTank\.(.+)$/),definition=definitions[key]||(tank?[`Tank pressure · slot ${tank[1]}`,'bar','Recorded transmitter channel.']:null);
        let [label,unit,description]=definition||[key,'Unspecified','Unmapped synced field. Its meaning and units are not declared; shown exactly as stored.'];
        let display=value==null?'—':text(value),state=value==null?'Not recorded at this timestamp':definition?'Recorded':'Unmapped field';
        if(key==='rbt'){
          const gas=gasTime(value,log);label=gas.label;unit=gas.unit;description=gas.description;display=gas.value;
          if(value!=null&&gas.unit==='unverified')state='Unit unverified';
        }else if(value!=null&&unit==='enum')display=modes[value]||text(value);
        else if(value!=null&&definition&&unit!=='enum'){
          if(!number(value)||(value<0&&key!=='tempC')){display='Invalid recorded value';state='Invalid value';}
          else if(unit==='m'){display=`${(value*(imperial?3.28084:1)).toFixed(1)} ${imperial?'ft':'m'}`;unit=imperial?'ft':'m';}
          else if(unit==='bar'){display=`${(value*(imperial?14.5038:1)).toFixed(key==='ppo2'||key==='setpoint'?2:0)} ${imperial?'psi':'bar'}`;unit=imperial?'psi':'bar';}
          else if(unit==='°C'){display=`${(imperial?value*1.8+32:value).toFixed(1)} °${imperial?'F':'C'}`;unit=imperial?'°F':'°C';}
          else if(unit==='%')display=`${Number(value.toFixed(1))}%`;
          else if(unit==='s')display=key==='t'?`${value} s`:value<0?'Invalid recorded value':duration(value);
        }
        // ppO₂ / setpoint are conventionally shown in bar even with imperial depth/pressure.
        if((key==='ppo2'||key==='setpoint')&&number(value)){display=`${value.toFixed(2)} bar`;unit='bar';}
        if(isEon(log)&&at['deco.type']==='decostop'){
          if(key==='deco.depth'){label='Decompression ceiling';description='The EON parser reports the ceiling here, not a scheduled stop depth.';}
          if(key==='deco.seconds'&&value===0){display='Not supplied';state='Parser placeholder';description='The EON parser emits zero for stop duration. Its separate time-to-surface field was not retained by older app downloads; zero is not a recorded zero-duration stop.';}
        }
        return {key,label,unit,description,display,raw:value==null?'—':text(value),state};
      });
    };
  }
  window.DMZRecordedReadings={reader,gasTime,isEon};
})();
