
// IndexedDB helpers
const DB_NAME="points_tracker_db"; const DB_VER=3; let db;
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VER);
  r.onupgradeneeded=e=>{const d=e.target.result;
    if(!d.objectStoreNames.contains('settings')) d.createObjectStore('settings',{keyPath:'key'});
    if(!d.objectStoreNames.contains('days')) d.createObjectStore('days',{keyPath:'date'});
    if(!d.objectStoreNames.contains('recipes')) d.createObjectStore('recipes',{keyPath:'id'});
    if(!d.objectStoreNames.contains('weights')) d.createObjectStore('weights',{keyPath:'date'});
    if(!d.objectStoreNames.contains('measures')) d.createObjectStore('measures',{keyPath:'date'});
    if(!d.objectStoreNames.contains('exercises')) d.createObjectStore('exercises',{keyPath:'id'});
    if(!d.objectStoreNames.contains('barcodes')) d.createObjectStore('barcodes',{keyPath:'code'});
    if(!d.objectStoreNames.contains('habits')) d.createObjectStore('habits',{keyPath:'date'});
    if(!d.objectStoreNames.contains('steps')) d.createObjectStore('steps',{keyPath:'date'});
  };
  r.onsuccess=()=>{db=r.result; resolve(db)}; r.onerror=()=>reject(r.error);});}
function put(s,v){return new Promise((res,rej)=>{const t=db.transaction(s,'readwrite'); t.objectStore(s).put(v); t.oncomplete=()=>res(); t.onerror=()=>rej(t.error);});}
function get(s,k){return new Promise((res,rej)=>{const t=db.transaction(s,'readonly'); const g=t.objectStore(s).get(k); g.onsuccess=()=>res(g.result); g.onerror=()=>rej(g.error);});}
function all(s){return new Promise((res,rej)=>{const t=db.transaction(s,'readonly'); const g=t.objectStore(s).getAll(); g.onsuccess=()=>res(g.result); g.onerror=()=>rej(g.error);});}
function del(s,k){return new Promise((res,rej)=>{const t=db.transaction(s,'readwrite'); t.objectStore(s).delete(k); t.oncomplete=()=>res(); t.onerror=()=>rej(t.error);});}

// Tabs
const tabs=document.querySelectorAll('.tabs button');
tabs.forEach(b=>b.addEventListener('click',()=>{
  tabs.forEach(x=>x.classList.remove('active')); b.classList.add('active');
  const n=b.dataset.tab;
  document.querySelectorAll('.tab').forEach(s=>s.classList.add('hidden'));
  const sec=document.getElementById('tab-'+n); if(sec) sec.classList.remove('hidden');
  if(n==='analysis'){ if(typeof refreshAnalysis==='function') refreshAnalysis(); if(typeof refreshCharts==='function') refreshCharts(); }
  if(n==='habits'){ if(typeof refreshHabitStreaks==='function') refreshHabitStreaks(); }
}));

// Settings: coefficients
const coefIds=['coef-intercept','coef-a','coef-b','coef-c','coef-d','coef-e','coef-f','coef-g']; const roundingSel=document.getElementById('rounding');
document.getElementById('save-coefs').addEventListener('click',async()=>{const obj={key:'coeffs'}; coefIds.forEach(id=>obj[id]=parseFloat(document.getElementById(id).value||'0')); obj.rounding=roundingSel.value; await put('settings',obj); alert('Saved coefficients.');});
document.getElementById('reset-data').addEventListener('click',async()=>{ if(!confirm('Erase all local data?')) return; indexedDB.deleteDatabase(DB_NAME); location.reload(); });

// Export / Import
async function exportAll(){ const stores=['settings','days','recipes','weights','measures','exercises','barcodes','habits','steps']; const data={}; for (const s of stores){ data[s]=await all(s); } const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),data},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='pointsplus_backup.json'; document.body.appendChild(a); a.click(); a.remove(); }
async function importAll(file){ const text=await file.text(); const obj=JSON.parse(text); const data=obj.data||{}; for (const [store,rows] of Object.entries(data)){ if(!Array.isArray(rows)) continue; for (const row of rows){ await put(store,row); } } alert('Import complete.'); await refreshLib(); await loadRecipes(); await loadExercises(); await loadWeights(); await loadMeasures(); await loadToday(); await loadSteps(); await loadHabits(); await refreshAnalysis(); await refreshCharts(); }
document.getElementById('btn-export').addEventListener('click', exportAll);
document.getElementById('btn-import').addEventListener('click', async ()=>{ const inp=document.getElementById('file-import'); if(!inp.files||!inp.files[0]){ alert('Choose a JSON file first.'); return; } await importAll(inp.files[0]); });

// Calculator
function calcPoints(n, c){const v=k=>parseFloat(n[k]||0), cc=k=>parseFloat((c||{})[k]||0); let raw=cc('coef-intercept')+cc('coef-a')*v('cals')+cc('coef-b')*v('fat')+cc('coef-c')*v('satfat')+cc('coef-d')*v('sugar')+cc('coef-e')*v('protein')+cc('coef-f')*v('carbs')+cc('coef-g')*v('fiber'); let rounded=raw; const m=(c||{}).rounding||'NEAREST'; if(m==='UP') rounded=Math.ceil(raw); else if(m==='DOWN') rounded=Math.floor(raw); else rounded=Math.round(raw); return Math.max(0,rounded);}
document.getElementById('btn-calc').addEventListener('click',async()=>{const c=await get('settings','coeffs')||{}; const n={cals:document.getElementById('cals').value,fat:document.getElementById('fat').value,satfat:document.getElementById('satfat').value,sugar:document.getElementById('sugar').value,protein:document.getElementById('protein').value,carbs:document.getElementById('carbs').value,fiber:document.getElementById('fiber').value}; const serv=parseFloat(document.getElementById('servings').value||'1'); const pts=calcPoints(n,c); document.getElementById('calc-result').textContent=(pts/Math.max(1,serv)).toFixed(0);});

