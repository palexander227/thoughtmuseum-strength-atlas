const exercises = window.EXERCISE_DATA || [];
const pageSize = 48;
let page = 1;
const state = { q:'', group:'all', pattern:'all', equipment:'all', level:'all', track:'all' };
const favorites = new Set(JSON.parse(localStorage.getItem('tm_strength_favorites') || '[]'));
const tray = new Set(JSON.parse(localStorage.getItem('tm_strength_tray') || '[]'));

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const uniq = (arr) => [...new Set(arr)].filter(Boolean).sort((a,b)=>a.localeCompare(b));

const cardsEl = $('#cards');
const countEl = $('#count');
const pageInfo = $('#pageInfo');
const prevBtn = $('#prevPage');
const nextBtn = $('#nextPage');
const modal = $('#exerciseModal');
const toast = $('#toast');

function showToast(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'), 1700);
}

function tagClass(s=''){
  const x=s.toLowerCase();
  if(x.includes('50+') || x.includes('durability')) return 'durability';
  if(x.includes('teen')) return 'youth';
  if(x.includes('student')) return 'student';
  if(x.includes('strength')) return 'strength';
  if(x.includes('coach')) return 'coach';
  if(x.includes('mobility') || x.includes('warmup')) return 'mobility';
  if(x.includes('power')) return 'power';
  if(x.includes('core')) return 'core';
  return '';
}

function fillSelect(id, values){
  const el = $(id);
  values.forEach(v=>{
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v;
    el.appendChild(opt);
  });
}

function initFilters(){
  fillSelect('#groupFilter', uniq(exercises.map(e=>e.group)));
  fillSelect('#patternFilter', uniq(exercises.map(e=>e.pattern)));
  fillSelect('#equipmentFilter', uniq(exercises.map(e=>e.equipment)));
  fillSelect('#levelFilter', uniq(exercises.map(e=>e.level)));
  fillSelect('#trackFilter', uniq(exercises.flatMap(e=>e.tracks)));
  ['search','groupFilter','patternFilter','equipmentFilter','levelFilter','trackFilter'].forEach(id=>{
    $('#'+id).addEventListener(id==='search'?'input':'change', (ev)=>{
      const key = id.replace('Filter','');
      state[key === 'search' ? 'q' : key] = ev.target.value;
      page = 1;
      renderCards();
    });
  });
  $('#resetFilters').addEventListener('click', resetFilters);
  $('#showFavorites').addEventListener('click', ()=>{
    state.q = '__favorites__';
    $('#search').value = '★ favorites';
    page = 1; renderCards();
  });
}

function resetFilters(){
  Object.assign(state,{q:'',group:'all',pattern:'all',equipment:'all',level:'all',track:'all'});
  $('#search').value='';
  ['groupFilter','patternFilter','equipmentFilter','levelFilter','trackFilter'].forEach(id=>$('#'+id).value='all');
  page=1; renderCards();
}

function match(e){
  if(state.q === '__favorites__') return favorites.has(e.id);
  const hay = [e.name,e.group,e.pattern,e.equipment,e.level,e.source,e.purpose,e.caution,...e.tracks,...e.cues].join(' ').toLowerCase();
  return (!state.q || hay.includes(state.q.toLowerCase())) &&
    (state.group === 'all' || e.group === state.group) &&
    (state.pattern === 'all' || e.pattern === state.pattern) &&
    (state.equipment === 'all' || e.equipment === state.equipment) &&
    (state.level === 'all' || e.level === state.level) &&
    (state.track === 'all' || e.tracks.includes(state.track));
}

