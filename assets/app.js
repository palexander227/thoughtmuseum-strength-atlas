const exercises = window.EXERCISE_DATA || [];
const pageSize = 48;
const libraryCount = exercises.filter(e => e.level !== 'Coach' && !(e.tracks || []).includes('Coach Toolkit')).length;
let page = 1;
const state = { q:'', group:'all', pattern:'all', equipment:'all', level:'all', track:'all', patternFamily:null };

// Client-track display order (chips + dropdown read the same set).
const TRACK_ORDER = ['Teen Athlete', 'Student Energy', 'Adult Strength', '50+ Durability', 'Coach Toolkit'];

// The prototype's clean six movement-pattern families. Each maps to one or
// more raw patterns in the data so the messy taxonomy stays navigable.
const PATTERN_FAMILIES = [
  { key:'Push',     letter:'P', label:'Push',                  patterns:['Push'],
    blurb:'Bench, pushup, overhead press. Balance with enough pulling.' },
  { key:'Pull',     letter:'R', label:'Pull',                  patterns:['Pull'],
    blurb:'Rows, pulldowns, chinups, face pulls. Posture and shoulder health.' },
  { key:'Squat',    letter:'S', label:'Squat',                 patterns:['Squat'],
    blurb:'Knee-dominant leg strength. Back, goblet, and split squats.' },
  { key:'Hinge',    letter:'H', label:'Hinge',                 patterns:['Hinge'],
    blurb:'Posterior-chain strength. Deadlift, RDL, hip raise, swings.' },
  { key:'Carry',    letter:'C', label:'Carry / Core Stability', patterns:['Core Stability','Carry / Grip','Rotation'],
    blurb:'Grip, trunk stiffness, anti-rotation, and posture under load.' },
  { key:'Mobility', letter:'M', label:'Mobility',              patterns:['Mobility','Warmup'],
    blurb:'Warmups, resets, range preservation, and tissue quality.' },
  { key:'PowerArms', letter:'A', label:'Power & Arms',         patterns:['Power','Arms'],
    blurb:'Explosive hip drive and direct arm work — swings, throws, jumps, curls, extensions.' }
];

function familyOf(pattern){ return PATTERN_FAMILIES.find(f => f.patterns.includes(pattern)) || null; }
function familyMeta(pattern){
  const f = familyOf(pattern);
  return f ? { cls:'fam-' + f.key.toLowerCase(), letter:f.letter }
           : { cls:'fam-other', letter:((pattern || '').trim()[0] || 'E') };
}
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

