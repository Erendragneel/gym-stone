/* Functional front/back muscle-group diagrams, driven by explicit exercise mappings. */
(() => {
  'use strict';
  const data=window.GymMuscleData, ns='http://www.w3.org/2000/svg';
  const dialog=document.getElementById('exercise-dialog'), content=dialog.querySelector('.dialog-content');
  const layout=document.createElement('div');layout.className='exercise-preview-grid';
  const animation=document.createElement('div');animation.className='exercise-preview-animation';
  animation.append(document.getElementById('preview-image'));
  const panel=document.createElement('section');panel.id='preview-muscles';panel.className='muscle-panel';
  content.insertBefore(layout,document.getElementById('preview-instructions'));layout.append(animation,panel);
  dialog.setAttribute('aria-labelledby','preview-name');
  const outline='M110 7 C91 7 90 24 94 41 L99 54 L96 65 L73 72 Q57 76 49 93 L41 125 L32 157 L23 195 L17 224 L11 240 L13 251 L20 257 L28 250 L30 231 L41 207 L50 177 L57 152 L66 133 L73 161 L79 198 L75 221 L68 243 L65 283 L68 321 L73 356 L71 376 L65 420 L66 455 L57 474 Q69 485 87 475 L89 449 L95 409 L95 372 L99 342 L105 290 L110 278 L115 290 L121 342 L125 372 L125 409 L131 449 L133 475 Q151 485 163 474 L154 455 L155 420 L149 376 L147 356 L152 321 L155 283 L152 243 L145 221 L141 198 L147 161 L154 133 L163 152 L170 177 L179 207 L190 231 L192 250 L200 257 L207 251 L209 240 L203 224 L197 195 L188 157 L179 125 L171 93 Q163 76 147 72 L124 65 L121 54 L126 41 C130 24 129 7 110 7 Z';
  // Left-side anatomical regions are reflected for an unobstructed, bilateral overview.
  const front=[
    ['neck','M99 51 L97 64 L82 73 L98 75 L108 61 Z'],
    ['frontDelts','M69 77 Q54 80 50 99 L51 111 Q62 110 72 94 Z'],
    ['sideDelts','M48 105 L43 128 L53 132 L60 115 Z'],
    ['chest','M75 80 L107 77 L107 126 Q92 138 71 124 L66 110 Z'],
    ['biceps','M53 119 Q65 111 64 132 L55 163 Q42 166 46 143 Z'],
    ['brachialis','M44 134 L40 155 L46 174 L51 165 Z'],
    ['triceps','M63 126 L67 137 L60 166 L56 166 Z'],
    ['forearmFlexors','M43 171 L49 177 L39 209 L28 230 L24 223 L30 194 Z'],
    ['brachioradialis','M37 171 L42 173 L32 204 L27 213 L26 205 Z'],
    ['forearmExtensors','M31 174 L35 173 L25 216 L21 224 L20 219 Z'],
    ['serratus','M70 132 L81 135 L85 148 L74 155 Z M73 156 L85 151 L86 163 L77 171 Z'],
    ['obliques','M78 174 L88 166 L91 199 L99 214 L80 207 Z'],
    ['abs','M95 138 L107 136 L107 152 L94 153 Z M94 156 L107 155 L107 171 L94 171 Z M94 174 L107 174 L107 190 L94 190 Z M96 194 L107 194 L107 210 L101 211 Z'],
    ['deepCore','M84 214 L107 217 L107 232 L94 234 L80 226 Z'],
    ['hipFlexors','M80 235 L94 237 L103 254 L94 265 L82 253 Z'],
    ['hipAbductors','M72 236 L78 237 L80 256 L74 272 L68 267 Z'],
    ['adductors','M94 267 L105 265 L104 299 L99 320 L91 299 L87 280 Z'],
    ['quads','M74 265 L84 261 L89 291 L98 323 L92 351 L77 353 L70 325 L68 292 Z'],
    ['tibialis','M79 376 L88 378 L87 415 L81 452 L73 453 L73 423 Z'],
    ['gastrocnemius','M70 379 L76 377 L70 413 L67 410 Z'],
    ['soleus','M69 416 L72 413 L71 448 L67 449 Z']
  ];
  const back=[
    ['neck','M99 51 L96 65 L107 74 L108 57 Z'],
    ['upperTraps','M93 68 L108 77 L108 105 L88 94 L72 80 Z'],
    ['rearDelts','M68 81 Q53 84 50 105 L53 118 L71 106 L80 94 Z'],
    ['sideDelts','M48 112 L43 128 L51 135 L58 118 Z'],
    ['rotatorCuff','M73 105 L86 99 L90 113 L82 129 L69 123 Z'],
    ['rhomboids','M90 105 L101 110 L103 144 L92 136 L86 120 Z'],
    ['midTraps','M105 111 L109 113 L108 172 L96 151 L97 144 L105 147 Z'],
    ['lats','M72 133 L89 140 L97 164 L92 189 L83 202 L77 177 Z'],
    ['spinalErectors','M99 168 L107 176 L107 222 L94 225 L96 199 Z'],
    ['triceps','M54 122 Q66 113 65 133 L57 166 L46 166 L45 151 Z'],
    ['brachialis','M44 138 L40 156 L45 170 L49 167 Z'],
    ['forearmExtensors','M41 172 L49 179 L38 210 L28 231 L24 223 L30 191 Z'],
    ['forearmFlexors','M32 176 L37 172 L26 214 L21 224 L20 218 Z'],
    ['obliques','M78 203 L91 194 L92 221 L79 227 L76 219 Z'],
    ['hipAbductors','M78 231 L96 230 L101 239 L85 246 L72 250 Z'],
    ['glutes','M73 253 Q88 241 107 244 L107 277 Q92 288 72 279 L68 270 Z'],
    ['hipRotators','M73 284 L103 283 L100 293 L76 293 Z'],
    ['adductors','M102 297 L105 298 L100 329 L95 341 L93 325 Z'],
    ['hamstrings','M71 297 L91 296 L98 320 L92 354 L77 354 L71 332 Z'],
    ['gastrocnemius','M77 376 Q91 372 91 389 L86 414 L72 414 L70 399 Z'],
    ['soleus','M71 417 L85 418 L81 444 L73 452 L68 445 Z'],
    ['tibialis','M87 420 L90 408 L86 450 L83 451 Z']
  ];
  function svgElement(tag,attributes={}){const el=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attributes))el.setAttribute(key,value);return el;}
  function diagram(view,profile){
    const figure=document.createElement('figure');figure.className='muscle-figure';
    const svg=svgElement('svg',{viewBox:'0 0 220 490',role:'img','aria-label':view+' muscle map for '+profile.name});
    const description=svgElement('desc');description.textContent='Dark red primary: '+names(profile.primary)+'. Light red secondary: '+(names(profile.secondary)||'none listed')+'.';svg.append(description);
    svg.append(svgElement('path',{d:outline,class:'muscle-body-outline'}));
    for(const [key,d]of view==='Front'?front:back){
      const role=profile.primary.includes(key)?'primary':profile.secondary.includes(key)?'secondary':'inactive';
      for(const reflected of [false,true]){
        const region=svgElement('path',{d,class:'muscle-region muscle-'+role,'data-muscle':key,'data-role':role,...(reflected?{transform:'translate(220 0) scale(-1 1)'}:{})});
        const title=svgElement('title');title.textContent=data.definitions[key]+(role==='inactive'?'': ' · '+role);region.append(title);svg.append(region);
      }
    }
    svg.append(svgElement('path',{d:'M110 78 V233 M76 360 Q84 366 93 359 M127 359 Q136 366 144 360 M73 455 L83 456 M137 456 L147 455',class:'muscle-body-detail'}));
    const caption=document.createElement('figcaption');caption.textContent=view;figure.append(svg,caption);return figure;
  }
  function names(keys){return keys.map(key=>data.definitions[key]).join(' · ');}
  function legend(title,keys,role){
    const group=document.createElement('div');group.className='muscle-legend-group';
    const heading=document.createElement('h4'),swatch=document.createElement('span');swatch.className='muscle-swatch muscle-'+role;swatch.setAttribute('aria-hidden','true');heading.append(swatch,title);
    const list=document.createElement('p');list.className='muscle-list';list.textContent=keys.length?names(keys):'None listed';group.append(heading,list);return group;
  }
  function render(exercise){
    const profile=data.exercises[exercise.id];panel.replaceChildren();panel.hidden=!profile;
    if(!profile)return;
    panel.dataset.exercise=exercise.id;
    const heading=document.createElement('h3');heading.id='muscle-map-heading';heading.textContent=profile.kind==='stretch'?'Muscles stretched':'Muscles worked';panel.setAttribute('aria-labelledby',heading.id);
    const figures=document.createElement('div');figures.className='muscle-figures';figures.append(diagram('Front',profile),diagram('Back',profile));
    const legends=document.createElement('div');legends.className='muscle-legends';legends.append(legend(profile.kind==='stretch'?'Primary stretch targets':'Primary muscles',profile.primary,'primary'),legend(profile.kind==='stretch'?'Secondary stretch targets':'Secondary muscles',profile.secondary,'secondary'));
    const note=document.createElement('p');note.className='muscle-map-note';note.textContent=profile.kind==='stretch'?'Dark red: main stretch targets. Light red: supporting stretch targets.':profile.kind==='mobility'?'Dark red: main movement targets. Light red: supporting muscles.':'Dark red: primary muscles. Light red: assisting muscles and stabilizers.';
    const references=document.createElement('details');references.className='muscle-map-sources';
    const summary=document.createElement('summary');summary.textContent='About this muscle map';
    const explanation=document.createElement('p');explanation.textContent='Shows major muscle groups and stabilizers, with deep muscles projected by location. Roles can change with technique and resistance.';
    references.append(summary,explanation);
    for(const source of data.sources){const link=document.createElement('a');link.href=source.url;link.textContent=source.title;link.target='_blank';link.rel='noopener';references.append(link);}
    panel.append(heading,figures,legends,note,references);
  }
  window.GymMuscles={render};
})();
