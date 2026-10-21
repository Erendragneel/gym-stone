/* Assemble complete, redrawn calf poses without cutting or warping anatomy. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const sharp = require('C:/Users/Elijio Villa jr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '..'), sourceRoot = path.join(root, 'animation-source/calf-repair');
const specs = [
  ['guide-standing-calf-raise', 'standing-calf-raise-v2'],
  ['guide-standing-dumbbell-calf-raise', 'standing-dumbbell-calf-raise'],
  ['exp-single-leg-standing-calf-raise', 'single-leg-standing-calf-raise'],
  ['exp-single-leg-dumbbell-calf-raise', 'single-leg-dumbbell-calf-raise']
];
const sequence = [0,1,2,3,2,1];
const delays = sequence.map(pose => pose === 0 || pose === 3 ? 440 : 260);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function build() {
  const catalogFile = path.join(root, 'dist/exercises.json'), catalog = read(catalogFile);
  const layoutFile = path.join(sourceRoot, 'source-layout.json');
  const layouts = fs.existsSync(layoutFile) ? read(layoutFile) : {};
  const records = [];
  fs.mkdirSync(path.join(sourceRoot, 'review'), {recursive: true});
  for (const [id, slug] of specs) {
    const source = path.join(sourceRoot, 'sheets', slug + '.png'), bytes = fs.readFileSync(source);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, metadata.height, 'Source sheet must use square cells: ' + slug);
    // One uniform camera scale for the full sheet, shared by every pose and gender.
    const normalized = await sharp(bytes).resize(1696,1696).flatten({background:'#fff'}).removeAlpha().png().toBuffer();
    const record = catalog.find(row => row.id === id); assert(record, 'Missing exercise ' + id);
    const variants = {};
    for (const [gender, rowOffset] of [['male',0],['female',8]]) {
      const layout = layouts[id]?.[gender] || {};
      const poses = [], frames = [];
      for (let pose = 0; pose < 4; pose++) {
        // Each source row supplies one reviewed continuous four-phase rise.
        const sourcePose = (layout.poseOrder || [0,1,2,3])[pose];
        const cell = sourcePose + rowOffset;
        const rect = layout.sourceRects?.[pose] || {left:cell%4*424+2,top:Math.floor(cell/4)*424+2,width:420,height:420};
        const extracted = await sharp(normalized).extract(rect).png().toBuffer();
        const crop = await sharp({create:{width:420,height:420,channels:3,background:'#fff'}}).composite([{input:extracted,left:0,top:0}]).png().toBuffer();
        const [x,y] = layout.offsets?.[pose] || [0,0];
        assert(Number.isInteger(x) && Number.isInteger(y) && Math.abs(x)<=50 && Math.abs(y)<=50, 'Invalid whole-frame translation');
        // Materialize the composite before extracting: libvips applies extract
        // before composite when both operations share one pipeline.
        const padded = x || y ? await sharp({create:{width:520,height:520,channels:3,background:'#fff'}}).composite([{input:crop,left:50+x,top:50+y}]).png().toBuffer() : null;
        const translated = padded ? await sharp(padded).extract({left:50,top:50,width:420,height:420}).png().toBuffer() : crop;
        const scaled = await sharp(translated).resize(378,378).png().toBuffer();
        const displayed = await sharp({create:{width:420,height:420,channels:3,background:'#fff'}}).composite([{input:scaled,left:21,top:21}]).png().toBuffer();
        poses.push(displayed);
        frames.push(await sharp({create:{width:600,height:484,channels:3,background:'#fff'}}).composite([{input:displayed,left:90,top:32}]).removeAlpha().raw().toBuffer());
        assert.equal(frames.at(-1).length,600*484*3);
      }
      const stem = gender+'-'+id;
      const poster = 'assets/motion-v18/'+stem+'-poster.webp', atlas = 'assets/motion-v18/'+stem+'-atlas.webp';
      await sharp(frames[0],{raw:{width:600,height:484,channels:3}}).webp({lossless:true,effort:5}).toFile(path.join(root,'dist',poster));
      await sharp({create:{width:1680,height:420,channels:3,background:'#fff'}}).composite(poses.map((input,i)=>({input,left:i*420,top:0}))).webp({lossless:true,effort:5}).toFile(path.join(root,'dist',atlas));
      // Verify that the exact displayed canvas reconstructs every approved source cell.
      for(let pose=0;pose<4;pose++) {
        const packed = await sharp(path.join(root,'dist',atlas)).extract({left:pose%4*420,top:Math.floor(pose/4)*420,width:420,height:420}).png().toBuffer();
        const restored = await sharp({create:{width:600,height:484,channels:3,background:'#fff'}}).composite([{input:packed,left:90,top:32}]).removeAlpha().raw().toBuffer();
        assert(restored.equals(frames[pose]), 'Packed pose pixels changed: '+stem+':'+pose);
      }
      const animation = {keyframes:sequence.length,uniquePoses:4,duration_ms:delays.reduce((a,b)=>a+b,0),framing:'Fixed camera; complete ImageGen character poses with whole-frame translation only',nativeTransformVersion:2,background:'#ffffff',crossfade:false,atlas,columns:4,frameWidth:600,frameHeight:484,delayMs:delays,isometricHold:false,atlasFrameWidth:420,atlasFrameHeight:420,atlasOffsetX:90,atlasOffsetY:32,storedPoses:4,poseSequence:sequence};
      variants[gender] = {image:poster,poster,style:'Controlled anime exercise loop',animation};
      await sharp({create:{width:2400,height:484,channels:3,background:'#fff'}}).composite(frames.map((input,i)=>({input,raw:{width:600,height:484,channels:3},left:i*600,top:0}))).png().toFile(path.join(sourceRoot,'review',stem+'-contact.png'));
      await sharp(Buffer.concat(sequence.map(pose=>frames[pose])),{raw:{width:600,height:484*sequence.length,channels:3,pageHeight:484}}).webp({lossless:true,loop:0,delay:delays}).toFile(path.join(sourceRoot,'review',stem+'-loop.webp'));
    }
    const previousNonvisual = Object.fromEntries(Object.entries(record).filter(([key])=>!['image','poster','style','animation','variants'].includes(key)));
    Object.assign(record, variants.male, {variants});
    assert.deepEqual(Object.fromEntries(Object.entries(record).filter(([key])=>!['image','poster','style','animation','variants'].includes(key))),previousNonvisual);
    records.push({id,source:path.relative(root,source).replaceAll('\\','/'),sourceSha256:hash(bytes),variants});
  }
  write(catalogFile,catalog);
  const releaseFile = path.join(root,'dist/motion-release.json'), release = read(releaseFile);
  for (const binding of release.nativeSourceBindings) {
    const record = records.find(row=>row.id===binding.exercise);
    if(record) binding.sourceHash = record.sourceSha256;
  }
  const original = catalog.filter(row=>!row.postpartum && !row.kettlebellAnimation);
  release.keyframes = original.reduce((sum,row)=>sum+Object.values(row.variants).reduce((count,value)=>count+value.animation.keyframes,0),0);
  release.calfRepair = {date:'2026-10-21',exercises:4,variants:8,sourceMethod:'Built-in ImageGen whole-character redraw; no segmented anatomy',pixelsVerified:true};
  write(releaseFile,release);
  write(path.join(sourceRoot,'repair-manifest.json'),{schemaVersion:1,sequence,delayMs:delays,sourceLayoutSha256:hash(fs.readFileSync(layoutFile)),uniformCameraScale:0.9,records});
  const {createManifest,verifyPackage} = require('./verify-motion-package.cjs');
  write(path.join(root,'dist/motion-package-manifest.json'),createManifest(root,release.nativeSourceBindings));
  console.log(JSON.stringify({...verifyPackage(root),nativeSourceBindings:undefined}));
}
if(require.main===module)build().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={build};
