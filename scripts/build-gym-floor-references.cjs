/* Assemble attributed equipment reference cards without modifying source photos. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
const {specs}=require('./add-gym-floor-catalog.cjs');
const machines=require('../dist/machine-data.js');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const photos=JSON.parse(fs.readFileSync(path.join(dist,'machine-photo-references.json'),'utf8'));
const byId=new Map(photos.map(p=>[p.id,p]));
const sources=require('./gym-floor-stations-source.json');
const aliases={'elliptical-trainer':['elliptical'],'pec-fly':['pec-deck'],'rowing-machine':['rowing-ergometer'],'weight-plates':['weights'],'chest-supported-row':['strength-row-machine'],'high-incline':['incline-chest-press'],'super-hand-pulldown':['lat-pulldown'],'multi-pulldown':['lat-pulldown'],'chin-up-station':['assisted-pull-up'],'seated-cable-row':['pulley-row']};
function reference(id){
 const item=byId.get(id)|| (aliases[id]||[]).map(key=>byId.get(key)).find(Boolean);
 if(!item)throw Error('Missing manufacturer picture reference: '+id);
 if(!item.localPath||!/^assets\/machine-references\/[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$/.test(item.localPath))throw Error('Invalid local reference asset: '+id);
 if(!fs.existsSync(path.join(dist,item.localPath)))throw Error('Reference picture not materialized: '+id);
 return item;
}
const stations=sources.map(station=>{
 const found=machines.labelMatches(station.japanese.replace('（判読候補）',''));
 const ids=found.map(m=>m.id);
 if(!ids.length)throw Error('Photo label has no machine lookup: '+station.japanese);
 const refs=[reference(station.referenceId),...(station.additionalReferenceIds||[]).map(reference)];
 return {...station,machineIds:ids,referenceId:refs[0].id,additionalReferenceIds:refs.slice(1).map(r=>r.id)};
});
fs.writeFileSync(path.join(dist,'gym-floor-stations.json'),JSON.stringify({stations},null,2)+'\n');
const assetMap={
 'gym-floor-pendulum-squat':'pendulum-squat','gym-floor-v-squat':'v-squat','gym-floor-standing-hip-thrust':'standing-hip-thrust',
 'gym-floor-standing-machine-hip-abduction':'standing-hip-abduction','gym-floor-stationary-cycling':'stationary-bike',
 'gym-floor-decline-machine-chest-press':'decline-chest-press','gym-floor-standing-machine-chest-press':'standing-chest-press','gym-floor-incline-machine-chest-fly':'incline-machine-fly',
 'gym-floor-smith-machine-bench-press':'smith-machine','gym-floor-incline-smith-machine-bench-press':'smith-machine','gym-floor-smith-machine-shoulder-press':'smith-machine','gym-floor-smith-machine-row':'smith-machine','gym-floor-close-grip-smith-machine-bench-press':'smith-machine',
 'gym-floor-rack-pull':'power-rack','gym-floor-neutral-grip-dumbbell-bench-press':'dumbbells','gym-floor-underhand-barbell-row':'barbell','gym-floor-two-arm-bent-over-dumbbell-row':'dumbbells','gym-floor-dumbbell-grip-hold':'dumbbells','gym-floor-suitcase-hold':'dumbbells','gym-floor-treadmill-walk':'treadmill','gym-floor-treadmill-run':'treadmill','gym-floor-dumbbell-russian-twist':'dumbbells'
};
const out=path.join(dist,'assets/gym-floor');fs.mkdirSync(out,{recursive:true});
const manifest=[];
for(const spec of specs){
 const ref=reference(assetMap[spec.id]);
 const bytes=fs.readFileSync(path.join(dist,ref.localPath));
 const mime=ref.localPath.endsWith('.webp')?'image/webp':ref.localPath.endsWith('.png')?'image/png':'image/jpeg';
 const words=spec.name.split(' '),lines=[''];
 for(const word of words){const n=lines.length-1;if((lines[n]+' '+word).trim().length>37&&lines[n])lines.push(word);else lines[n]+=(lines[n]?' ':'')+word;}
 const titleLines=lines.map((line,i)=>'<text x="30" y="'+(42+i*27)+'" font-family="Arial, sans-serif" font-size="23" font-weight="700" fill="#16223a">'+escape(line)+'</text>').join('');
 const top=lines.length>1?100:76;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="484" viewBox="0 0 600 484"><title>'+escape(spec.name)+' — equipment reference</title><desc>'+escape(ref.manufacturer+' '+ref.model+'. Example equipment, not a pose demonstration or a verified gym model.')+'</desc><rect width="600" height="484" fill="#fff"/>'+titleLines+'<image x="35" y="'+top+'" width="530" height="'+(397-top)+'" preserveAspectRatio="xMidYMid meet" href="data:'+mime+';base64,'+bytes.toString('base64')+'"/><rect x="0" y="409" width="600" height="75" fill="#edf2f8"/><text x="30" y="437" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#243856">EQUIPMENT REFERENCE · EXAMPLE MODEL</text><text x="30" y="461" font-family="Arial, sans-serif" font-size="14" fill="#42556e">Photo: '+escape(ref.manufacturer)+' · Read the exercise cues below</text></svg>\n';
 fs.writeFileSync(path.join(out,spec.id+'.svg'),svg);
 manifest.push({exerciseId:spec.id,referenceId:ref.id,manufacturer:ref.manufacturer,model:ref.model,sourceUrl:ref.sourceUrl,image:ref.localPath});
}
fs.writeFileSync(path.join(dist,'gym-floor-reference-sources.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Built '+specs.length+' equipment reference cards and '+stations.length+' bilingual station mappings.');
