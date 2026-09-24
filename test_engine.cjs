'use strict';
const assert=require('node:assert/strict');
const E=require('./engine.js');
const now='2026-09-23';
const p={...E.defaults(),goalMode:'time',goalDistance:10,goalTime:'37:00',startDate:'2026-09-28',raceDate:'2026-12-20',thresholdHabit:2,recentLongMinutes:75,confirmed:true};
const plan=E.generate(p,now,'test');
assert.equal(plan.weeks.length,12);
assert.equal(plan.weeks[0].qualityCount,2);
assert.equal(plan.weeks[0].sessions.length,6);
assert.equal(plan.weeks[0].sessions.filter(s=>s.type==='threshold').map(s=>s.date).join(','),'2026-09-29,2026-10-01');
assert.equal(plan.weeks[3].phase,'Lettere uke');
assert.equal(plan.weeks[11].phase,'Konkurranseuke');
assert.equal(plan.weeks[11].sessions.filter(s=>s.type==='race').length,1);
assert.equal(E.parseTime('1:25:30'),5130);
assert(Number.isNaN(E.parseTime('38:99')));
assert.equal(E.time(3599), '59:59');
assert.equal(E.difference('2026-10-26','2026-10-24'),2);
assert.equal(E.addDays('2026-10-24',2),'2026-10-26');
const faster=E.generate({...p,goalTime:'32:00'},now,'faster');
assert.equal(plan.speeds.controlledFast,faster.speeds.controlledFast);
assert.equal(plan.speeds.easy,faster.speeds.easy);
for(let i=0;i<11;i++)assert.deepEqual(plan.weeks[i].sessions.map(s=>[s.type,s.minutes,s.km]),faster.weeks[i].sessions.map(s=>[s.type,s.minutes,s.km]));
assert.equal(E.validate({...p,raceDate:'2026-09-30'},now).length,0);
assert(E.validate({...p,raceDate:'2026-09-28'},now).length>0);
assert(E.validate({...p,referenceTime:'invalid'},now).length>0);
assert(E.validate({...p,control:'lactate',lactateCap:''},now).length>0);
assert(E.validate({...p,days:[0,0,1,3,6]},now).length>0);

// Regression: the longer run is anchored to recently tolerated duration instead of receiving only a 1.6x share.
const normalLong=plan.weeks[0].sessions.find(s=>s.type==='long');
assert(normalLong,'expected a longer run in a normal week');
assert(normalLong.km>=12,`long run too short: ${normalLong.km} km`);
assert(normalLong.minutes>=65,`long run too short: ${normalLong.minutes} min`);
assert.equal(plan.engineVersion,'1.3');

const zones=E.hrZones(195);
assert.deepEqual(zones.map(z=>[z.label,z.low,z.high]),[['I-1',107,140],['I-2',141,159],['I-3',160,169],['I-4',170,179],['I-5',180,195]]);
assert.deepEqual(E.hrZones(''),[]);
const pulsePlan=E.generate({...p,maxHr:195},now,'pulse');
assert(pulsePlan.weeks.flatMap(w=>w.sessions).filter(s=>s.type==='easy'||s.type==='long').every(s=>s.zone===1));
assert(pulsePlan.weeks.flatMap(w=>w.sessions).filter(s=>s.type==='threshold').every(s=>s.zone===3));
for(const s of pulsePlan.weeks.flatMap(w=>w.sessions).filter(s=>(s.type==='easy'||s.type==='long')&&s.minutes>=20))assert.equal(s.minutes%5,0,'easy durations should use five-minute blocks');
assert(E.validate({...p,maxHr:99},now).some(x=>x.includes('Makspuls')));
assert.equal(E.validate({...p,maxHr:195},now).length,0);

const compressed=E.generate({...p,startDate:'2026-09-24',raceDate:'2026-12-20',startWeekKm:40,startWeekThreshold:0,startWeekLongDone:false},now,'compressed');
const compressedWeek=compressed.weeks[0],compressedLong=compressedWeek.sessions.find(s=>s.type==='long');
assert(compressedLong&&compressedLong.km>=10,'compressed start week should protect a real longer run');
assert.equal(compressedWeek.sessions.filter(s=>s.type==='threshold').length,0,'quality should be removed before the longer run is squeezed');
const tooShort=E.generate({...p,startDate:'2026-09-27',raceDate:'2026-12-20',startWeekKm:46,startWeekThreshold:1,startWeekLongDone:false},now,'too-short');
assert.equal(tooShort.weeks[0].sessions.filter(s=>s.type==='long').length,0,'a very short remainder must not be labelled as a longer run');

