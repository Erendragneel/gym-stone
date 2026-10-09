(() => {
  'use strict';
  const tracking=window.GymTracking;
  const entryUnit=entry=>tracking.weightUnit({weightUnit:entry.weightUnit||(tracking.weight(entry.weight)!==null?'kg':GymProfile.value.weightUnit)});
  function updateTotal(record,section){
    const rows=tracking.entries(record),totals=tracking.totals(record);
    section.querySelector('.workout-total').textContent=totals.validEntries?rows.length===1?totals.sets+' sets × '+tracking.count(rows[0].reps)+' reps = '+totals.reps+' total reps':totals.sets+' sets · '+totals.reps+' total reps':'Enter '+(record.done?'completed':'planned')+' sets and reps';
  }
  function render(record,exercise,fields,save) {
    const section=document.createElement('div');section.className='set-entries';
    const saveFields=()=>save();
    const heading=document.createElement('div');heading.className='set-entries-heading';
    const title=document.createElement('strong');title.textContent='Sets & reps';
    const add=document.createElement('button');add.type='button';add.className='add-set-entry';add.textContent='+ Add entry';add.setAttribute('aria-label','Add sets and reps entry for '+exercise.name);
    function focusEntry(index){const details=[...document.querySelectorAll('.workout-details')].find(details=>details.dataset.id===record.id);details?.querySelector('.set-entry[data-entry-index="'+index+'"] input')?.focus()}
    add.onclick=()=>{tracking.addEntry(record,entryUnit(tracking.entries(record).at(-1)));const index=record.setEntries.length-1;save();focusEntry(index)};
    heading.append(title,add);section.append(heading);
    const rows=tracking.entries(record),canWeight=tracking.supportsWeight(record,exercise),assisted=tracking.assistance(record,exercise);
    rows.forEach((entry,index)=>{
      const row=document.createElement('div');row.className='set-entry';row.dataset.entryIndex=String(index);
      const header=document.createElement('div');header.className='set-entry-heading';
      const label=document.createElement('span');label.textContent='Entry '+(index+1);header.append(label);
      if(rows.length>1){const remove=document.createElement('button');remove.type='button';remove.className='remove-set-entry';remove.textContent='Remove';remove.setAttribute('aria-label','Remove entry '+(index+1)+' for '+exercise.name);remove.onclick=()=>{tracking.removeEntry(record,index);save();focusEntry(Math.min(index,record.setEntries.length-1))};header.append(remove)}
      row.append(header);const grid=document.createElement('div');grid.className='set-entry-grid';
      const suffix=index?', entry '+(index+1):'';
      function field(key,label,aria,max,step,min){
        const wrapper=document.createElement('label');wrapper.textContent=label;
        const input=document.createElement('input');input.type='number';input.inputMode=step==='1'?'numeric':'decimal';input.min=String(min);input.max=String(max);input.step=step;input.value=entry[key]??'';input.placeholder='—';input.setAttribute('aria-label',aria+' '+exercise.name+suffix);
        input.onchange=()=>{
          if(!input.isConnected)return;
          if(input.value===''&&!input.validity.badInput){tracking.writeEntry(record,index,key,null);saveFields();return}
          if(!input.checkValidity()){input.reportValidity();return}
          const unit=entryUnit(entry);tracking.writeEntry(record,index,key,Number(input.value));
          if(key==='weight'){tracking.writeEntry(record,index,'weightUnit',unit);record.weightKind=assisted?'assistance':'load'}
          saveFields();
        };
        wrapper.append(input);grid.append(wrapper);
      }
      field('sets','Sets','Sets for',1000,'1',1);field('reps','Reps / set','Reps per set for',1000,'1',1);
      if(canWeight){
        field('weight',assisted?'Assistance (optional)':'Weight (optional)',assisted?'Assistance weight for':'Weight for',10000,'any',0);
        const wrapper=document.createElement('label');wrapper.textContent='Weight unit';const select=document.createElement('select');select.setAttribute('aria-label','Weight unit for '+exercise.name+suffix);
        for(const [value,label]of [['kg','Kilograms (kg)'],['lb','Pounds (lb)']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option)}
        select.value=entryUnit(entry);select.onchange=()=>{if(!select.isConnected)return;tracking.writeEntry(record,index,'weightUnit',select.value);record.weightKind=assisted?'assistance':'load';saveFields()};wrapper.append(select);grid.append(wrapper);
      }
      row.append(grid);section.append(row);
    });
    const total=document.createElement('span');total.className='workout-total';
    section.append(total);updateTotal(record,section);fields.append(section);
  }
  window.GymSetEntries={render};
})();
