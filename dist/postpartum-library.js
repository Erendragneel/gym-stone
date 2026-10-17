/* Recovery guidance is separate from prenatal and general workout progression. */
(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  let category='All';
  const panel=document.createElement('section');
  panel.id='postpartum-guidance';panel.className='postpartum-guidance';panel.hidden=true;
  panel.setAttribute('aria-label','Postpartum recovery guidance');
  panel.innerHTML=`<h3>Recovery at your pace</h3>
    <p>Recovery after birth is individual. Follow your maternity team’s plan, especially after a caesarean, significant tear or complications. These options cannot assess healing or provide medical clearance. Start only when comfortable and permitted in your recovery plan. Rest or skip whenever needed.</p>
    <p class="postpartum-stop"><strong>Stop and seek advice</strong> for pain, leakage, pelvic heaviness or pressure, tummy bulging, or new/increased bleeding during or after activity.</p>
    <div class="postpartum-controls"><label for="postpartum-category">Options <select id="postpartum-category"><option value="All">All recovery options</option><option>Gentle starts</option><option>Clinician guided</option></select></label></div>
    <details><summary>Before pelvic floor or core exercises</summary><p>Use the clinician guided options only if recommended for you. Wait until a urinary catheter is removed before pelvic floor contractions. Ask a pelvic health physiotherapist if contractions hurt, you cannot fully release, or you are unsure of technique. There is no automatic week-based clearance. These are position guides; choose your own comfortable amount without targets.</p></details>
    <details id="postpartum-urgent"><summary>Warning signs that need urgent medical care</summary><p>Seek urgent care for chest pain, difficulty breathing, fainting, severe headache or vision changes, severe persistent tummy pain, fever of 38°C or higher, or a painful/swollen/red leg. Heavy bleeding soaking at least one pad an hour, clots larger than an egg, or foul-smelling discharge also need urgent care. Tell the care team you recently gave birth. This list is not exhaustive.</p></details>
    <p class="postpartum-sources">Guidance: <a href="https://www.acog.org/womens-health/faqs/exercise-after-pregnancy" target="_blank" rel="noopener">ACOG</a> · <a href="https://www.nhs.uk/baby/support-and-services/your-post-pregnancy-body/" target="_blank" rel="noopener">NHS</a> · <a href="https://www.cdc.gov/hearher/maternal-warning-signs/index.html" target="_blank" rel="noopener">CDC warning signs ↗</a></p>`;
  byId('pregnancy-guidance').after(panel);
  byId('postpartum-category').addEventListener('change',event=>{category=event.target.value;byId('exercise-grid').scrollTop=0;renderExercises()});
  function render(group){
    const allowed=GymProfile.gender==='female',active=group==='Postpartum'&&allowed;
    panel.hidden=!active;
    document.querySelector('.library').classList.toggle('is-postpartum',active);
    const button=byId('stretch-tabs').querySelector('[data-group="Postpartum"]');
    button.hidden=!allowed;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  }
  function matches(exercise,group){return group!=='Postpartum'||category==='All'||exercise.postpartumCategory===category}
  function preview(exercise){
    if(!exercise.postpartum)return false;
    const help=byId('preview-instructions');help.replaceChildren();
    const readiness=document.createElement('strong');readiness.className='postpartum-readiness';readiness.textContent=(exercise.postpartumCategory==='Clinician guided'?'Only if recommended for you. ':'')+exercise.readiness;
    const cues=document.createElement('span');cues.textContent=exercise.cues.map(cue=>cue.trim().replace(/[.!?]+$/,'')).join('. ')+'.';
    const adjustment=document.createElement('span');adjustment.className='postpartum-preview-note';adjustment.textContent=exercise.adjustment;
    const caution=document.createElement('span');caution.className='postpartum-preview-note';caution.textContent='Follow your maternity team’s recovery plan. Stop for pain, leakage, heaviness, tummy bulging or increased bleeding and seek advice. Rest or skip whenever needed; no time or repetition target is required.';
    const source=document.createElement('a');source.className='postpartum-preview-source';source.href=exercise.guidanceUrl;source.target='_blank';source.rel='noopener';source.textContent='Read recovery guidance ↗';
    const urgent=document.createElement('a');urgent.className='postpartum-preview-source';urgent.href='https://www.cdc.gov/hearher/maternal-warning-signs/index.html';urgent.target='_blank';urgent.rel='noopener';urgent.textContent='Urgent warning signs after birth ↗';
    help.append(readiness,cues,adjustment,caution,source,urgent);return true;
  }
  window.GymPostpartum={render,matches,preview};
  render(filter);
})();
