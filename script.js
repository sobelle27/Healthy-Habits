// Simple PointsPlus tracker with localStorage persistence
(function(){
  const $ = (s, p=document) => p.querySelector(s);
  const $$ = (s, p=document) => [...p.querySelectorAll(s)];

  const todayKey = 'pptracker-state';
  const initialState = {
    date: new Date().toISOString().slice(0,10),
    dailyAllowance: 26,   // default typical PointsPlus daily
    weeklyAllowance: 49,  // classic PointsPlus weekly
    dailyUsed: 0,
    weeklyUsed: 0,
    rolloverBank: 0,
    foods: [],
    exercises: [],
    recipes: [],
    measurements: []
  };

  function load(){
    const raw = localStorage.getItem(todayKey);
    let st = raw ? JSON.parse(raw) : initialState;
    // handle new day auto rollover if date changed
    const currentDate = new Date().toISOString().slice(0,10);
    if (st.date !== currentDate){
      // perform rollover of up to 4 unused daily points
      const remainingDaily = Math.max(0, st.dailyAllowance - st.dailyUsed);
      const rollover = Math.min(4, remainingDaily);
      st.rolloverBank += rollover;
      st.date = currentDate;
      st.dailyUsed = 0;
      st.foods = [];
      st.exercises = []; // optional: clear exercise log daily
    }
    return st;
  }
  let state = load();

  function save(){
    localStorage.setItem(todayKey, JSON.stringify(state));
  }

  function updateHeaderDate(){
    const d = new Date(state.date);
    $('#dateDisplay').textContent = d.toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric', year:'numeric'});
  }

  function calc(){
    // Exercise points add back to daily first, then weekly
    const exercisePts = state.exercises.reduce((a,b)=>a+Number(b.points||0),0);
    const foodPts = state.foods.reduce((a,b)=>a+Number(b.points||0),0);
    // Used numbers are tracked; but keep in sync:
    state.dailyUsed = Math.min(foodPts, state.dailyAllowance + exercisePts);
    const dailyOverflow = Math.max(0, foodPts - (state.dailyAllowance + exercisePts));
    // weeklyUsed includes overflow beyond daily; draws from rollover first implicitly by being in the same weeklyRemaining calculation
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

  function exerciseToday(){
    return state.exercises.reduce((a,b)=>a+Number(b.points||0),0);
  }

  function renderLists(){
    const fl = $('#foodList'); fl.innerHTML = '';
    state.foods.forEach((it, idx)=>{
      const li = document.createElement('li');
      li.innerHTML = \`<span>\${it.name}</span><strong>\${Number(it.points).toFixed(1).replace(/\.0$/,'')}</strong>\`;
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
      const li = document.createElement('li');
      li.innerHTML = \`<span>\${it.name}</span><strong>+\${Number(it.points).toFixed(1).replace(/\.0$/,'')}</strong>\`;
      const del = document.createElement('button'); del.textContent='✕';
      del.onclick = ()=>{ state.exercises.splice(idx,1); changed(); };
      li.appendChild(del);
      el.appendChild(li);
    });

    const rl = $('#recipeList'); rl.innerHTML='';
    state.recipes.forEach((r, i)=>{
      const li = document.createElement('li');
      const per = (r.totalPoints / Math.max(1, r.servings)).toFixed(1).replace(/\.0$/,'');
      li.innerHTML = \`<div><strong>\${r.name}</strong><div class="muted">\${r.servings} servings • \${per} pts/serving</div></div>\`;
      const useBtn = document.createElement('button'); useBtn.textContent='Use 1 serving';
      useBtn.onclick = ()=>{
        addFood(\`\${r.name} (1 serving)\`, Number(per));
      };
      const del = document.createElement('button'); del.textContent='Delete';
      del.onclick = ()=>{ state.recipes.splice(i,1); changed(); };
      const wrap = document.createElement('div');
      wrap.appendChild(useBtn); wrap.appendChild(del);
      li.appendChild(wrap);
      rl.appendChild(li);
    });
  }

  function changed(){
    save();
    renderStats();
    renderLists();
  }

  function addFood(name, points){
    state.foods.push({name, points:Number(points)});
    changed();
  }

  // Tab logic
  $$('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('.tab-btn').forEach(b=>b.classList.remove('active'));
      $$('.tab').forEach(t=>t.classList.remove('active'));
      btn.classList.add('active');
      $('#'+btn.dataset.tab).classList.add('active');
    });
  });

  // Food form
  $('#foodForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const name = $('#foodName').value.trim();
    const pts = parseFloat($('#foodPoints').value);
    if(!name || isNaN(pts)) return;
    addFood(name, pts);
    $('#foodForm').reset();
    $('#foodName').focus();
  });

  // Undo last item
  $('#undoLastBtn').addEventListener('click', ()=>{
    if(state.foods.length){
      state.foods.pop();
      changed();
    }
  });

  // End day & rollover
  $('#endDayBtn').addEventListener('click', ()=>{
    const remaining = Math.max(0, state.dailyAllowance + exerciseToday() - state.dailyUsed);
    const rollover = Math.min(4, remaining);
    state.rolloverBank += rollover;
    // Advance date to today (in case user is backdating) and reset day
    state.date = new Date().toISOString().slice(0,10);
    state.foods = [];
    state.exercises = [];
    state.dailyUsed = 0;
    changed();
    alert(\`Rolled \${rollover} pts to your bank.\`);
  });

  // Exercise form
  $('#exerciseForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const name = $('#exerciseName').value.trim();
    const pts = parseFloat($('#exercisePoints').value);
    if(!name || isNaN(pts)) return;
    state.exercises.push({name, points:Number(pts)});
    changed();
    $('#exerciseForm').reset();
    $('#exerciseName').focus();
  });

  // Recipes
  $('#addIngredientBtn').addEventListener('click', ()=>{
    const n = $('#ingredientName').value.trim();
    const p = parseFloat($('#ingredientPts').value);
    if(!n || isNaN(p)) return;
    const wrap = document.createElement('div');
    wrap.className='row';
    wrap.innerHTML = \`<span>\${n}</span><span>\${p.toFixed(1).replace(/\.0$/,'')} pts</span>\`;
    wrap.dataset.name = n;
    wrap.dataset.points = p;
    $('#recipeItems').appendChild(wrap);
    $('#ingredientName').value='';
    $('#ingredientPts').value='';
    $('#ingredientName').focus();
  });

  $('#recipeForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const name = $('#recipeName').value.trim();
    const servings = parseInt($('#recipeServings').value||'1',10);
    if(!name || !servings) return;
    let total = 0;
    $$('#recipeItems .row').forEach(r=> total += Number(r.dataset.points||0));
    state.recipes.push({name, servings, totalPoints: total});
    // clear
    $('#recipeForm').reset();
    $('#recipeItems').innerHTML='';
    changed();
  });

  // Measurements
  $('#measureForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const entry = {
      date: $('#measureDate').value,
      weight: $('#measureWeight').value,
      waist: $('#measureWaist').value,
      hips: $('#measureHips').value,
      chest: $('#measureChest').value
    };
    state.measurements.push(entry);
    changed();
    renderMeasurements();
    $('#measureForm').reset();
  });

  function renderMeasurements(){
    const tb = $('#measureTable tbody'); tb.innerHTML='';
    // newest first
    state.measurements.slice().reverse().forEach(m=>{
      const tr = document.createElement('tr');
      tr.innerHTML = \`<td>\${m.date||''}</td><td>\${m.weight||''}</td><td>\${m.waist||''}</td><td>\${m.hips||''}</td><td>\${m.chest||''}</td>\`;
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
    changed();
    alert('Saved.');
  });

  $('#resetDataBtn').addEventListener('click', ()=>{
    if(confirm('Reset ALL data? This cannot be undone.')){
      state = JSON.parse(JSON.stringify(initialState));
      state.date = new Date().toISOString().slice(0,10);
      changed();
      renderMeasurements();
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
        changed();
        renderMeasurements();
        alert('Import complete.');
      }catch(err){ alert('Invalid file.'); }
    };
    reader.readAsText(f);
  });

  // Init
  function initInputs(){
    $('#setDaily').value = state.dailyAllowance;
    $('#setWeekly').value = state.weeklyAllowance;
    $('#measureDate').value = new Date().toISOString().slice(0,10);
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
