(() => {
  'use strict';
  const localDate = () => {const d = new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  function age(birthday, today = localDate()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday || '') || birthday > today) return null;
    const date = new Date(birthday + 'T12:00:00');
    if (!Number.isFinite(date.getTime()) || date.getFullYear() !== Number(birthday.slice(0,4)) || date.getMonth()+1 !== Number(birthday.slice(5,7)) || date.getDate() !== Number(birthday.slice(8,10))) return null;
    return Number(today.slice(0,4))-Number(birthday.slice(0,4))-(today.slice(5)<birthday.slice(5)?1:0);
  }
  function clean(value) {
    if (!value || !['male','female'].includes(value.gender)) return null;
    const bounded = (n,min,max,fallback) => n != null && Number.isFinite(Number(n)) && Number(n)>=min && Number(n)<=max ? Number(n) : fallback;
    return {name:typeof value.name==='string'?value.name.trim().slice(0,40):'',gender:value.gender,
      birthday:age(value.birthday)!==null && age(value.birthday)<=120?value.birthday:'',
      weight:bounded(value.weight,1,1500,null),weightUnit:value.weightUnit==='lb'?'lb':'kg',targetWeight:bounded(value.targetWeight,1,1500,null),
      goal:['stay-active','strength','endurance','mobility','weight-management'].includes(value.goal)?value.goal:'stay-active',
      daysPerWeek:Math.round(bounded(value.daysPerWeek,1,7,3)),minutesPerWorkout:bounded(value.minutesPerWorkout,5,180,null),hoursPerWeek:bounded(value.hoursPerWeek,0.5,30,null),
      completed:value.completed===true,updatedAt:Number.isFinite(value.updatedAt)?value.updatedAt:0};
  }
  window.GymProfileData={age,clean,localDate};
})();