// Today (meals)
const defaultMeals=['Breakfast','Lunch','Dinner','Snack']; const mealsDiv=document.getElementById('meals'); const todayDate=document.getElementById('today-date'); const targetInput=document.getElementById('daily-target'); const todayTotal=document.getElementById('today-total'); const todayRemaining=document.getElementById('today-remaining');
function mealRow(meal,item={}){const wrap=document.createElement('div'); wrap.className='row'; wrap.innerHTML=`<div class="col"><label>${meal} - Food</label><input data-k="name" value="${item.name||''}"></div><div class="col"><label>Points</label><input data-k="points" type="number" step="1" value="${item.points||0}"></div><div class="col"><label></label><button class="ghost remove-item">Remove</button></div>`; wrap.querySelector('.remove-item').addEventListener('click',()=>{wrap.remove();updateTodayTotals();saveToday();}); return wrap;}
function renderMeals(day){mealsDiv.innerHTML=''; const data=day.items||[]; const byMeal={}; defaultMeals.forEach(m=>byMeal[m]=[]); data.forEach(it=>{byMeal[it.meal]=byMeal[it.meal]||[]; byMeal[it.meal].push(it);}); defaultMeals.forEach(meal=>{const card=document.createElement('div'); card.className='card'; card.innerHTML=`<h3>${meal}</h3><div class="meal-items"></div><button class="ghost add-item">+ Add ${meal} Item</button>`; const holder=card.querySelector('.meal-items'); (byMeal[meal]||[]).forEach(it=>holder.appendChild(mealRow(meal,it))); card.querySelector('.add-item').addEventListener('click',()=>{holder.appendChild(mealRow(meal,{name:'',points:0}));}); mealsDiv.appendChild(card);});}
function readMealsUI(){const items=[]; document.querySelectorAll('#meals .card').forEach(card=>{const meal=card.querySelector('h3').textContent; card.querySelectorAll('.row').forEach(r=>{const name=r.querySelector('input[data-k="name"]').value.trim(); const pts=parseFloat(r.querySelector('input[data-k="points"]').value||'0'); if(name||pts) items.push({meal,name,points:pts});});}); return items;}
async function updateTodayTotals(){
  const items=readMealsUI();
  const total=items.reduce((s,x)=>s+(x.points||0),0);
  todayTotal.textContent=total.toFixed(0);
  const prof = await getProfile();
  const allowance = calcAllowanceFrom(prof||{});
  let target = parseFloat(targetInput.value||'0')||0;
  if(!target){ target = allowance; targetInput.value = allowance; }
  const date = todayDate.value;
  const ap = await activityPointsOn(date);
  const apLbl = document.getElementById('ap-today-label'); if(apLbl) apLbl.textContent = 'Activity Points Today: '+ap;
  todayRemaining.textContent = 'Remaining: ' + ((target + ap) - total).toFixed(0);
  const wb = await bankForWeek(date); const bankEl = document.getElementById('weekly-bank'); if(bankEl) bankEl.textContent = `Weekly Bank: ${wb.remaining.toFixed(0)} (Start ${wb.weeklyStart} + AP ${wb.apSum} − Over ${wb.usedOver})`;
}
async function saveToday(){const date=todayDate.value; if(!date) return; await put('days',{date,target:parseFloat(targetInput.value||'0')||0,items:readMealsUI()});}
async function loadToday(){const date=todayDate.value; if(!date) return; const day=(await get('days',date))||{date,target:0,items:[]}; targetInput.value=day.target||''; renderMeals(day); await updateTodayTotals();}
document.getElementById('add-snack').addEventListener('click',()=>{document.querySelectorAll('#meals .card').forEach(c=>{if(c.querySelector('h3').textContent==='Snack'){c.querySelector('.meal-items').appendChild(mealRow('Snack',{name:'',points:0}));}});});
document.getElementById('quick-add').addEventListener('click',()=>{const pts=parseFloat(prompt('Quick add points:','0')||'0'); if(isNaN(pts))return; document.querySelectorAll('#meals .card').forEach(c=>{if(c.querySelector('h3').textContent==='Snack'){c.querySelector('.meal-items').appendChild(mealRow('Snack',{name:'Quick Add',points:pts}));}}); updateTodayTotals();});
todayDate.addEventListener('change', async ()=>{ await loadToday(); await loadSteps(); });
mealsDiv.addEventListener('input',(e)=>{ if(e.target.tagName==='INPUT'){ updateTodayTotals(); saveToday(); }});
targetInput.addEventListener('input',()=>{ updateTodayTotals(); saveToday(); });

