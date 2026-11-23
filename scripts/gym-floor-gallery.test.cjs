'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
const machines=require('../dist/machine-data.js');
const read=name=>JSON.parse(fs.readFileSync(path.join(dist,name),'utf8'));
const stations=read('gym-floor-stations.json').stations,photos=read('machine-photo-references.json'),sources=read('gym-floor-reference-sources.json');
const photoById=new Map(photos.map(p=>[p.id,p]));
assert.equal(stations.length,55);assert.equal(new Set(stations.map(s=>s.japanese)).size,55);
for(const station of stations){
 const exact=machines.labelMatches(station.japanese.replace('（判読候補）','')).map(m=>m.id);
 assert.deepEqual(station.machineIds,exact,'Gallery lookup is stale: '+station.japanese);
 for(const id of [station.referenceId,...station.additionalReferenceIds])assert(photoById.has(id),'Missing station photo: '+id);
 if(!station.needsConfirmation)assert(station.machineIds.some(id=>machines.get(id).exerciseIds.length),'Ready gallery card has no exercise: '+station.english);
}
for(const photo of photos){
 assert(/^https:\/\//.test(photo.sourceUrl),'Picture requires source attribution');
 assert(/^assets\/machine-references\/[a-z0-9-]+\.(webp|png|jpe?g)$/.test(photo.localPath),'Unsafe picture path');
 const bytes=fs.readFileSync(path.join(dist,photo.localPath));
 assert(bytes.length>1000,'Empty picture: '+photo.id);
 const fileType=photo.localPath.endsWith('.webp')?bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP':photo.localPath.endsWith('.png')?bytes[0]===137&&bytes.toString('ascii',1,4)==='PNG':bytes[0]===255&&bytes[1]===216;
 assert(fileType,'Picture extension differs from image bytes: '+photo.id);
 assert(!Object.keys(photo).some(k=>/absolutePath/i.test(k)),'Local filesystem path leaked into publication metadata');
}
const catalog=read('exercises.json'),newRows=catalog.filter(e=>e.gymFloorSupplement);
assert.equal(sources.length,newRows.length);
for(const exercise of newRows){
 const source=sources.find(r=>r.exerciseId===exercise.id);assert(source&&photoById.has(source.referenceId),'Exercise picture source is missing: '+exercise.id);
 const svg=fs.readFileSync(path.join(dist,exercise.image),'utf8');assert(svg.includes('EQUIPMENT REFERENCE')&&svg.includes('data:image/'),'Equipment picture missing: '+exercise.id);
}
const sw=fs.readFileSync(path.join(dist,'sw.js'),'utf8'),sandbox={self:{registration:{scope:'https://example.test/'},addEventListener(){}},URL};
vm.runInNewContext(sw+'\nthis.paths=SHELL;',sandbox);
const shell=new Set(sandbox.paths.map(p=>new URL(p,'https://example.test/').pathname.replace(/^\//,'')));
for(const file of ['machine-guide.html','machine-guide.js','machine-guide.css','gym-floor-links.js','gym-floor-stations.json','machine-photo-references.json',...photos.map(p=>p.localPath),...newRows.map(r=>r.image)])assert(shell.has(file),'New offline reference is missing: '+file);
console.log('PASS: 55 gallery labels, all picture assets/provenance, 22 reference cards, exact station links and offline coverage.');