const mid={...p,startDate:'2026-09-24',raceDate:'2026-10-01',startWeekKm:22,startWeekThreshold:1,startWeekLongDone:false};
const midPlan=E.generate(mid,now,'mid');
assert.equal(midPlan.weeks.length,2);
assert.equal(midPlan.weeks[0].start,'2026-09-21');
assert.equal(midPlan.weeks[0].planStart,'2026-09-24');
assert(midPlan.weeks[0].sessions.every(s=>s.date>='2026-09-24'));
assert(midPlan.weeks[0].km<=midPlan.weeks[0].targetKm+0.6);
assert(midPlan.weeks[0].qualityCount<=1);
assert.equal(midPlan.weeks[1].phase,'Konkurranseuke');
assert.equal(midPlan.weeks[1].sessions.filter(s=>s.type==='race').length,1);
const short={...p,startDate:'2026-09-23',raceDate:'2026-09-27',startWeekKm:15,startWeekThreshold:1,startWeekLongDone:true};
const shortPlan=E.generate(short,now,'short');
assert.equal(shortPlan.weeks.length,1);
assert.equal(shortPlan.weeks[0].phase,'Konkurranseuke');
assert(shortPlan.weeks[0].sessions.every(s=>s.date>='2026-09-23'));
assert.equal(shortPlan.weeks[0].sessions.filter(s=>s.type==='race').length,1);
let cases=0;
for(let mask=0;mask<128;mask++){
 const days=Array.from({length:7},(_,i)=>i).filter(i=>mask&(1<<i));if(days.length<3)continue;
 for(const km of [10,25,40,55,100])for(const habit of [0,1,2])for(const dist of [5,10,21.0975]){
  const profile={...p,goalMode:'consistency',weeks:12,days,longDay:days[days.length-1],baseKm:km,thresholdHabit:habit,goalDistance:dist,maxMinutes:60,recentLongMinutes:55};
  const test=E.generate(profile,now,'test-'+cases);
  for(const w of test.weeks){
   assert(Number.isFinite(w.km)&&w.km>=0,'week km finite');
   assert(w.km<=w.targetKm+0.6,`overshot target: ${w.km} vs ${w.targetKm}`);
   assert(w.easyPercent>=60&&w.easyPercent<=100,`easy percent ${w.easyPercent}`);
   assert(w.qualityCount<=2);
   assert.equal(w.km,E.round(w.sessions.reduce((a,s)=>a+s.km,0)));
   for(const s of w.sessions){assert(s.minutes>=0&&Number.isFinite(s.minutes));assert(s.minutes<=60,`time cap: ${s.minutes}`);assert(s.km>=0);}
   const qs=w.sessions.filter(s=>s.type==='threshold');for(let i=1;i<qs.length;i++)assert(E.difference(qs[i].date,qs[i-1].date)>=2);
  }
  const all=test.weeks.flatMap(w=>w.sessions).filter(s=>s.type==='threshold');for(let i=1;i<all.length;i++)assert(E.difference(all[i].date,all[i-1].date)>=2);
  if(habit===0){assert.equal(test.weeks[0].qualityCount,0);assert.equal(test.weeks[1].qualityCount,0);assert(test.weeks[2].workMinutes<=12);}
  cases++;
 }
}
const sickness=[{id:'x',date:'2026-09-22',status:'done',feeling:'sick',type:'easy',km:4,seconds:1800,rpe:5,samples:[]}];
assert.equal(E.review(plan,sickness,0,now).kind,'pause');
const paused=E.adjustWeek(plan.weeks[11],'pause');assert.equal(paused.km,0);assert.equal(paused.qualityCount,0);
const reduced=E.adjustWeek(plan.weeks[0],'reduce');assert(reduced.km<plan.weeks[0].km);assert(reduced.qualityCount<=1);
assert.throws(()=>E.adjustWeek(reduced,'reduce'));
assert.equal(E.review(plan,[],0,now).canApply,false);
console.log(JSON.stringify({cases,checks:'PASS',sample:plan.weeks.map(w=>({week:w.index+1,km:w.km,min:w.minutes,threshold:w.workMinutes,quality:w.qualityCount,phase:w.phase}))},null,2));