// Barcode scanner (with fallback)
const startBtn=document.getElementById('start-scan'); const stopBtn=document.getElementById('stop-scan'); const video=document.getElementById('video'); const frame=document.getElementById('frame'); const codeInput=document.getElementById('detected-code'); let stream,detector,rafId;
async function startScan(){ if(!('BarcodeDetector' in window)){ const help=document.getElementById('scanner-help'); if(help) help.innerHTML = 'This browser does not support live scanning. Enter digits or add foods in Settings → Barcode Library.'; alert("Your browser doesn't support live barcode scanning. Manual entry is available."); return; } detector=new BarcodeDetector({formats:['ean_13','upc_a','upc_e','ean_8','code_128']}); stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}); video.srcObject=stream; video.classList.remove('hidden'); const ctx=frame.getContext('2d'); async function tick(){ if(video.readyState>=2){ frame.width=video.videoWidth; frame.height=video.videoHeight; ctx.drawImage(video,0,0,frame.width,frame.height); try{ const codes=await detector.detect(frame); if(codes&&codes[0]){ codeInput.value=codes[0].rawValue; stopScan(); } }catch(e){} } rafId=requestAnimationFrame(tick);} tick();}
function stopScan(){ if(rafId) cancelAnimationFrame(rafId); if(stream){stream.getTracks().forEach(t=>t.stop()); stream=null;} video.classList.add('hidden');}
startBtn.addEventListener('click',startScan); stopBtn.addEventListener('click',stopScan);
document.getElementById('lookup-code').addEventListener('click',async()=>{const code=codeInput.value.trim(); if(!code) return; const rec=await get('barcodes',code); if(rec){ const c=await get('settings','coeffs')||{}; const pts=calcPoints(rec.food,c); document.querySelectorAll('#meals .card').forEach(ca=>{if(ca.querySelector('h3').textContent==='Snack'){ca.querySelector('.meal-items').appendChild(mealRow('Snack',{name:rec.food.name||('Item '+code),points:pts}));}}); updateTodayTotals(); } else { alert('Not in local library. Add it in Settings → Barcode Library.'); }});

// Barcode library
async function refreshLib(){const rows=await all('barcodes'); const tbody=document.querySelector('#lib-table tbody'); tbody.innerHTML=''; rows.forEach(r=>{const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.code}</td><td>${r.food.name||''}</td><td><button data-del='${r.code}' class='ghost'>Delete</button></td>`; tbody.appendChild(tr);}); tbody.querySelectorAll('button[data-del]').forEach(b=>b.addEventListener('click',async()=>{await del('barcodes',b.dataset.del); refreshLib();}));}
document.getElementById('lib-save').addEventListener('click',async()=>{const v=id=>document.getElementById(id).value; const code=v('lib-code').trim(); if(!code){alert('Enter barcode');return;} const food={name:v('lib-name'),cals:parseFloat(v('lib-cals')||'0'),fat:parseFloat(v('lib-fat')||'0'),satfat:parseFloat(v('lib-satfat')||'0'),sugar:parseFloat(v('lib-sugar')||'0'),protein:parseFloat(v('lib-protein')||'0'),carbs:parseFloat(v('lib-carbs')||'0'),fiber:parseFloat(v('lib-fiber')||'0')}; await put('barcodes',{code,food}); refreshLib();});

// Recipes
function addIngRow(tb,ing={name:'',cals:0,fat:0,satfat:0,sugar:0,protein:0,carbs:0,fiber:0}){const tr=document.createElement('tr'); tr.innerHTML=`<td><input data-k="name" value="${ing.name}"/></td><td><input data-k="cals" type="number" step="0.01" value="${ing.cals}"/></td><td><input data-k="fat" type="number" step="0.01" value="${ing.fat}"/></td><td><input data-k="satfat" type="number" step="0.01" value="${ing.satfat}"/></td><td><input data-k="sugar" type="number" step="0.01" value="${ing.sugar}"/></td><td><input data-k="protein" type="number" step="0.01" value="${ing.protein}"/></td><td><input data-k="carbs" type="number" step="0.01" value="${ing.carbs}"/></td><td><input data-k="fiber" type="number" step="0.01" value="${ing.fiber}"/></td><td><button class="ghost del">X</button></td>`; tr.querySelector('.del').addEventListener('click',()=>tr.remove()); tb.appendChild(tr);}
document.getElementById('add-ing').addEventListener('click',()=>addIngRow(document.querySelector('#r-ings tbody')));
document.getElementById('r-ings').addEventListener('input',recomputeRecipe);
document.getElementById('r-servings').addEventListener('input',recomputeRecipe);
async function recomputeRecipe(){const c=await get('settings','coeffs')||{}; const tb=document.querySelector('#r-ings tbody'); let t={cals:0,fat:0,satfat:0,sugar:0,protein:0,carbs:0,fiber:0}; tb.querySelectorAll('tr').forEach(tr=>{const v=k=>parseFloat(tr.querySelector(`input[data-k="${k}"]`).value||'0'); t.cals+=v('cals');t.fat+=v('fat');t.satfat+=v('satfat');t.sugar+=v('sugar');t.protein+=v('protein');t.carbs+=v('carbs');t.fiber+=v('fiber');}); const pts=calcPoints(t,c); document.getElementById('r-total').textContent=pts.toFixed(0); const serv=parseFloat(document.getElementById('r-servings').value||'1'); document.getElementById('r-per').textContent=(pts/Math.max(1,serv)).toFixed(0);}
document.getElementById('save-recipe').addEventListener('click',async()=>{const name=document.getElementById('r-name').value.trim(); if(!name){alert('Name your recipe');return;} const serv=parseFloat(document.getElementById('r-servings').value||'1'); const tb=document.querySelector('#r-ings tbody'); const ings=[]; tb.querySelectorAll('tr').forEach(tr=>{const v=k=>tr.querySelector(`input[data-k="${k}"]`).value; ings.push({name:v('name'),cals:parseFloat(v('cals')||'0'),fat:parseFloat(v('fat')||'0'),satfat:parseFloat(v('satfat')||'0'),sugar:parseFloat(v('sugar')||'0'),protein:parseFloat(v('protein')||'0'),carbs:parseFloat(v('carbs')||'0'),fiber:parseFloat(v('fiber')||'0')});}); const id=Date.now().toString(); await put('recipes',{id,name,serv:serv,ings}); loadRecipes(); alert('Recipe saved.');});
async function loadRecipes(){const tbody=document.querySelector('#recipes-table tbody'); const rows=await all('recipes'); tbody.innerHTML=''; for(const r of rows){ const c=await get('settings','coeffs')||{}; const t=r.ings.reduce((t,x)=>({cals:t.cals+x.cals,fat:t.fat+x.fat,satfat:t.satfat+x.satfat,sugar:t.sugar+x.sugar,protein:t.protein+x.protein,carbs:t.carbs+x.carbs,fiber:t.fiber+x.fiber}),{cals:0,fat:0,satfat:0,sugar:0,protein:0,carbs:0,fiber:0}); const pts=calcPoints(t,c); const per=pts/Math.max(1,r.serv); const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.name}</td><td>${r.serv}</td><td>${per.toFixed(0)}</td><td><button data-id="${r.id}" class="ghost del-rec">Delete</button></td>`; tbody.appendChild(tr);} tbody.querySelectorAll('.del-rec').forEach(b=>b.addEventListener('click',async()=>{await del('recipes',b.dataset.id); loadRecipes();}));}