// Clipboard with a graceful fallback for file:// and non-secure contexts,
// where navigator.clipboard is undefined and would throw silently.
async function copyText(text){
  try{
    if(navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly','');
      ta.style.position = 'absolute'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    return true;
  } catch(err){ return false; }
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
      if(id === 'trackFilter') setActiveChip(ev.target.value);
      if(id === 'patternFilter') clearPatternFamily(); // exact-pattern overrides a family pick
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
  Object.assign(state,{q:'',group:'all',pattern:'all',equipment:'all',level:'all',track:'all',patternFamily:null});
  $('#search').value='';
  ['groupFilter','patternFilter','equipmentFilter','levelFilter','trackFilter'].forEach(id=>$('#'+id).value='all');
  setActiveChip('all');
  clearPatternFamily();
  page=1; renderCards();
}

function clearPatternFamily(){
  state.patternFamily = null;
  $$('#patternGrid .pattern-card').forEach(c=>c.classList.remove('selected'));
}

function setActiveChip(track){
  $$('#trackChips .chip').forEach(c=>c.classList.toggle('active', c.dataset.track === track));
}

function initChips(){
  const chipsEl = $('#trackChips');
  if(!chipsEl) return;
  // Fixed, audience-logical order; only render tracks that exist in the data,
  // then append any unexpected tracks so nothing is silently dropped.
  const present = new Set(exercises.flatMap(e=>e.tracks));
  const ordered = TRACK_ORDER.filter(t=>present.has(t));
  const extras = [...present].filter(t=>!TRACK_ORDER.includes(t)).sort((a,b)=>a.localeCompare(b));
  const tracks = ['all', ...ordered, ...extras];
  chipsEl.innerHTML = tracks.map(t=>
    `<button type="button" class="chip ${t==='all'?'active':''}" data-track="${t}">${t==='all'?'All client tracks':t}</button>`
  ).join('');
  chipsEl.addEventListener('click', ev=>{
    const btn = ev.target.closest('.chip');
    if(!btn) return;
    state.track = btn.dataset.track;
    $('#trackFilter').value = btn.dataset.track;
    setActiveChip(btn.dataset.track);
    page = 1; renderCards();
  });
}

function initPatterns(){
  const grid = $('#patternGrid');
  if(!grid) return;
  const pool = exercises.filter(e=>!isCoachTool(e));
  grid.innerHTML = PATTERN_FAMILIES.map(f=>{
    const n = pool.filter(e=>f.patterns.includes(e.pattern)).length;
    return `
    <button type="button" class="pattern-card fam-${f.key.toLowerCase()}" data-family="${f.key}" aria-label="Filter library to ${f.label} (${n} exercises)">
      <div class="big">${f.letter}</div>
      <h3>${f.label}</h3>
      <p>${f.blurb}</p>
      <span class="pattern-count">${n} exercises</span>
    </button>`;
  }).join('');
  grid.addEventListener('click', ev=>{
    const btn = ev.target.closest('.pattern-card');
    if(!btn) return;
    const fam = PATTERN_FAMILIES.find(f=>f.key === btn.dataset.family);
    if(!fam) return;
    resetFilters();
    state.patternFamily = fam.patterns;
    $$('#patternGrid .pattern-card').forEach(c=>c.classList.toggle('selected', c === btn));
    page = 1; renderCards();
    document.getElementById('library').scrollIntoView({behavior:'smooth', block:'start'});
  });
}

function isCoachTool(e){ return e.level === 'Coach' || (e.tracks || []).includes('Coach Toolkit'); }

function match(e){
  if(state.q === '__favorites__') return favorites.has(e.id);
  // Coaching rules are not exercises: keep them out of the general library
  // unless the user explicitly asks for the Coach Toolkit track.
  if(isCoachTool(e) && state.track !== 'Coach Toolkit') return false;
  const hay = [e.name,e.group,e.pattern,e.equipment,e.level,e.source,e.purpose,e.caution,...e.tracks,...e.cues].join(' ').toLowerCase();
  return (!state.q || hay.includes(state.q.toLowerCase())) &&
    (state.group === 'all' || e.group === state.group) &&
    (state.pattern === 'all' || e.pattern === state.pattern) &&
    (!state.patternFamily || state.patternFamily.includes(e.pattern)) &&
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
  const denom = state.track === 'Coach Toolkit' ? exercises.length : libraryCount;
  countEl.textContent = `Showing ${all.length} of ${denom} atlas entries`;
  pageInfo.textContent = `Page ${page} of ${totalPages}`;
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= totalPages;
  if(!slice.length){
    cardsEl.innerHTML = `<article class="card" style="grid-column:1/-1"><h3>No match yet.</h3><p>Try broadening the filters or use the session builder to generate a starting template.</p></article>`;
    return;
  }
  slice.forEach(e=>{
    const card = document.createElement('article');
    const fam = familyMeta(e.pattern);
    card.className = 'exercise-card ' + fam.cls;
    card.dataset.patternLetter = fam.letter;
    const fav = favorites.has(e.id);
    const selected = tray.has(e.id);
    // Surface the actively-filtered track first and style it prominently.
    let tracks = e.tracks || [];
    const activeTrack = state.track !== 'all' && tracks.includes(state.track);
    if(activeTrack) tracks = [state.track, ...tracks.filter(t=>t!==state.track)];
    const trackBadges = tracks.slice(0, 3).map(t => {
      const on = activeTrack && t === state.track;
      return `<span class="tag ${tagClass(t)}${on ? ' track-active' : ''}">${t}</span>`;
    }).join('');
    card.innerHTML = `
      <div>
        <div class="tag-row">
          <span class="tag pattern-tag ${tagClass(e.pattern)}">${e.pattern}</span>
          ${trackBadges}
          <button class="star ${fav?'on':''}" title="Save favorite" aria-label="Save ${e.name} to favorites" data-fav="${e.id}">${fav?'★':'☆'}</button>
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
    const ok = await copyText(trayText());
    showToast(ok ? 'Lesson tray copied' : 'Copy unavailable — select the text manually');
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
  $('#copySession').addEventListener('click',async()=>{ const ok = await copyText(`ThoughtMuseum Strength Atlas Session\n${track} — ${emphasis}\n${time} minutes\n\n` + session.map((e,i)=>`${i+1}. ${e.name} — ${e.pattern} — ${e.equipment}`).join('\n')); showToast(ok ? 'Session copied' : 'Copy unavailable — select the text manually'); });
}

function initBuilder(){
  $('#buildSession').addEventListener('click', generateSession);
  generateSession();
}

function initCounts(){
  $('#exerciseTotal').textContent = libraryCount;
  $('#patternTotal').textContent = uniq(exercises.map(e=>e.pattern)).length;
  $('#trackTotal').textContent = uniq(exercises.flatMap(e=>e.tracks)).length;
}

function gotoPage(p){
  page = Math.max(1, p);
  renderCards();
  document.getElementById('library').scrollIntoView({behavior:'smooth', block:'start'});
}
prevBtn.addEventListener('click',()=>gotoPage(page-1));
nextBtn.addEventListener('click',()=>gotoPage(page+1));
$('#closeModal').addEventListener('click',()=>modal.close());
modal.addEventListener('click',(ev)=>{ if(ev.target === modal) modal.close(); });

initCounts();
initFilters();
initChips();
initPatterns();
initTray();
initBuilder();
renderCards();
