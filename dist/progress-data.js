/* Personal records are derived from completed logs, so edits and sync cannot
   award the same session repeatedly. All comparisons use canonical units. */
(() => {
  'use strict';
  const KG_PER_LB = 0.45359237, KM_PER_MI = 1.609344, BONUS_XP = 50;
  const definitions = {
    weight: {label:'Lifted weight', bestLabel:'Max weight', recordLabel:'New max', direction:1, tolerance:0.01},
    assistance: {label:'Assistance weight', bestLabel:'Least assistance', recordLabel:'Less assistance', direction:-1, tolerance:0.01},
    distance: {label:'Distance', bestLabel:'Longest distance', recordLabel:'New distance best', direction:1, tolerance:0.00001},
    speed: {label:'Average speed & pace', bestLabel:'Fastest average speed', recordLabel:'New fastest average', direction:1, tolerance:0.005},
    reps: {label:'Total reps', bestLabel:'Most reps', recordLabel:'New rep best', direction:1, tolerance:0},
    hold: {label:'Hold time', bestLabel:'Longest hold', recordLabel:'New longest hold', direction:1, tolerance:0.001}
  };
  function number(value, max=Infinity) {
    if(value==null || value==='')return null;
    const result=Number(value);return Number.isFinite(result)&&result>=0&&result<=max?result:null;
  }
  const normalize=name=>String(name||'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[-_]/g,' ').replace(/\s+/g,' ').trim();
  function distanceKm(distance) {
    const value=number(distance?.value,100000);
    if(value===null || !['km','mi','m'].includes(distance?.unit))return null;
    return value*(distance.unit==='mi'?KM_PER_MI:distance.unit==='m'?0.001:1);
  }
  function assistance(record,exercise) {
    return record.weightKind==='assistance'||(/assisted/i.test(exercise?.name||record.name||'')&&/machine/i.test(exercise?.equipment||''));
  }
  function values(record,exercise={}) {
    const metrics={},load=number(record.weight,10000),distance=distanceKm(record.distance);
    if(load!==null)metrics[assistance(record,exercise)?'assistance':'weight']=load*(record.weightUnit==='lb'?KG_PER_LB:1);
    if(distance!==null&&distance>0)metrics.distance=distance;
    const timed=window.GymTracking.mode(record,exercise)==='time',minutes=number(record.minutes,1440);
    if(timed&&distance>0&&minutes>0)metrics.speed=distance/minutes*60;
    const sets=window.GymTracking.count(record.sets),reps=window.GymTracking.count(record.reps);
    if(!timed&&sets!==null&&reps!==null)metrics.reps=sets*reps;
    if(timed&&minutes>0&&/\b(plank|wall sit|dead hang|hold)\b/i.test(exercise.name||record.name||'')&&!exercise.phase)metrics.hold=minutes;
    return metrics;
  }
  function equal(a,b,key) {
    return Math.abs(a-b)<=Math.max(definitions[key].tolerance,Math.max(Math.abs(a),Math.abs(b))*1e-8);
  }
  function better(a,b,key) {return !equal(a,b,key)&&(a-b)*definitions[key].direction>0;}
  const token=(day,id)=>day+'|'+id;
  function build(records,exerciseOf,options={}) {
    const groups=new Map(),achievements=[],byEntry={},through=options.through||'9999-12-31';
    // A known catalog name also joins manual/imported logs for that exact move.
    const names=new Map();
    for(const items of Object.values(records||{}))for(const record of Array.isArray(items)?items:[]){
      const exercise=exerciseOf(record);
      if(exercise&&!record.name){const name=normalize(exercise.name);if(!names.has(name))names.set(name,exercise.id);else if(names.get(name)!==exercise.id)names.set(name,null)}
    }
    for(const day of Object.keys(records||{}).filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&day<=through).sort()){
      const entries=(Array.isArray(records[day])?records[day]:[]).map((record,index)=>({record,index}));
      entries.sort((a,b)=>{
        const time=record=>/^([01]\d|2[0-3]):[0-5]\d$/.test(record.time||'')?record.time:'24:00';
        return time(a.record).localeCompare(time(b.record))||a.index-b.index;
      });
      for(const {record} of entries){
        if(!record?.done)continue;
        const exercise=exerciseOf(record)||{},name=exercise.name||record.name||'';
        if(!name.trim())continue;
        const catalogId=!record.name?exercise.id:names.get(normalize(name));
        const key=catalogId?'exercise:'+catalogId:'activity:'+normalize(name);
        const measured=values(record,exercise);if(!Object.keys(measured).length)continue;
        let group=groups.get(key);
        if(!group){group={key,name,series:{},sessions:0};groups.set(key,group)}
        group.sessions++;
        const result={token:token(day,record.id),day,id:record.id,name:group.name,groupKey:key,records:[],bonusXP:BONUS_XP};
        for(const [metric,value]of Object.entries(measured)){
          const series=group.series[metric]||(group.series[metric]=[]),previousBest=series.reduce((best,point)=>best===null||better(point.value,best.value,metric)?point:best,null);
          const isRecord=!!previousBest&&better(value,previousBest.value,metric);
          const point={day,id:record.id,value,weightUnit:record.weightUnit==='lb'?'lb':'kg',distanceUnit:record.distance?.unit||'km',isRecord,sets:record.sets,reps:record.reps,minutes:record.minutes};
          series.push(point);
          if(isRecord)result.records.push({metric,value,previous:previousBest.value,point});
        }
        if(result.records.length){achievements.push(result);byEntry[result.token]=result}
      }
    }
    return {groups:[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name)),achievements,byEntry,bonusXP:achievements.length*BONUS_XP,through};
  }
  function stats(series,key) {
    const latest=series.at(-1),first=series[0],previous=series.at(-2)||null;
    const best=series.reduce((best,point)=>better(point.value,best.value,key)?point:best,first);
    const lastDifferent=series.slice(0,-1).reverse().find(point=>!equal(point.value,latest.value,key))||null;
    return {latest,first,previous,best,lastDifferent};
  }
  window.GymProgressData={build,values,stats,equal,better,distanceKm,definitions,token,normalize,KG_PER_LB,KM_PER_MI,BONUS_XP};
})();
