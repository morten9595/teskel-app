/* Terskel v1.3 - deterministic planning rules, no remote services.
 * Programming choices are conservative heuristics, not a validated coaching model.
 */
(function(root){
'use strict';
const DAY_MS=86400000;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const round=(x,n=1)=>Math.round(x*10**n)/10**n;
function date(s){const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d,12);}
function iso(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function addDays(s,n){const d=date(s);d.setDate(d.getDate()+n);return iso(d);}
function difference(a,b){const da=date(a),db=date(b);return Math.round((Date.UTC(da.getFullYear(),da.getMonth(),da.getDate())-Date.UTC(db.getFullYear(),db.getMonth(),db.getDate()))/DAY_MS);}
function monday(s){const d=date(s);d.setDate(d.getDate()-((d.getDay()+6)%7));return iso(d);}
function today(){return iso(new Date());}
function parseTime(value){
 if(typeof value!=='string'||!/^\d{1,3}:\d{2}(:\d{2})?$/.test(value.trim()))return NaN;
 const a=value.trim().split(':').map(Number);
 if(a[a.length-1]>=60||(a.length===3&&a[1]>=60))return NaN;
 return a.length===3?a[0]*3600+a[1]*60+a[2]:a[0]*60+a[1];
}
function time(seconds){if(!Number.isFinite(seconds)||seconds<0)return '\u2014';const s=Math.round(seconds);return s>=3600?`${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`:`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
function pace(seconds){return time(seconds);}
function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(date(s).getTime())&&iso(date(s))===s;}
function defaults(){const start=today();return {name:'Morten',goalMode:'time',goalDistance:10,goalTime:'',raceDate:'',startDate:start,startWeekKm:0,startWeekThreshold:0,startWeekLongDone:false,weeks:12,referenceDistance:10,referenceTime:'38:00',baseKm:55,maxKm:55,growth:false,days:[0,1,2,3,5,6],longDay:6,maxMinutes:90,recentLongMinutes:'',thresholdHabit:'',control:'effort',lactateCap:'',maxHr:'',pulseCap:'',thresholdSource:'auto',importedThresholdPace:'',importedActivityCount:0,importedThresholdConfidence:'',importedThresholdNote:'',controlledPace:'',strides:true,confirmed:false};}
function validate(p,now=today()){
 const errors=[];
 if(!p||typeof p!=='object')return ['Mangler oppsett.'];
 if(!['time','consistency'].includes(p.goalMode))errors.push('Velg en m\u00e5ltype.');
 if(![5,10,21.0975].includes(Number(p.goalDistance)))errors.push('Velg 5 km, 10 km eller halvmaraton.');
 if(![5,10,21.0975].includes(Number(p.referenceDistance)))errors.push('Velg distanse for niv\u00e5et ditt.');
 const rt=parseTime(p.referenceTime);if(!Number.isFinite(rt)||rt<Number(p.referenceDistance)*150||rt>Number(p.referenceDistance)*900)errors.push('Oppgi en gyldig, representativ l\u00f8pstid (mm:ss eller t:mm:ss).');
 if(!validDate(p.startDate))errors.push('Velg en gyldig startdato.');
 if(validDate(p.startDate)&&difference(p.startDate,monday(now))<0)errors.push('Velg en dato i innev\u00e6rende uke eller senere.');
 const startWeekKm=Number(p.startWeekKm??0),startWeekThreshold=Number(p.startWeekThreshold??0);
 if(!Number.isFinite(startWeekKm)||startWeekKm<0||startWeekKm>200)errors.push('Kilometer allerede l\u00f8pt i startuka m\u00e5 v\u00e6re 0\u2013200 km.');
 if(!Number.isInteger(startWeekThreshold)||startWeekThreshold<0||startWeekThreshold>2)errors.push('Kontrollerte \u00f8kter allerede gjort i startuka m\u00e5 v\u00e6re 0, 1 eller 2.');
 if(p.goalMode==='time'){
  const gt=parseTime(p.goalTime);if(!Number.isFinite(gt)||gt<Number(p.goalDistance)*150||gt>Number(p.goalDistance)*900)errors.push('Oppgi en gyldig m\u00e5ltid.');
  if(!validDate(p.raceDate))errors.push('Velg konkurransedato.');
  else if(validDate(p.startDate)&&(difference(p.raceDate,p.startDate)<1||difference(p.raceDate,p.startDate)>182))errors.push('Konkurransen m\u00e5 v\u00e6re etter planstart og senest 26 uker fram i tid.');
 }else if(!Number.isInteger(Number(p.weeks))||Number(p.weeks)<4||Number(p.weeks)>26)errors.push('Velg 4\u201326 uker.');
 if(!Number.isFinite(Number(p.baseKm))||Number(p.baseKm)<10||Number(p.baseKm)>100)errors.push('Denne versjonen st\u00f8tter 10\u2013100 km i normaluka.');
 if(p.growth&&(!Number.isFinite(Number(p.maxKm))||Number(p.maxKm)<Number(p.baseKm)||Number(p.maxKm)>120))errors.push('Maksimal mengde m\u00e5 v\u00e6re minst normalmengden og h\u00f8yst 120 km.');
 if(!Array.isArray(p.days)||new Set(p.days).size!==p.days.length||p.days.length<3||p.days.length>7||p.days.some(x=>!Number.isInteger(x)||x<0||x>6))errors.push('Velg minst tre ulike treningsdager.');
 if(!p.days?.includes(Number(p.longDay)))errors.push('Den lengre turen m\u00e5 ligge p\u00e5 en valgt treningsdag.');
 if(!Number.isFinite(Number(p.maxMinutes))||Number(p.maxMinutes)<30||Number(p.maxMinutes)>150)errors.push('Tid per \u00f8kt m\u00e5 v\u00e6re 30\u2013150 minutter.');
 if(p.recentLongMinutes===''||!Number.isFinite(Number(p.recentLongMinutes))||Number(p.recentLongMinutes)<20||Number(p.recentLongMinutes)>180)errors.push('Oppgi varigheten p\u00e5 en lengre tur du faktisk har t\u00e5lt siste m\u00e5ned (20\u2013180 min).');
 if(![0,1,2].includes(p.thresholdHabit))errors.push('Velg hvor mange kontrollerte terskel\u00f8kter du allerede t\u00e5ler per uke.');
 if(!['effort','lactate'].includes(p.control))errors.push('Velg intensitetsstyring.');
 if(p.control==='lactate'&&(p.lactateCap===''||!Number.isFinite(Number(p.lactateCap))||Number(p.lactateCap)<0.5||Number(p.lactateCap)>6))errors.push('Ved laktatstyring: oppgi din individuelt avklarte \u00f8vre treningsgrense (0,5\u20136 mmol/l).');
 if(p.maxHr!==''&&p.maxHr!=null&&(!Number.isFinite(Number(p.maxHr))||Number(p.maxHr)<100||Number(p.maxHr)>240))errors.push('Makspuls m\u00e5 v\u00e6re mellom 100 og 240, eller st\u00e5 tom.');
 if(p.pulseCap!==''&&(!Number.isFinite(Number(p.pulseCap))||Number(p.pulseCap)<80||Number(p.pulseCap)>220))errors.push('Pulsgrensen m\u00e5 v\u00e6re mellom 80 og 220, eller st\u00e5 tom.');
 if(p.controlledPace!==''&&(!Number.isFinite(parseTime(p.controlledPace))||parseTime(p.controlledPace)<150||parseTime(p.controlledPace)>900))errors.push('Kontrollert fart oppgis som mm:ss per km, eller st\u00e5r tom.');
 if(!p.confirmed)errors.push('Bekreft at oppsettet beskriver trening du t\u00e5ler n\u00e5.');
 return errors;
}
function hrZones(maxHr){
 const m=Number(maxHr);if(!Number.isFinite(m)||m<100||m>240)return [];
 const h1=Math.floor(m*.72),h2=Math.floor(m*.82),h3=Math.floor(m*.87),h4=Math.floor(m*.92);
 return [
  {zone:1,label:'I-1',low:Math.round(m*.55),high:h1,pct:'55\u201372 %',rpe:'1\u20132/10',breath:'Kan prate uanstrengt'},
  {zone:2,label:'I-2',low:h1+1,high:h2,pct:'72\u201382 %',rpe:'2\u20133/10',breath:'Lengre setninger relativt uanstrengt'},
  {zone:3,label:'I-3',low:h2+1,high:h3,pct:'82\u201387 %',rpe:'4\u20135/10',breath:'Korte setninger'},
  {zone:4,label:'I-4',low:h3+1,high:h4,pct:'87\u201392 %',rpe:'6\u20137/10',breath:'Noen ord eller sv\u00e6rt korte setninger'},
  {zone:5,label:'I-5',low:h4+1,high:Math.round(m),pct:'> 92 %',rpe:'8\u201310/10',breath:'Kun ett eller to ord'}
 ];
}
function speeds(p){
 const ref=parseTime(p.referenceTime),d=Number(p.referenceDistance);
 // Deliberately transparent estimates. These do NOT locate LT1 or LT2.
 const eq10=ref*Math.pow(10/d,1.06),p10=eq10/10;
 const custom=parseTime(p.controlledPace||'');
 const controlledFast=Number.isFinite(custom)?custom:p10*1.08;
 const controlledSlow=Number.isFinite(custom)?custom+15:p10*1.15;
 return {eq10,p10,easyFast:p10*1.30,easySlow:p10*1.55,easy:p10*1.425,controlledFast,controlledSlow,controlled:(controlledFast+controlledSlow)/2,custom:Number.isFinite(custom),goalEstimate:ref*Math.pow(Number(p.goalDistance)/d,1.06),goalPace:parseTime(p.goalTime||'')/Number(p.goalDistance)};
}
function qualityDays(days,longDay,count){
 const circular=(a,b)=>Math.min(Math.abs(a-b),7-Math.abs(a-b));
 const preferred=[1,3,0,2,4,5,6],longActive=days.includes(longDay);
 const candidates=preferred.filter(d=>days.includes(d)&&(!longActive||(d!==longDay&&circular(d,longDay)>=2)));
 let best=[];for(const a of candidates){if(!best.length)best=[a];for(const b of candidates){if(a!==b&&circular(a,b)>=2&&count>=2)return [a,b].sort((x,y)=>x-y);}}
 return best.slice(0,count);
}
function doseCount(p){if(Number(p.baseKm)<20||p.thresholdHabit===0)return 0;return Number(p.baseKm)>=40&&p.days.length>=5&&p.thresholdHabit===2?2:1;}
function longRunTarget(p,sp,fullTarget,buildStep,deload=false){
 const history=Number(p.recentLongMinutes);
 const growthAdd=p.growth?Math.min(15,buildStep*2):0;
 const absoluteCap=Math.min(Number(p.maxMinutes),history+growthAdd,Number(p.goalDistance)>20?120:100);
 let plannedMinutes=Math.min(absoluteCap,history+growthAdd);
 if(deload)plannedMinutes=Math.min(plannedMinutes,history*.85);
 const share=Number(p.goalDistance)>20?0.32:0.30;
 const volumeCapKm=Math.max(0,fullTarget*share);
 return {minutes:plannedMinutes,km:Math.min(plannedMinutes/(sp.easy/60),volumeCapKm),capMinutes:absoluteCap,capKm:absoluteCap/(sp.easy/60)};
}
function interval(p,sp,index,slot,budget,shortened=false){
 let rep=Number(p.goalDistance)>20?(slot?4:8):(Number(p.goalDistance)===5?(slot?2:4):(slot?3:6));
 if(shortened)rep=Math.min(rep,3);
 const maxWork=shortened?12:((index<2)?24:30);
 const workTarget=Math.min(maxWork,budget);
 if(workTarget<8)return null;
 if(workTarget<rep*2)rep=Math.min(rep,3);
 const reps=Math.max(2,Math.floor(workTarget/rep));
 const rest=rep<=3?30:60,warm=12,cool=8;
 const work=reps*rep,rests=(reps-1)*rest/60;
 const duration=warm+work+rests+cool;
 if(duration>Number(p.maxMinutes))return interval(p,sp,index,slot,Math.max(0,budget-3),shortened);
 return {type:'threshold',zone:3,title:`${reps} \u00d7 ${rep} min kontrollert`,minutes:round(duration),km:round(work/(sp.controlled/60)+(warm+cool+rests)/(sp.easy/60)),workMinutes:work,reps,repMinutes:rep,restSeconds:rest,warmMinutes:warm,coolMinutes:cool,paceFast:sp.controlledFast,paceSlow:sp.controlledSlow,effort:'4\u20136 av 10',intensity:'Kontrollert, under eller n\u00e6r egen terskel. Korte setninger skal v\u00e6re mulig. Reduser farten n\u00e5r signalene spriker.'};
}
function generate(p,now=today(),id='p'+Date.now()){
 const errors=validate(p,now);if(errors.length)throw new Error(errors.join('\n'));
 p=JSON.parse(JSON.stringify(p));
 p.startWeekKm=Number(p.startWeekKm??0);p.startWeekThreshold=Number(p.startWeekThreshold??0);p.startWeekLongDone=!!p.startWeekLongDone;
 const sp=speeds(p),firstWeek=monday(p.startDate),lastWeek=p.goalMode==='time'?monday(p.raceDate):addDays(firstWeek,(Number(p.weeks)-1)*7);
 const count=Math.floor(difference(lastWeek,firstWeek)/7)+1;
 const weeks=[];let buildStep=0;
 for(let i=0;i<count;i++){
  const start=addDays(firstWeek,i*7),end=addDays(start,6),raceWeek=p.goalMode==='time'&&p.raceDate>=start&&p.raceDate<=end;
  const partialStart=i===0&&p.startDate>start;
  const daysToRace=p.goalMode==='time'?difference(p.raceDate,end):999;
  const deload=i%4===3&&!raceWeek&&daysToRace>7;
  if(i>0&&!deload&&daysToRace>7)buildStep++;
  const ceiling=p.growth?Math.min(Number(p.maxKm),Number(p.baseKm)*1.2):Number(p.baseKm);
  const base=p.growth?Math.min(ceiling,Number(p.baseKm)*(1+Math.min(buildStep,8)*0.03)):Number(p.baseKm);
  let factor=i===0?0.95:1;
  if(deload)factor=0.8;
  if(daysToRace>=0&&daysToRace<7&&!raceWeek)factor=Math.min(factor,0.7);
  if(raceWeek)factor=0.4;
  const fullTarget=base*factor;
  const candidates=p.days.filter(d=>{const at=addDays(start,d);if(i===0&&at<p.startDate)return false;if(raceWeek&&at>=p.raceDate)return false;return true;});
  const priorKm=partialStart?p.startWeekKm:0,priorThreshold=partialStart?p.startWeekThreshold:0,priorLong=partialStart&&p.startWeekLongDone;
  const partialCap=partialStart&&p.days.length?fullTarget*(candidates.length/p.days.length):fullTarget;
  const target=partialStart?Math.max(0,Math.min(partialCap,fullTarget-priorKm)):fullTarget;
  let qCount=doseCount(p);
  if(p.thresholdHabit===0&&i>=2&&Number(p.baseKm)>=25)qCount=1;
  if(raceWeek)qCount=Math.min(qCount,1);
  qCount=Math.max(0,qCount-priorThreshold);
  const longDay=Number(p.longDay),longDate=addDays(start,longDay);
  const longAvailable=candidates.includes(longDay)&&!priorLong&&!(p.goalMode==='time'&&difference(p.raceDate,longDate)<=7);
  // A short remaining week must leave room for the longer run and at least one non-quality day.
  qCount=Math.min(qCount,Math.max(0,candidates.length-(longAvailable?2:1)));
  const longForQuality=priorLong?-1:longDay;
  const qDays=qualityDays(candidates,longForQuality,qCount).filter(d=>p.goalMode!=='time'||difference(p.raceDate,addDays(start,d))>=4);
  const sessions=[],longPlan=longRunTarget(p,sp,fullTarget,buildStep,deload);
  const totalTimeEstimate=target*sp.easy/60;
  const perWork=Math.min(30,totalTimeEstimate*0.18/Math.max(1,qDays.length));
  for(const d of candidates){
   const at=addDays(start,d),qSlot=qDays.indexOf(d);
   let s=qSlot>=0?interval(p,sp,i,qSlot,Math.min(perWork*(deload?0.8:1),p.thresholdHabit===0?Math.min(20,12+2*Math.floor((i-2)/2)):999),raceWeek):null;
   if(!s){
    const nearRace=p.goalMode==='time'&&difference(p.raceDate,at)<=7;
    const isLong=d===longDay&&!nearRace&&!priorLong;
    const maxMin=isLong?longPlan.capMinutes:Math.min(Number(p.maxMinutes),nearRace?40:Number(p.maxMinutes));
    s={type:isLong?'long':'easy',zone:1,title:isLong?'Lengre rolig tur':'Rolig l\u00f8ping',minutes:0,km:0,workMinutes:0,capKm:maxMin/(sp.easy/60),desiredKm:isLong?longPlan.km:0,weight:1,paceFast:sp.easyFast,paceSlow:sp.easySlow,effort:'2\u20133 av 10',intensity:'Lett pratetempo. Du skal kunne snakke i hele setninger. Farten er bare et startanslag.'};
   }
   s.date=at;s.id=`${id}-${at}`;sessions.push(s);
  }
  let thresholds=sessions.filter(s=>s.type==='threshold');
  let fixed=thresholds.reduce((a,s)=>a+s.km,0);
  const longSession=sessions.find(s=>s.type==='long');
  const desiredLongKm=longSession?Math.min(longSession.desiredKm,longSession.capKm,target):0;
  // Protect the longer run before quality mileage. In a compressed week, remove the last threshold session first.
  while(longSession&&thresholds.length&&fixed+desiredLongKm>target){
   const s=thresholds.pop();fixed-=s.km;
   const nearRace=p.goalMode==='time'&&difference(p.raceDate,s.date)<=7;
   s.type='easy';s.zone=1;s.title='Rolig l\u00f8ping';s.minutes=0;s.km=0;s.workMinutes=0;s.capKm=Math.min(Number(p.maxMinutes),nearRace?40:Number(p.maxMinutes))/(sp.easy/60);s.desiredKm=0;s.weight=1;s.paceFast=sp.easyFast;s.paceSlow=sp.easySlow;s.effort='2\u20133 av 10';s.intensity='Lett pratetempo. Du skal kunne snakke i hele setninger. Farten er bare et startanslag.';
   delete s.reps;delete s.repMinutes;delete s.restSeconds;delete s.warmMinutes;delete s.coolMinutes;
  }
  let remaining=Math.max(0,target-fixed);
  if(longSession){longSession.km=Math.min(desiredLongKm,remaining);remaining=Math.max(0,remaining-longSession.km);}
  let free=sessions.filter(s=>s.type!=='threshold'&&s!==longSession);
  // Allocate what remains across ordinary easy runs. Hard time caps are respected and unused mileage is not forced.
  for(let pass=0;pass<8&&free.length&&remaining>0;pass++){
   const weight=free.reduce((a,s)=>a+s.weight,0),toCap=free.filter(s=>remaining*s.weight/weight>s.capKm);
   if(!toCap.length){free.forEach(s=>{s.km=remaining*s.weight/weight;});remaining=0;break;}
   toCap.forEach(s=>{s.km=s.capKm;remaining=Math.max(0,remaining-s.km);});
   free=free.filter(s=>!toCap.includes(s));
  }
  // If the other easy runs hit their time caps, the longer run may absorb remaining mileage up to its own cap.
  if(longSession&&remaining>0){const add=Math.min(remaining,Math.max(0,longSession.capKm-longSession.km));longSession.km+=add;remaining-=add;}
  for(const s of sessions){if(s.type!=='threshold'){
   s.km=Math.min(round(s.km),Math.floor(s.capKm*10)/10);const rawEasyMinutes=s.km*sp.easy/60;s.minutes=rawEasyMinutes>=20?Math.min(Math.round(s.capKm*sp.easy/60),Math.max(5,Math.round(rawEasyMinutes/5)*5)):Math.round(rawEasyMinutes);
   if(s.type==='long'){
    const minLongMinutes=Math.min(60,Math.max(40,Number(p.recentLongMinutes)*(deload?0.6:0.7)));
    const minLongKm=Math.max(6,Math.min(10,fullTarget*0.18));
    if(s.minutes<minLongMinutes||s.km<minLongKm){s.type='easy';s.title='Rolig l\u00f8ping';s.intensity+=' Denne uka er \u00f8kten for kort til \u00e5 regnes som den lengre turen.';}
   }
   if(p.strides&&s.type==='easy'&&s.minutes>=30&&difference(p.goalMode==='time'?p.raceDate:addDays(end,100),s.date)>3&&i%2===0&&s.date===addDays(start,5)){
    s.strides=true;s.title='Rolig + 4 stigningsl\u00f8p';
    s.intensity+=' Mot slutten: 4 \u00d7 15 sek avslappet raskt, 75 sek rolig mellom. Inng\u00e5r i total tid; ikke sprint.';
   }
   if(s.minutes<1){s.type='rest';s.title='Hvile';s.minutes=0;s.km=0;s.strides=false;}
   delete s.capKm;delete s.desiredKm;delete s.weight;
  }}
  if(raceWeek){
   const raceSec=parseTime(p.goalTime),raceWarm=Number(p.goalDistance)>20?8:12,raceCool=8;
   sessions.push({id:`${id}-${p.raceDate}`,date:p.raceDate,type:'race',zone:null,title:Number(p.goalDistance)>20?'Halvmaraton':`${p.goalDistance} km \u2013 m\u00e5ll\u00f8pet`,minutes:round(raceSec/60+raceWarm+raceCool),km:round(Number(p.goalDistance)+(raceWarm+raceCool)/(sp.easy/60)),raceKm:Number(p.goalDistance),workMinutes:raceSec/60,warmMinutes:raceWarm,coolMinutes:raceCool,paceFast:sp.goalPace,paceSlow:sp.goalPace,effort:'Konkurranse',intensity:'M\u00e5lfarten er en ambisjon, ikke en vurdering av hva du er klar for. Tilpass disponeringen til form og forhold.'});
  }
  sessions.sort((a,b)=>a.date.localeCompare(b.date));
  const phase=raceWeek?'Konkurranseuke':partialStart?'Kort startuke':deload?'Lettere uke':daysToRace<=21?'Konkurranseforberedelse':i<Math.ceil(count*.4)?'Grunnlag':'Kontinuitet';
  const week={index:i,start,end,phase,targetKm:round(target),fullWeekTargetKm:round(fullTarget),partialStart,planStart:i===0?p.startDate:start,priorKm:round(priorKm),priorThreshold,priorLong,sessions,adjustment:null};
  summarize(week);
  week.warning=(!raceWeek&&week.km<target-1)?`Tidsrammen gir ca. ${week.km.toFixed(1).replace('.',',')} km, under mengderammen. Ingen ekstra \u00f8kter er lagt til.`:'';
  weeks.push(week);
 }
 return {id,engineVersion:'1.3',createdAt:new Date().toISOString(),profile:p,weeks,speeds:sp};
}
function summarize(week){week.km=round(week.sessions.reduce((a,s)=>a+s.km,0));week.minutes=Math.round(week.sessions.reduce((a,s)=>a+s.minutes,0));week.workMinutes=round(week.sessions.filter(s=>s.type==='threshold').reduce((a,s)=>a+s.workMinutes,0));week.qualityCount=week.sessions.filter(s=>['threshold','race'].includes(s.type)).length;week.easyPercent=week.minutes?Math.round((1-week.sessions.filter(s=>s.type==='threshold'||s.type==='race').reduce((a,s)=>a+s.workMinutes,0)/week.minutes)*100):100;return week;}
function review(plan,logs,index,now=today()){
 const week=plan.weeks[index];if(!week)return {kind:'none',title:'Velg en uke',text:'Ingen uke er valgt.',canApply:false};
 const prevStart=addDays(week.start,-7),prevEnd=addDays(week.start,-1);
 const data=logs.filter(l=>l.date>=prevStart&&l.date<=prevEnd&&l.date<=now);
 const recent=logs.filter(l=>l.date>=addDays(now,-6)&&l.date<=now);
 const flags=[...data,...recent];
 if(week.start<=now)return {kind:'none',title:'Vurder en kommende uke',text:'Ukesjekken endrer bare framtidige uker. Tidligere \u00f8kter og historikk bevares.',canApply:false};
 if(flags.some(l=>['pain','sick'].includes(l.feeling)))return {kind:'pause',title:'Sett treningen p\u00e5 pause',text:'Du har registrert sykdom eller smerter. Appen kan ikke avgj\u00f8re om du er klar for trening. Planen kan settes p\u00e5 pause; avklar returen individuelt.',canApply:true};
 if(prevEnd>now)return {kind:'none',title:'Uken f\u00f8r er ikke ferdig',text:'Vurder neste uke etter at den foreg\u00e5ende uken er avsluttet. Ingen automatisk \u00f8kning blir vedtatt her.',canApply:false};
 const completed=data.filter(l=>l.status==='done');
 if(completed.length<2)return {kind:'none',title:'For lite logget til \u00e5 vurdere',text:'Minst to gjennomf\u00f8rte \u00f8kter fra uken f\u00f8r trengs. Planlagte \u00f8kter regnes aldri som gjennomf\u00f8rt trening.',canApply:false};
 const prev=plan.weeks[index-1],doneKm=completed.reduce((a,l)=>a+l.km,0),expected=prev?prev.km:Number(plan.profile.baseKm);
 const hard=completed.some(l=>l.type==='threshold'&&l.rpe>=8);
 const tired=completed.filter(l=>l.feeling==='tired').length>=2;
 const cap=Number(plan.profile.lactateCap);
 const elevated=plan.profile.control==='lactate'&&cap>0&&completed.some(l=>l.type==='threshold'&&l.samples?.some(s=>s.lactate>cap));
 if(hard||tired||elevated||doneKm<expected*.7)return {kind:'reduce',title:'Forslag: en roligere uke',text:`Du logget ${round(doneKm)} av ca. ${expected} km${hard?', med en uvanlig hard terskel\u00f8kt':''}${tired?' og flere tunge dager':''}${elevated?' og laktat over din valgte grense':''}. Reduser neste uke omtrent 20 % og behold h\u00f8yst \u00e9n kontrollert \u00f8kt. Ikke ta igjen tapte kilometer.`,canApply:true};
 return {kind:'keep',title:'Behold planen \u2013 ingen farts\u00f8kning',text:'Loggen gir ikke et tydelig signal om \u00e5 redusere. Dette er ikke en vurdering av skadefare eller m\u00e5lsjanse. Oppdater treningsfarten bare etter et nytt, representativt formgrunnlag.',canApply:false};
}
function adjustWeek(week,kind){
 if(week.adjustment)throw new Error('Denne uken er allerede justert.');
 if(!['reduce','pause'].includes(kind))throw new Error('Ugyldig justering.');
 const out=JSON.parse(JSON.stringify(week));let keptQuality=false;
 for(const s of out.sessions){
  if(kind==='pause'){s.type='rest';s.title='Pause \u2013 avklar retur';s.km=0;s.minutes=0;s.workMinutes=0;s.strides=false;continue;}
  if(s.type==='race')continue;
  if(s.type==='threshold'&&!keptQuality){
   keptQuality=true;const previous=s.workMinutes;const reps=Math.max(2,Math.floor(s.reps*.7));s.reps=reps;s.workMinutes=reps*s.repMinutes;
   const factor=s.workMinutes/previous;
   s.minutes=round(s.warmMinutes+s.coolMinutes+s.workMinutes+(reps-1)*s.restSeconds/60);
   s.km=round(s.km*(0.4+0.6*factor));s.title=`${reps} \u00d7 ${s.repMinutes} min kontrollert`;
  }else{
   s.minutes=Math.round(s.minutes*.8);s.km=round(s.km*.8);s.workMinutes=0;s.strides=false;
   if(s.type==='threshold'){s.type='easy';s.zone=1;s.title='Kort, rolig tur';s.paceFast=undefined;s.paceSlow=undefined;s.intensity='Kun lett pratetempo. Erstatter en planlagt kontrollert \u00f8kt.';s.effort='2\u20133 av 10';}
  }
 }
 out.adjustment=kind;out.warning=kind==='pause'?'Uken er satt p\u00e5 pause, ogs\u00e5 en eventuell konkurranse i planen. Avklar retur individuelt. Ingen p\u00e5melding er avlyst.':'Uken er nedjustert. Uendret treningsfart; ingen innhenting av tapte \u00f8kter.';
 return summarize(out);
}
const API={date,iso,addDays,difference,monday,today,parseTime,time,pace,validDate,defaults,validate,hrZones,speeds,qualityDays,doseCount,longRunTarget,generate,summarize,review,adjustWeek,round,clamp};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
root.RunEngine=API;
})(typeof window!=='undefined'?window:globalThis);