function renderCards(){
  const all = exercises.filter(match);
  const totalPages = Math.max(1, Math.ceil(all.length/pageSize));
  if(page > totalPages) page = totalPages;
  const slice = all.slice((page-1)*pageSize, page*pageSize);
  cardsEl.innerHTML = '';
  countEl.textContent = `Showing ${all.length} of ${exercises.length} atlas entries`;
  pageInfo.textContent = `Page ${page} of ${totalPages}`;
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= totalPages;
  if(!slice.length){
    cardsEl.innerHTML = `<article class="card" style="grid-column:1/-1"><h3>No match yet.</h3><p>Try broadening the filters or use the session builder to generate a starting template.</p></article>`;
    return;
  }
  slice.forEach(e=>{
    const card = document.createElement('article');
    card.className = 'exercise-card';
    const fav = favorites.has(e.id);
    const selected = tray.has(e.id);
    card.innerHTML = `
      <div>
        <div class="tag-row">
          <span class="tag ${tagClass(e.pattern)}">${e.pattern}</span>
          <span class="tag ${tagClass(e.tracks[0])}">${e.tracks[0] || 'General'}</span>
          <button class="star ${fav?'on':''}" title="Save favorite" data-fav="${e.id}">${fav?'★':'☆'}</button>
        </div>
        <h3>${e.name}</h3>
        <p>${e.purpose}</p>
      </div>
      <div class="card-bottom">
        <span class="pill">${e.group}</span>
        <span class="pill">${e.equipment}</span>
        <span class="pill">${e.level}</span>
        <span class="pill ${selected?'tag selected':''}">${selected?'In lesson tray':'Open details'}</span>
      </div>`;
    card.addEventListener('click', (ev)=>{
      if(ev.target.dataset.fav){ ev.stopPropagation(); toggleFavorite(e.id); return; }
      openDetail(e);
    });
    cardsEl.appendChild(card);
  });
}

function toggleFavorite(id){
  if(favorites.has(id)){ favorites.delete(id); showToast('Removed from favorites'); }
  else { favorites.add(id); showToast('Saved to favorites'); }
  localStorage.setItem('tm_strength_favorites', JSON.stringify([...favorites]));
  renderCards();
}

function getExercise(id){ return exercises.find(e=>e.id===id); }
function openDetail(e){
  $('#modalTitle').textContent = e.name;
  $('#modalSubtitle').textContent = `${e.group} • ${e.pattern} • ${e.source}`;
  $('#modalMeta').innerHTML = [e.level, e.equipment, ...e.tracks].map(x=>`<span class="tag ${tagClass(x)}">${x}</span>`).join('');
  $('#modalPurpose').textContent = e.purpose;
  $('#modalCues').innerHTML = e.cues.map(x=>`<li>${x}</li>`).join('');
  $('#modalCaution').textContent = e.caution;
  const inTray = tray.has(e.id);
  $('#addToTray').textContent = inTray ? 'Remove from lesson tray' : 'Add to lesson tray';
  $('#addToTray').onclick = ()=>{ toggleTray(e.id); modal.close(); };
  modal.showModal();
}

function toggleTray(id){
  if(tray.has(id)){ tray.delete(id); showToast('Removed from lesson tray'); }
  else { tray.add(id); showToast('Added to lesson tray'); }
  localStorage.setItem('tm_strength_tray', JSON.stringify([...tray]));
  renderTray(); renderCards();
}

function renderTray(){
  const list = [...tray].map(getExercise).filter(Boolean);
  $('#trayCount').textContent = list.length;
  const el = $('#trayList'); el.innerHTML = '';
  if(!list.length){ el.innerHTML = '<p style="color:var(--muted);margin:0">Add exercises from the library to build a client lesson.</p>'; return; }
  list.forEach(e=>{
    const row = document.createElement('div'); row.className='tray-item';
    row.innerHTML = `<span>${e.name}</span><button title="Remove">×</button>`;
    row.querySelector('button').addEventListener('click',()=>toggleTray(e.id));
    el.appendChild(row);
  });
}

function trayText(){
  const list = [...tray].map(getExercise).filter(Boolean);
  if(!list.length) return 'ThoughtMuseum Strength Atlas — Lesson Tray\n\nNo exercises selected yet.';
  return 'ThoughtMuseum Strength Atlas — Lesson Tray\n\n' + list.map((e,i)=>`${i+1}. ${e.name}\n   Pattern: ${e.pattern}\n   Equipment: ${e.equipment}\n   Cues: ${e.cues.join('; ')}`).join('\n\n');
}

function initTray(){
  $('#toggleTray').addEventListener('click',()=>$('#lessonTray').classList.toggle('collapsed'));
  $('#copyTray').addEventListener('click', async()=>{
    await navigator.clipboard.writeText(trayText());
    showToast('Lesson tray copied');
  });
  $('#clearTray').addEventListener('click',()=>{ tray.clear(); localStorage.setItem('tm_strength_tray','[]'); renderTray(); renderCards(); showToast('Lesson tray cleared'); });
  renderTray();
}

