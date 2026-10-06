'use strict';
const fs=require('node:fs'),path=require('node:path');
const dist=path.resolve(process.argv[2]||path.join(__dirname,'dist'));
const appPath=path.join(dist,'app.js');let app=fs.readFileSync(appPath,'utf8');
if(!app.includes('window.GymMuscles?.render(e)')){
 const before="window.GymStretches?.preview(e);renderPreview();$('exercise-dialog').showModal()";
 if(!app.includes(before))throw Error('Preview integration point changed; preserve source and review.');
 app=app.replace(before,"window.GymStretches?.preview(e);window.GymMuscles?.render(e);renderPreview();$('exercise-dialog').showModal()");
 fs.writeFileSync(appPath,app);
}
const indexPath=path.join(dist,'index.html');let html=fs.readFileSync(indexPath,'utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=12');
if(!html.includes('muscle-map.js'))html=html.replace('</head>','<link rel="stylesheet" href="muscle-map.css?v=1"><script src="exercise-muscles.js?v=1" defer></script><script src="muscle-map.js?v=1" defer></script></head>');
fs.writeFileSync(indexPath,html);
const swPath=path.join(dist,'sw.js');let sw=fs.readFileSync(swPath,'utf8');
sw=sw.replace(/shell-v\d+-[\w-]+/, 'shell-v15-muscles').replace(/app\.js\?v=\d+/g,'app.js?v=12');
if(!sw.includes('muscle-map.js'))sw=sw.replace("'./exercises.json'","'./exercises.json', './exercise-muscles.js?v=1', './muscle-map.js?v=1', './muscle-map.css?v=1'");
fs.writeFileSync(swPath,sw);
console.log('Exercise preview and offline shell now include muscle maps.');
