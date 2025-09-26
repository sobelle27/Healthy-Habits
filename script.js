(function(){
  const $ = (s, p=document) => p.querySelector(s);
  const $$ = (s, p=document) => [...p.querySelectorAll(s)];

  document.addEventListener('touchstart', ()=>{}, {passive:true});

  const todayKey = 'pptracker-state';
  const initialState = {
    date: new Date().toISOString().slice(0,10),
    dailyAllowance: 26,
    weeklyAllowance: 49,
    dailyUsed: 0,
    weeklyUsed: 0,
    rolloverBank: 0,
    foods: [],
    exercises: [], // {name, minutes?, reps?, weight?, points}
    recipes: [],
    measurements: [] // {month:'YYYY-MM', weight, neck, bust, waist, hips, buttocks, bicepsL, ...}
  };

  function load(){
    const raw = localStorage.getItem(todayKey);
    let st = raw ? JSON.parse(raw) : initialState;
    const currentDate = new Date().toISOString().slice(0,10);
    if (st.date !== currentDate){
      const remainingDaily = Math.max(0, st.dailyAllowance - st.dailyUsed);
      const rollover = Math.min(4, remainingDaily);
      st.rolloverBank += rollover;
      st.date = currentDate;
      st.dailyUsed = 0;
      st.foods = [];
      st.exercises = [];
    }
    return st;
  }
  let state = load();

  function save(){ localStorage.setItem(todayKey, JSON.stringify(state)); }

  function updateHeaderDate(){
    const d = new Date(state.date);
    $('#dateDisplay').textContent = d.toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric', year:'numeric'});
  }

  function calc(){
    const exercisePts = state.exercises.reduce((a,b)=>a+Number(b.points||0),0);
    const foodPts = state.foods.reduce((a,b)=>a+Number(b.points||0),0);
    state.dailyUsed = Math.min(foodPts, state.dailyAllowance + exercisePts);
    const dailyOverflow = Math.max(0, foodPts - (state.dailyAllowance + exercisePts));
    state.weeklyUsed = dailyOverflow;
  }

  function weeklyRemaining(){
    const pool = state.weeklyAllowance + state.rolloverBank;
    return Math.max(0, pool - state.weeklyUsed);
  }

  function renderStats(){
    calc();
    $('#dailyAllowance').textContent = state.dailyAllowance;
    $('#dailyUsed').textContent = state.dailyUsed.toFixed(1).replace(/\.0$/,'');
    const dailyRem = Math.max(0, state.dailyAllowance + exerciseToday() - state.dailyUsed);
    $('#dailyRemaining').textContent = dailyRem.toFixed(1).replace(/\.0$/,'');

    $('#weeklyAllowance').textContent = state.weeklyAllowance;
    $('#weeklyUsed').textContent = state.weeklyUsed.toFixed(1).replace(/\.0$/,'');
    $('#weeklyRemaining').textContent = weeklyRemaining().toFixed(1).replace(/\.0$/,'');
    $('#rolloverBank').textContent = state.rolloverBank.toFixed(1).replace(/\.0$/,'');
  }

  function exerciseToday(){ return state.exercises.reduce((a,b)=>a+Number(b.points||0),0); }

  function renderLists(){
    const fl = $('#foodList'); fl.innerHTML = '';
    state.foods.forEach((it, idx)=>{
      const li = document.createElement('li');
      li.innerHTML = `<span>${it.name}</span><strong>${Number(it.points).toFixed(1).replace(/\.0$/,'')}</strong>`;
      const actions = document.createElement('div');
      actions.className = 'item-actions';
      const del = document.createElement('button'); del.textContent='✕'; del.title='Remove';
      del.onclick = ()=>{ state.foods.splice(idx,1); changed(); };
      actions.appendChild(del);
      li.appendChild(actions);
      fl.appendChild(li);
    });

    const el = $('#exerciseList'); el.innerHTML='';
    state.exercises.forEach((it, idx)=>{
      const meta = [];
      if(it.minutes){ meta.push(`${it.minutes} min`); }
      if(it.reps){ meta.push(`${it.reps} reps`); }
      if(it.weight){ meta.push(`${it.weight} lb`); }
      const metaStr = meta.length? ` <span class="ex-meta">(${meta.join(' • ')})</span>` : '';
      const li = document.createElement('li');
      li.innerHTML = `<div><div>${it.name}${metaStr}</div></div><strong>+${Number(it.points).toFixed(1).replace(/\.0$/,'')}</strong>`;
      const del = document.createElement('button'); del.textContent='✕';
      del.onclick = ()=>{ state.exercises.splice(idx,1); changed(); };
      li.appendChild(del);
      el.appendChild(li);
    });

    const rl = $('#recipeList'); rl.innerHTML='';
    state.recipes.forEach((r, i)=>{
      const li = document.createElement('li');
      const per = (r.totalPoints / Math.max(1, r.servings)).toFixed(1).replace(/\.0$/,'');
      li.innerHTML = `<div><strong>${r.name}</strong><div class="muted">${r.servings} servings • ${per} pts/serving</div></div>`;
      const useBtn = document.createElement('button'); useBtn.textContent='Use 1 serving';
      useBtn.onclick = ()=>{ addFood(`${r.name} (1 serving)`, Number(per)); };
      const del = document.createElement('button'); del.textContent='Delete';
      del.onclick = ()=>{ state.recipes.splice(i,1); changed(); };
      const wrap = document.createElement('div');
      wrap.appendChild(useBtn); wrap.appendChild(del);
      li.appendChild(wrap);
      rl.appendChild(li);
    });
  }

  function changed(){ save(); renderStats(); renderLists(); }

  function addFood(name, points){ state.foods.push({name, points:Number(points)}); changed(); }

  // Tabs
  function activateTab(btn){
    $$('.tab-btn').forEach(b=>{ b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
    $$('.tab').forEach(t=>{ t.classList.remove('active'); t.setAttribute('aria-hidden','true'); });
    btn.classList.add('active'); btn.setAttribute('aria-selected','true');
    const pane = $('#'+btn.dataset.tab);
    if(pane){ pane.classList.add('active'); pane.setAttribute('aria-hidden','false'); }
  }
  $$('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>activateTab(btn));
    btn.addEventListener('keydown', (e)=>{
      if(e.key==='Enter' || e.key===' '){ e.preventDefault(); activateTab(btn); }
    });
  });

  // Food form
  $('#foodForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const name = $('#foodName').value.trim();
    const pts = parseFloat($('#foodPoints').value);
    if(!name || isNaN(pts)) return;
    addFood(name, pts);
    $('#foodForm').reset(); $('#foodName').focus();
  });

  $('#undoLastBtn').addEventListener('click', ()=>{
    if(state.foods.length){ state.foods.pop(); changed(); }
  });

  $('#endDayBtn').addEventListener('click', ()=>{
    const remaining = Math.max(0, state.dailyAllowance + exerciseToday() - state.dailyUsed);
    const rollover = Math.min(4, remaining);
    state.rolloverBank += rollover;
    state.date = new Date().toISOString().slice(0,10);
    state.foods = []; state.exercises = []; state.dailyUsed = 0;
    changed();
    alert(`Rolled ${rollover} pts to your bank.`);
  });

  // Exercise form
  $('#exerciseForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const name = $('#exerciseName').value.trim();
    const minutes = parseInt($('#exerciseMinutes').value || '0', 10) || null;
    const reps = parseInt($('#exerciseReps').value || '0', 10) || null;
    const weight = parseFloat($('#exerciseWeight').value || '0') || null;
    const pts = parseFloat($('#exercisePoints').value);
    if(!name || isNaN(pts)) return;
    state.exercises.push({name, minutes, reps, weight, points:Number(pts)});
    changed();
    $('#exerciseForm').reset(); $('#exerciseName').focus();
  });

  // Recipes
  $('#addIngredientBtn').addEventListener('click', ()=>{
    const n = $('#ingredientName').value.trim();
    const p = parseFloat($('#ingredientPts').value);
    if(!n || isNaN(p)) return;
    const wrap = document.createElement('div');
    wrap.className='row';
    wrap.innerHTML = `<span>${n}</span><span>${p.toFixed(1).replace(/\.0$/,'')} pts</span>`;
    wrap.dataset.name = n; wrap.dataset.points = p;
    $('#recipeItems').appendChild(wrap);
    $('#ingredientName').value=''; $('#ingredientPts').value=''; $('#ingredientName').focus();
  });

  $('#recipeForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const name = $('#recipeName').value.trim();
    const servings = parseInt($('#recipeServings').value||'1',10);
    if(!name || !servings) return;
    let total = 0;
    $$('#recipeItems .row').forEach(r=> total += Number(r.dataset.points||0));
    state.recipes.push({name, servings, totalPoints: total});
    $('#recipeForm').reset(); $('#recipeItems').innerHTML='';
    changed();
  });

  // Measurements (monthly)
  $('#measureForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const entry = {
      month: $('#measureMonth').value, // YYYY-MM
      weight: $('#mWeight').value,
      neck: $('#mNeck').value,
      bust: $('#mBust').value,
      waist: $('#mWaist').value,
      hips: $('#mHips').value,
      buttocks: $('#mButtocks').value,
      bicepsL: $('#mBicepsL').value,
      bicepsR: $('#mBicepsR').value,
      forearmL: $('#mForearmL').value,
      forearmR: $('#mForearmR').value,
      thighL: $('#mThighL').value,
      thighR: $('#mThighR').value,
      calfL: $('#mCalfL').value,
      calfR: $('#mCalfR').value
    };
    // If an entry for this month exists, replace it (so you keep one per month)
    const idx = state.measurements.findIndex(m => m.month === entry.month);
    if(idx >= 0){ state.measurements[idx] = entry; } else { state.measurements.push(entry); }
    changed(); renderMeasurements();
    $('#measureForm').reset();
    // default month to current
    const now = new Date();
    $('#measureMonth').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  });

  function renderMeasurements(){
    const tb = $('#measureTable tbody'); tb.innerHTML='';
    // sort by month descending
    const items = state.measurements.slice().sort((a,b)=> (a.month<b.month?1:-1));
    items.forEach(m=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${m.month||''}</td>
        <td>${m.weight||''}</td><td>${m.neck||''}</td><td>${m.bust||''}</td>
        <td>${m.waist||''}</td><td>${m.hips||''}</td><td>${m.buttocks||''}</td>
        <td>${m.bicepsL||''}</td><td>${m.bicepsR||''}</td>
        <td>${m.forearmL||''}</td><td>${m.forearmR||''}</td>
        <td>${m.thighL||''}</td><td>${m.thighR||''}</td>
        <td>${m.calfL||''}</td><td>${m.calfR||''}</td>`;
      tb.appendChild(tr);
    });
  }

  // Settings
  $('#settingsForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const d = parseInt($('#setDaily').value||'0',10);
    const w = parseInt($('#setWeekly').value||'0',10);
    if(d>=0) state.dailyAllowance = d;
    if(w>=0) state.weeklyAllowance = w;
    changed(); alert('Saved.');
  });

  $('#resetDataBtn').addEventListener('click', ()=>{
    if(confirm('Reset ALL data? This cannot be undone.')){
      state = JSON.parse(JSON.stringify(initialState));
      state.date = new Date().toISOString().slice(0,10);
      changed(); renderMeasurements();
    }
  });

  $('#exportBtn').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pointsplus-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('#importBtn').addEventListener('click', ()=>{
    const f = $('#importFile').files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = (e)=>{
      try{
        const obj = JSON.parse(e.target.result);
        state = Object.assign({}, initialState, obj);
        changed(); renderMeasurements();
        alert('Import complete.');
      }catch(err){ alert('Invalid file.'); }
    };
    reader.readAsText(f);
  });

  function initInputs(){
    $('#setDaily').value = state.dailyAllowance;
    $('#setWeekly').value = state.weeklyAllowance;
    const now = new Date();
    $('#measureMonth').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }

  function start(){
    updateHeaderDate();
    initInputs();
    renderStats();
    renderLists();
    renderMeasurements();
  }
  start();
})();