function pick(pool, patterns, count){
  const out=[];
  for(const p of patterns){
    const candidates = pool.filter(e=>e.pattern===p && !out.some(x=>x.id===e.id));
    if(candidates.length) out.push(candidates[Math.floor(Math.random()*candidates.length)]);
    if(out.length>=count) break;
  }
  if(out.length<count){
    const rest=pool.filter(e=>!out.some(x=>x.id===e.id));
    while(out.length<count && rest.length){ out.push(rest.splice(Math.floor(Math.random()*rest.length),1)[0]); }
  }
  return out;
}

function generateSession(){
  const track = $('#builderTrack').value;
  const equipment = $('#builderEquipment').value;
  const time = Number($('#builderTime').value);
  const emphasis = $('#builderEmphasis').value;
  let pool = exercises.filter(e=>e.tracks.includes(track));
  if(equipment !== 'Any') pool = pool.filter(e=> e.equipment.includes(equipment) || e.equipment === 'Body weight' || e.equipment === 'General');
  if(track.includes('50+')) pool = pool.filter(e=>!['Advanced'].includes(e.level));
  if(track.includes('Student')) pool = pool.filter(e=>['Beginner','Intermediate','Coach'].includes(e.level));
  const patternsByGoal = {
    'Strength Maintenance':['Push','Pull','Squat','Hinge','Core Stability','Mobility'],
    'Bench Support':['Push','Pull','Pull','Core Stability','Mobility','Arms'],
    'Squat Support':['Squat','Hinge','Core Stability','Mobility','Carry / Grip'],
    'Posture Reset':['Pull','Core Stability','Mobility','Mobility','Pull'],
    'Athletic Durability':['Power','Squat','Hinge','Pull','Core Stability','Mobility']
  };
  const count = time <= 15 ? 3 : time <= 25 ? 4 : 5;
  const session = pick(pool, patternsByGoal[emphasis], count);
  const setScheme = time <= 15 ? '1–2 rounds' : time <= 25 ? '2–3 work sets' : '3 work sets';
  const repScheme = emphasis.includes('Strength') || emphasis.includes('Bench') || emphasis.includes('Squat') ? '5–8 reps, leaving 1–2 reps in reserve' : '8–12 reps or 20–40 second holds';
  $('#sessionOutput').innerHTML = `
    <h3>${track}: ${emphasis}</h3>
    <p style="color:var(--muted);line-height:1.5;margin:0">Target time: ${time} minutes. Suggested dose: ${setScheme}. Main effort: ${repScheme}.</p>
    <ol>${session.map(e=>`<li><b>${e.name}</b><br><span style="color:var(--muted)">${e.pattern} • ${e.equipment} • ${e.cues[0]}</span></li>`).join('')}</ol>
    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button class="mini-btn" id="loadSession">Load into lesson tray</button><button class="mini-btn" id="copySession">Copy session</button></div>`;
  $('#loadSession').addEventListener('click',()=>{ session.forEach(e=>tray.add(e.id)); localStorage.setItem('tm_strength_tray', JSON.stringify([...tray])); renderTray(); renderCards(); showToast('Session loaded'); });
  $('#copySession').addEventListener('click',async()=>{ await navigator.clipboard.writeText(`ThoughtMuseum Strength Atlas Session\n${track} — ${emphasis}\n${time} minutes\n\n` + session.map((e,i)=>`${i+1}. ${e.name} — ${e.pattern} — ${e.equipment}`).join('\n')); showToast('Session copied'); });
}

function initBuilder(){
  $('#buildSession').addEventListener('click', generateSession);
  generateSession();
}

function initCounts(){
  $('#exerciseTotal').textContent = exercises.length;
  $('#patternTotal').textContent = uniq(exercises.map(e=>e.pattern)).length;
  $('#trackTotal').textContent = uniq(exercises.flatMap(e=>e.tracks)).length;
}

prevBtn.addEventListener('click',()=>{ page=Math.max(1,page-1); renderCards(); });
nextBtn.addEventListener('click',()=>{ page=page+1; renderCards(); });
$('#closeModal').addEventListener('click',()=>modal.close());
modal.addEventListener('click',(ev)=>{ if(ev.target === modal) modal.close(); });

initCounts();
initFilters();
initTray();
initBuilder();
renderCards();