// Exercise: walking
async function saveWalk(){const id='w_'+Date.now(); await put('exercises',{id,date:document.getElementById('w-date').value,type:'walk',data:{minutes:parseFloat(document.getElementById('w-min').value||'0'),distance:parseFloat(document.getElementById('w-dist').value||'0'),notes:document.getElementById('w-notes').value}}); loadExercises();}
document.getElementById('save-walk').addEventListener('click',saveWalk);
document.getElementById('clear-walk').addEventListener('click',()=>{['w-date','w-min','w-dist','w-notes'].forEach(id=>document.getElementById(id).value='');});

// Exercise: multi-lift (3 sets + reps)
function addLiftRow(pref={ex:'',s1:false,r1:0,s2:false,r2:0,s3:false,r3:0,weight:0,notes:''}){
  const tb=document.querySelector('#lift-rows tbody');
  const tr=document.createElement('tr');
  tr.innerHTML = `<td><input data-k="ex" value="${pref.ex}"></td>
    <td><input data-k="s1" type="checkbox" ${pref.s1?'checked':''}></td>
    <td><input data-k="r1" type="number" value="${pref.r1}"></td>
    <td><input data-k="s2" type="checkbox" ${pref.s2?'checked':''}></td>
    <td><input data-k="r2" type="number" value="${pref.r2}"></td>
    <td><input data-k="s3" type="checkbox" ${pref.s3?'checked':''}></td>
    <td><input data-k="r3" type="number" value="${pref.r3}"></td>
    <td><input data-k="weight" type="number" step="0.1" value="${pref.weight}"></td>
    <td><input data-k="notes" value="${pref.notes}"></td>
    <td><button class="ghost del">X</button></td>`;
  tr.querySelector('.del').addEventListener('click',()=>tr.remove());
  tb.appendChild(tr);
}
document.getElementById('add-lift-row').addEventListener('click',()=>addLiftRow());
document.getElementById('save-lift-session').addEventListener('click', async ()=>{
  const date=document.getElementById('l-date').value; const snotes=document.getElementById('l-session-notes').value;
  const tb=document.querySelector('#lift-rows tbody'); const rows=[...tb.querySelectorAll('tr')];
  const mins=parseFloat(document.getElementById('l-minutes').value||'0'); const intensity=(document.getElementById('l-intensity').value||'moderate').toLowerCase();
  if(!date){alert('Pick a date');return;} if(rows.length===0){alert('Add at least one exercise');return;}
  for(const tr of rows){
    const gv=k=>tr.querySelector(`input[data-k="${k}"]`); const val=k=>gv(k)?.value; const chk=k=>gv(k)?.checked;
    const r1=parseFloat(val('r1')||'0'), r2=parseFloat(val('r2')||'0'), r3=parseFloat(val('r3')||'0'); const reps=r1+r2+r3;
    const weight=parseFloat(val('weight')||'0');
    await put('exercises',{id:'l_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), date, type:'lift', data:{ex:val('ex'),sets:(chk('s1')+chk('s2')+chk('s3')), reps, weight, set_reps:[r1,r2,r3], notes:(val('notes')||'')+(snotes?(' | '+snotes):'')}});
  }
  if(mins>0){ await put('exercises',{id:'lm_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), date, type:'liftmeta', data:{minutes:mins,intensity:intensity||'moderate'}}); }
  tb.innerHTML=''; document.getElementById('l-session-notes').value=''; document.getElementById('l-minutes').value=''; await loadExercises(); alert('Lifting session saved.');
});

async function loadExercises(){const rows=await all('exercises'); rows.sort((a,b)=>(a.date||'').localeCompare(b.date||'')); const tb=document.querySelector('#ex-table tbody'); tb.innerHTML=''; rows.forEach(r=>{let details=''; if(r.type==='walk'){const d=r.data; details=`${d.minutes||0} min, ${d.distance||0} mi ${d.notes?(' – '+d.notes):''}`;} else if(r.type==='lift'){const d=r.data; details=`${d.ex||''}: ${d.sets||0} sets, ${d.reps||0} reps @ ${d.weight||0}${d.notes?(' – '+d.notes):''}`;} else if(r.type==='liftmeta'){details=`Strength session: ${r.data.minutes||0} min (${r.data.intensity||'moderate'})`;} const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.date||''}</td><td>${r.type}</td><td>${details}</td><td><button class="ghost" data-del="${r.id}">Delete</button></td>`; tb.appendChild(tr);}); tb.querySelectorAll('button[data-del]').forEach(b=>b.addEventListener('click',async()=>{await del('exercises',b.dataset.del); loadExercises();}));}

// Weight
document.getElementById('wt-save').addEventListener('click', async ()=>{const d=document.getElementById('wt-date').value; const v=parseFloat(document.getElementById('wt-value').value||'0'); if(!d) return; await put('weights',{date:d,value:v}); loadWeights();});
async function loadWeights(){const rows=await all('weights'); rows.sort((a,b)=>(a.date||'').localeCompare(b.date||'')); const tb=document.querySelector('#wt-table tbody'); tb.innerHTML=''; let prev=null; rows.forEach(r=>{const delta=(prev!=null)?(r.value-prev).toFixed(1):'—'; const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.date}</td><td>${r.value}</td><td>${delta}</td><td><button class="ghost" data-del="${r.date}">Delete</button></td>`; tb.appendChild(tr); prev=r.value;}); tb.querySelectorAll('button[data-del]').forEach(b=>b.addEventListener('click',async()=>{await del('weights',b.dataset.del); loadWeights();}));}

// Measurements (expanded)
document.getElementById('m-save').addEventListener('click', async ()=>{ const d=document.getElementById('m-date').value; if(!d) return; const obj={date:d, neck:parseFloat(document.getElementById('m-neck').value||'0'), waist:parseFloat(document.getElementById('m-waist').value||'0'), hips:parseFloat(document.getElementById('m-hips').value||'0'), bust:parseFloat(document.getElementById('m-bust').value||'0'), lbicep:parseFloat(document.getElementById('m-lbicep').value||'0'), rbicep:parseFloat(document.getElementById('m-rbicep').value||'0'), lfore:parseFloat(document.getElementById('m-lfore').value||'0'), rfore:parseFloat(document.getElementById('m-rfore').value||'0'), lthigh:parseFloat(document.getElementById('m-lthigh').value||'0'), rthigh:parseFloat(document.getElementById('m-rthigh').value||'0'), lcalf:parseFloat(document.getElementById('m-lcalf').value||'0'), rcalf:parseFloat(document.getElementById('m-rcalf').value||'0') }; await put('measures', obj); loadMeasures(); });
async function loadMeasures(){const rows=await all('measures'); rows.sort((a,b)=>(a.date||'').localeCompare(b.date||'')); const tb=document.querySelector('#m-table tbody'); tb.innerHTML=''; rows.forEach(r=>{const tr=document.createElement('tr'); tr.innerHTML = `<td>${r.date}</td><td>${r.neck||0}</td><td>${r.waist||0}</td><td>${r.hips||0}</td><td>${r.bust||0}</td><td>${r.lbicep||0}</td><td>${r.rbicep||0}</td><td>${r.lfore||0}</td><td>${r.rfore||0}</td><td>${r.lthigh||0}</td><td>${r.rthigh||0}</td><td>${r.lcalf||0}</td><td>${r.rcalf||0}</td><td><button class='ghost' data-del='${r.date}'>Delete</button></td>`; tb.appendChild(tr);}); tb.querySelectorAll('button[data-del]').forEach(b=>b.addEventListener('click', async()=>{ await del('measures', b.dataset.del); loadMeasures(); }));}

// ---- Profile & PointsPlus allowance ----
async function getProfile(){ return (await get('settings','profile')) || {}; }
function inchesFrom(ft,inches){ ft=parseFloat(ft||0); inches=parseFloat(inches||0); return ft*12+inches; }
function ppAgePoints(age){ if(age==null) return 0; if(age<=26) return 4; if(age<=37) return 3; if(age<=47) return 2; return 1; }
function ppGenderPoints(g){ if(g==='male') return 8; if(g==='female') return 2; return 6; }
function ppHeightPoints(inches){ if(inches<61) return 0; if(inches<=70) return 1; return 2; }
function ppActivityPointsBase(level){ if(level==='sedentary') return 0; if(level==='sit') return 2; if(level==='stand') return 4; if(level==='demanding') return 6; return 0; }
function ppWeightPoints(weightLb){ if(!weightLb) return 0; return Math.floor(weightLb/10); }
function calcAllowanceFrom(profile){
  const g=ppGenderPoints(profile.gender||'female');
  const a=ppAgePoints(parseFloat(profile.age||0));
  const h=ppHeightPoints(inchesFrom(profile.h_ft, profile.h_in));
  const w=ppWeightPoints(parseFloat(profile.weight||0));
  const act=ppActivityPointsBase(profile.activity||'sedentary');
  return g+a+h+w+act;
}
async function calcAllowance(){ const prof=await getProfile(); return calcAllowanceFrom(prof); }
async function saveProfile(){
  const obj={ key:'profile',
    gender:document.getElementById('prof-gender').value,
    age:parseFloat(document.getElementById('prof-age').value||'0'),
    h_ft:parseFloat(document.getElementById('prof-h-ft').value||'0'),
    h_in:parseFloat(document.getElementById('prof-h-in').value||'0'),
    weight:parseFloat(document.getElementById('prof-weight').value||'0'),
    goal:parseFloat(document.getElementById('prof-goal').value||'0'),
    activity:document.getElementById('prof-activity').value,
    steps_goal:parseFloat(document.getElementById('prof-steps-goal').value||'0'),
    weekly_start:parseFloat(document.getElementById('prof-weekly-start').value||'49')
  };
  await put('settings', obj);
  const allowance = calcAllowanceFrom(obj);
  document.getElementById('calc-allowance-badge').textContent = 'Allowance: '+allowance;
  const sg=document.getElementById('steps-goal'); if(sg && !sg.value) sg.value = obj.steps_goal||'';
  updateTodayTotals();
}
document.getElementById('save-profile').addEventListener('click', saveProfile);
async function loadProfileToUI(){
  const p = await getProfile();
  if(!p || !p.key) return;
  const set=(id,val)=>{const el=document.getElementById(id); if(el) el.value=(val??'');};
  set('prof-gender', p.gender); set('prof-age', p.age); set('prof-h-ft', p.h_ft); set('prof-h-in', p.h_in);
  set('prof-weight', p.weight); set('prof-goal', p.goal); set('prof-activity', p.activity); set('prof-steps-goal', p.steps_goal);
  const ws=document.getElementById('prof-weekly-start'); if(ws) ws.value = (p.weekly_start ?? 49);
  const allowance = calcAllowanceFrom(p); const b=document.getElementById('calc-allowance-badge'); if(b) b.textContent='Allowance: '+allowance;
}

// ---- Activity PointsPlus (AP) ----
function lbToKg(lb){ return (parseFloat(lb||0))*0.45359237; }
function metForWalkMph(mph){ if(!mph||mph<=0) return 2.5; if(mph<2.5) return 2.8; if(mph<3.0) return 3.0; if(mph<3.5) return 3.3; if(mph<4.0) return 4.3; if(mph<4.5) return 5.0; return 6.3; }
function metForLiftIntensity(inten){ inten=(inten||'moderate').toLowerCase(); if(inten==='light') return 3.5; if(inten==='vigorous') return 6.0; return 5.0; }
function kcalFromMET(MET, kg, minutes){ return (MET * 3.5 * kg / 200.0) * (minutes||0); }
async function latestWeightLb(asOfDate){
  const rows = await all('weights'); rows.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  let candidate = null;
  for(const w of rows){ if(!asOfDate || (w.date<=asOfDate)) candidate = w.value; }
  if(candidate!=null) return candidate;
  const p = await getProfile(); return p.weight || 0;
}
async function activityPointsOn(dateStr){
  const ex = await all('exercises');
  const onDay = ex.filter(r => (r.date===dateStr) && (r.type==='walk' || r.type==='liftmeta'));
  if(onDay.length===0) return 0;
  const weightLb = await latestWeightLb(dateStr); const kg = lbToKg(weightLb);
  let kcal=0;
  for(const r of onDay){
    if(r.type==='walk'){
      const m=r.data.minutes||0, dist=r.data.distance||0;
      const mph = (m>0)? (dist/(m/60.0)) : 0;
      const MET = metForWalkMph(mph);
      kcal += kcalFromMET(MET, kg, m);
    } else if(r.type==='liftmeta'){
      const m=r.data.minutes||0, inten=r.data.intensity||'moderate';
      const MET = metForLiftIntensity(inten);
      kcal += kcalFromMET(MET, kg, m);
    }
  }
  return Math.floor(kcal / 80.0);
}

// Steps
async function saveSteps(){ const d=todayDate.value; if(!d) return; await put('steps',{date:d,count:parseFloat(document.getElementById('steps-today').value||'0'),goal:parseFloat(document.getElementById('steps-goal').value||'0')}); updateStepsUI(); }
['steps-today','steps-goal'].forEach(id=>{ const el=document.getElementById(id); if(el) el.addEventListener('input', saveSteps); });
async function loadSteps(){ const d=todayDate.value; if(!d) return; const rec = await get('steps', d) || {}; const st=document.getElementById('steps-today'); const sg=document.getElementById('steps-goal'); if(st&&!st.value) st.value = rec.count||''; if(sg&&!sg.value) sg.value = (rec.goal||''); updateStepsUI(); }
function updateStepsUI(){ const st=parseFloat(document.getElementById('steps-today').value||'0'); const sg=parseFloat(document.getElementById('steps-goal').value||'0')||0; const pct = sg? Math.min(100, Math.round(100*st/sg)) : 0; const bar=document.getElementById('steps-progress'); if(bar) bar.style.width = pct+'%'; const sum=document.getElementById('steps-summary'); if(sum) sum.textContent = sg? `${st} / ${sg} steps (${pct}%)` : `${st} steps`; }

// Weekly bank
function parseISO(d){ return new Date(d+'T00:00:00'); }
function startOfWeek(dt){ const d=new Date(dt); const day=(d.getDay()+6)%7; d.setDate(d.getDate()-day); d.setHours(0,0,0,0); return d; }
function weekKey(d){ const dt=parseISO(d); const s=startOfWeek(dt); const y=s.getFullYear(); const jan1=new Date(y,0,1); const diff=Math.floor((s-jan1)/(24*3600*1000)); const week=Math.floor(diff/7)+1; return y+'-W'+String(week).padStart(2,'0'); }
function monthKey(d){ const dt=parseISO(d); return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0'); }
function yearKey(d){ const dt=parseISO(d); return ''+dt.getFullYear(); }
function periodKey(d, period){ return period==='weekly'? weekKey(d) : period==='monthly'? monthKey(d) : yearKey(d); }
async function bankForWeek(isoDate){
  const p = await getProfile();
  const weeklyStart = (p && p.weekly_start != null) ? parseFloat(p.weekly_start) : 49;
  const allow = calcAllowanceFrom(p||{});
  const week = weekKey(isoDate);
  const days = await all('days');
  const inWeek = days.filter(d => weekKey(d.date||'') === week);
  let usedOver = 0;
  for(const d of inWeek){
    const tot = (d.items||[]).reduce((s,x)=>s+(x.points||0),0);
    const over = Math.max(0, tot - allow);
    usedOver += over;
  }
  let apSum = 0;
  for(const d of inWeek){
    apSum += await activityPointsOn(d.date);
  }
  const remaining = weeklyStart + apSum - usedOver;
  return {week, weeklyStart, apSum, usedOver, remaining};
}

// Analysis
async function computeAnalysis(period, rangeOpt){
  const ex = await all('exercises'); const wt = await all('weights'); const agg = {};
  function getA(k){ return (agg[k] ||= {workouts:0, walkMin:0, walkMi:0, liftSets:0, liftReps:0, liftVol:0}); }
  ex.forEach(r=>{
    const k = periodKey(r.date||'', period);
    const A = getA(k); A.workouts += 1;
    if(r.type==='walk'){ A.walkMin += (r.data.minutes||0); A.walkMi += (r.data.distance||0); }
    else if(r.type==='lift'){ const s=r.data.sets||0, reps=r.data.reps||0, w=r.data.weight||0; A.liftSets += s; A.liftReps += reps; A.liftVol += reps*w; }
  });
  const wtByP = {}; wt.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  wt.forEach(w=>{ const k=periodKey(w.date,period); wtByP[k]=wtByP[k]||{first:null,last:null}; if(!wtByP[k].first) wtByP[k].first=w.value; wtByP[k].last=w.value; });
  const keys = Object.keys(agg).sort();
  function rowsFor(keysWanted){
    return keysWanted.map(k=>{
      const A = agg[k] || {workouts:0, walkMin:0, walkMi:0, liftSets:0, liftReps:0, liftVol:0};
      const delta = wtByP[k]? (wtByP[k].last - wtByP[k].first) : null;
      return {k, ...A, delta};
    });
  }
  if(rangeOpt==='current'){ const today=new Date().toISOString().slice(0,10); const curKey=periodKey(today,period); return rowsFor([curKey]); }
  const n = (rangeOpt==='last8')? 8 : 12; const lastKeys = keys.slice(-n); return rowsFor(lastKeys);
}
function renderTable(tbodyId, rows, includeDelta){
  const tb = document.querySelector('#'+tbodyId+' tbody'); tb.innerHTML='';
  rows.forEach(r=>{ const tr=document.createElement('tr');
    tr.innerHTML = `<td>${r.k}</td><td>${r.workouts}</td><td>${r.walkMin.toFixed(0)}</td><td>${r.walkMi.toFixed(2)}</td><td>${r.liftSets.toFixed(0)}</td><td>${r.liftReps.toFixed(0)}</td><td>${r.liftVol.toFixed(0)}</td>` + (includeDelta? `<td>${(r.delta==null?'—':r.delta.toFixed(1))}</td>`:''); tb.appendChild(tr);
  });
}
async function refreshAnalysis(){
  const days = await all('days'); const prof = await getProfile(); const allow = calcAllowanceFrom(prof||{});
  let over=0; for(const d of days){ const tot=(d.items||[]).reduce((s,x)=>s+(x.points||0),0); if(tot>allow) over++; }
  const oc=document.getElementById('overage-count'); if(oc) oc.textContent = 'Days Over Allowance: '+over;
  const period=document.getElementById('an-period').value; const rangeOpt=document.getElementById('an-range').value;
  const rows=await computeAnalysis(period, rangeOpt); renderTable('an-summary', rows, true);
  const histRows=await computeAnalysis(period, (rangeOpt==='current'?'last8':rangeOpt)); renderTable('an-history', histRows, false);
  const today=new Date().toISOString().slice(0,10); const wb=await bankForWeek(today); const bs=document.getElementById('bank-summary'); if(bs) bs.textContent = `Weekly Bank (this week): ${wb.remaining.toFixed(0)} (Start ${wb.weeklyStart} + AP ${wb.apSum} − Over ${wb.usedOver})`;
}
document.getElementById('an-period').addEventListener('change', refreshAnalysis);
document.getElementById('an-range').addEventListener('change', refreshAnalysis);

// ---- Habit Streaks ----
function isConsecutive(prevISO, currISO){ const prev = new Date(prevISO+'T00:00:00'); const curr = new Date(currISO+'T00:00:00'); const diff = (curr - prev)/(24*3600*1000); return diff === 1; }
function computeStreaksFromFlags(flagsByDate){ let best=0, cur=0; let lastDate=null; for (const r of flagsByDate){ if (r.ok){ if (lastDate && isConsecutive(lastDate, r.date)) { cur += 1; } else { cur = 1; } if (cur > best) best = cur; lastDate = r.date; } else { lastDate = null; cur = 0; } } return {current: cur, best}; }
async function refreshHabitStreaks(){
  const rows = await all('habits'); rows.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const defLabel1 = rows.length? (rows[rows.length-1].c1_label||'Custom 1') : 'Custom 1';
  const defLabel2 = rows.length? (rows[rows.length-1].c2_label||'Custom 2') : 'Custom 2';
  const habits = [{key:'read',label:'Reading'},{key:'wake',label:'Wake on Time'},{key:'task',label:'On Task'},{key:'hyd',label:'Hydration (any)'},{key:'c1',label:defLabel1},{key:'c2',label:defLabel2}];
  const flags = {}; for (const h of habits) flags[h.key] = [];
  rows.forEach(r=>{ flags.read.push({date:r.date, ok: !!r.read}); flags.wake.push({date:r.date, ok: !!r.wake}); flags.task.push({date:r.date, ok: !!r.task}); flags.hyd.push({date:r.date, ok: (r.hyd||0) > 0}); flags.c1.push({date:r.date, ok: !!r.c1}); flags.c2.push({date:r.date, ok: !!r.c2}); });
  const tb = document.querySelector('#hab-streaks tbody'); if (!tb) return; tb.innerHTML = ''; habits.forEach(h=>{ const st = computeStreaksFromFlags(flags[h.key]||[]); const tr = document.createElement('tr'); tr.innerHTML = `<td>${h.label}</td><td>${st.current}</td><td>${st.best}</td>`; tb.appendChild(tr); });
}
// Habits save/load
document.getElementById('hab-save')?.addEventListener('click', async ()=>{
  const d=document.getElementById('h-date').value;
  if(!d){ alert('Pick a date'); return; }
  const rec={date:d, read:document.getElementById('hab-read').checked, wake:document.getElementById('hab-wake').checked, task:document.getElementById('hab-task').checked, hyd:parseFloat(document.getElementById('hab-hyd').value||'0'), c1_label:document.getElementById('hab-c1-label').value||'', c1:document.getElementById('hab-c1').checked, c2_label:document.getElementById('hab-c2-label').value||'', c2:document.getElementById('hab-c2').checked};
  await put('habits', rec); loadHabits(); refreshHabitStreaks();
});
async function loadHabits(){
  const rows=await all('habits'); rows.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const tb=document.querySelector('#hab-table tbody'); if(!tb) return; tb.innerHTML='';
  rows.forEach(r=>{ const tr=document.createElement('tr'); const c1 = r.c1_label? (r.c1? ('✔ '+r.c1_label):('— '+r.c1_label)) : (r.c1?'✔':'—'); const c2 = r.c2_label? (r.c2? ('✔ '+r.c2_label):('— '+r.c2_label)) : (r.c2?'✔':'—'); tr.innerHTML = `<td>${r.date}</td><td>${r.read?'✔':'—'}</td><td>${r.wake?'✔':'—'}</td><td>${r.task?'✔':'—'}</td><td>${r.hyd||0}</td><td>${c1}</td><td>${c2}</td><td><button class='ghost' data-del='${r.date}'>Delete</button></td>`; tb.appendChild(tr); });
  tb.querySelectorAll('button[data-del]').forEach(b=>b.addEventListener('click', async ()=>{ await del('habits', b.dataset.del); loadHabits(); refreshHabitStreaks(); }));
}

// Charts (simple canvas)
function drawLineChart(canvasId, data, labels){
  const c = document.getElementById(canvasId); if(!c) return;
  const ctx = c.getContext('2d'); const W = c.width, H = c.height, pad = 24;
  ctx.clearRect(0,0,W,H);
  if(!data || data.length===0){ ctx.fillStyle='#94a3b8'; ctx.fillText('No data', 10, 20); return; }
  const minV = Math.min(...data), maxV = Math.max(...data);
  const yMin = minV===maxV ? minV-1 : minV; const yMax = minV===maxV ? maxV+1 : maxV;
  const n = data.length; const x = i => pad + (W-2*pad) * (n===1? 0.5 : (i/(n-1))); const y = v => H - pad - (H-2*pad) * ((v - yMin) / (yMax - yMin || 1));
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; ctx.beginPath(); for(let gy=0; gy<=4; gy++){ const yy = pad + (H-2*pad)*gy/4; ctx.moveTo(pad,yy); ctx.lineTo(W-pad,yy); } ctx.stroke();
  ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.beginPath(); data.forEach((v,i)=>{ const xx=x(i), yy=y(v); if(i===0) ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy); }); ctx.stroke();
  ctx.fillStyle = '#0ea5e9'; data.forEach((v,i)=>{ const xx=x(i), yy=y(v); ctx.beginPath(); ctx.arc(xx,yy,2.5,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle = '#64748b'; ctx.font = '12px system-ui'; if(labels && labels.length){ const step = Math.ceil(labels.length/4); for(let i=0;i<labels.length;i+=step){ ctx.fillText(labels[i], x(i)-8, H-6); } }
}
async function buildWeightSeries(){ const rows = await all('weights'); rows.sort((a,b)=>(a.date||'').localeCompare(b.date||'')); return {data:rows.map(r=>r.value), labels:rows.map(r=>r.date.slice(5))}; }
async function buildWeeklyAPSeries(n=12){
  const days = await all('days'); const map = {}; for(const d of days){ const wk = weekKey(d.date||''); map[wk] = map[wk]||0; map[wk] += await activityPointsOn(d.date); }
  const keys = Object.keys(map).sort(); const last = keys.slice(-n); return {data:last.map(k=>map[k]), labels:last};
}
async function buildWeeklyBankSeries(n=12){
  const days = await all('days'); const keys = [...new Set(days.map(d=>weekKey(d.date||'')))].sort(); const last = keys.slice(-n);
  const data = []; const labels = [];
  for(const wk of last){
    const y = parseInt(wk.slice(0,4),10); const w = parseInt(wk.slice(6),10);
    const jan4 = new Date(y,0,4); const jan4Dow = (jan4.getDay()+6)%7;
    const monday = new Date(jan4); monday.setDate(jan4.getDate() - jan4Dow + (w-1)*7);
    const iso = monday.toISOString().slice(0,10);
    const bank = await bankForWeek(iso); data.push(bank.remaining); labels.push(wk);
  }
  return {data, labels};
}
async function refreshCharts(){ const w = await buildWeightSeries(); drawLineChart('ch-weight', w.data, w.labels); const ap = await buildWeeklyAPSeries(12); drawLineChart('ch-ap', ap.data, ap.labels); const bk = await buildWeeklyBankSeries(12); drawLineChart('ch-bank', bk.data, bk.labels); }

// Init
(async function init(){
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js'); }
  await openDB();
  const today=new Date().toISOString().slice(0,10);
  ['today-date','w-date','l-date','wt-date','m-date','h-date'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=today; });
  await loadProfileToUI();
  await loadToday(); await loadSteps(); await refreshLib(); await loadRecipes(); await loadExercises(); await loadWeights(); await loadMeasures(); await loadHabits(); await refreshHabitStreaks(); await refreshAnalysis(); await refreshCharts();
})();
window.addEventListener('beforeunload',()=>{const date=document.getElementById('today-date').value; if(!date) return; put('days',{date,target:parseFloat(document.getElementById('daily-target').value||'0')||0,items:[...document.querySelectorAll('#meals .card')].flatMap(card=>{const meal=card.querySelector('h3').textContent; return [...card.querySelectorAll('.row')].map(r=>({meal, name:r.querySelector('input[data-k="name"]').value, points:parseFloat(r.querySelector('input[data-k="points"]').value||'0')}));})});});
