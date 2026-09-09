'use strict';

/* ──────────────────────────────────────────────────
   CONFIG + PRISTINE
────────────────────────────────────────────────── */
let CFG = null;

async function loadConfig(){
  const res = await fetch('config.json', { cache: 'no-store' });
  CFG = await res.json();
  document.getElementById('vo-audio').src = CFG.audioSrc;
  syncMeasureStationLabels();
  applyConfig();
}
loadConfig();

/* ──────────────────────────────────────────────────
   SVG DRAWING HELPERS
────────────────────────────────────────────────── */
const SVG_NS = 'http://www.w3.org/2000/svg';

function vialSVG({defect=null,color='correct',size=52,label=''}={}){
  const w=size, h=size*2.8;
  const cx=w/2;
  const bodyFill = color==='correct' ? '#2b6cb0' : '#5b3a8a';
  const hlFill = color==='correct' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.18)';
  const capFill = color==='correct' ? '#588ac5' : '#7a58b0';
  const topFill = color==='correct' ? '#82a4d3' : '#9a78c8';
  let crack='';
  if(defect==='crack'){
    crack=`<path d="M${cx-3} ${h*0.25} L${cx+5} ${h*0.38} L${cx-4} ${h*0.5} L${cx+3} ${h*0.62}" stroke="rgba(255,255,255,0.85)" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M${cx+5} ${h*0.38} L${cx+10} ${h*0.44}" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" fill="none"/>`;
  } else if(defect==='chip'){
    crack=`<path d="M${w*0.7} ${h*0.18} L${w*0.88} ${h*0.14} L${w*0.9} ${h*0.22} Z" fill="#1a4a7a"/>
    <path d="M${w*0.7} ${h*0.18} L${w*0.88} ${h*0.14} L${w*0.9} ${h*0.22} Z" stroke="rgba(255,255,255,0.5)" stroke-width="1" fill="none"/>`;
  }
  return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Vial ${label}">
    <rect x="${w*0.1}" y="${h*0.18}" width="${w*0.8}" height="${h*0.77}" rx="${w*0.1}" fill="${bodyFill}"/>
    <rect x="${w*0.16}" y="${h*0.18}" width="${w*0.2}" height="${h*0.77}" rx="${w*0.08}" fill="${hlFill}"/>
    <rect x="${w*0.25}" y="${h*0.1}" width="${w*0.5}" height="${h*0.12}" rx="${w*0.06}" fill="${capFill}"/>
    <ellipse cx="${cx}" cy="${h*0.1}" rx="${w*0.28}" ry="${h*0.04}" fill="${topFill}"/>
    <rect x="${w*0.12}" y="${h*0.45}" width="${w*0.76}" height="${h*0.28}" rx="${w*0.04}" fill="rgba(255,255,255,0.08)"/>
    <ellipse cx="${cx}" cy="${h*0.94}" rx="${w*0.38}" ry="${h*0.035}" fill="rgba(0,0,0,0.2)"/>
    ${crack}
  </svg>`;
}

function miniVialSVG({defect=null,color='correct',size=28}={}){
  return vialSVG({defect,color,size});
}

/* ──────────────────────────────────────────────────
   STATE
────────────────────────────────────────────────── */
let state = {
  vials: [],
  stationIdx: 0,      // 0=color, 1=defects, 2=measure
  vialsForStation: [],
  rejectedAll: [],
  goodVials: [],
  approvedVials: [],   // filled live as vials clear the FINAL station
  currentVialPos: 0,
  answered: false,
};

function initState(){
  state.vials = CFG.vials.map(v => ({...v}));
  state.stationIdx = 0;
  state.vialsForStation = [...state.vials];
  state.rejectedAll = [];
  state.goodVials = [];
  state.approvedVials = [];
  state.currentVialPos = 0;
  state.answered = false;
}

/* ──────────────────────────────────────────────────
   UTILITIES
────────────────────────────────────────────────── */
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function animateShake(el){
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(()=>el.classList.remove('shake'),500);
}

/* ──────────────────────────────────────────────────
   INIT SCREEN TEXTS FROM CONFIG
────────────────────────────────────────────────── */
function applyConfig(){
  document.getElementById('i-label').textContent = CFG.roomLabel;
  document.getElementById('i-title').textContent = CFG.gameTitle;
  document.getElementById('i-sub').textContent = CFG.introSub;
  document.getElementById('i-goal').textContent = CFG.goalText;
  document.getElementById('btn-start').textContent = CFG.introBtn;
  document.getElementById('rack-title').textContent = CFG.rackTitle;
  document.getElementById('rack-sub').textContent = CFG.rackSub;
  document.getElementById('dist-title').textContent = CFG.distTitle;
  document.getElementById('dist-sub').textContent = CFG.distSub;
  document.getElementById('btn-dist').textContent = CFG.distBtn;
  document.getElementById('break-title').textContent = CFG.breakTitle;
  document.getElementById('break-script').textContent = CFG.breakScript;
  if(CFG.showGear) document.getElementById('admin-gear').style.display='flex';
}

/* ──────────────────────────────────────────────────
   RACK VIEW
────────────────────────────────────────────────── */
function buildRack(){
  const rack = document.getElementById('vial-rack');
  rack.innerHTML = '';
  state.vials.forEach(v=>{
    const slot = document.createElement('div');
    slot.className = 'vial-slot';
    slot.innerHTML = vialSVG({defect:null,color:'correct',size:32}) +
      `<div class="vial-label">${v.id}</div>`;
    rack.appendChild(slot);
  });
}

/* ──────────────────────────────────────────────────
   STATION TRANSITION
────────────────────────────────────────────────── */
function showStationTransition(stnData, onReady){
  const tr = document.getElementById('stn-transition');
  document.getElementById('stn-tr-num').textContent = stnData.num;
  document.getElementById('stn-tr-name').textContent = `Station ${stnData.num} — ${stnData.name}`;
  document.getElementById('stn-tr-desc').textContent = stnData.desc;
  tr.classList.add('show');
  const btn = document.getElementById('btn-stn-ready');
  btn.onclick = ()=>{
    tr.classList.remove('show');
    onReady();
  };
}

/* ──────────────────────────────────────────────────
   DOT MATRIX ANIMATION
────────────────────────────────────────────────── */
function buildDots(containerId, rows=6, cols=8){
  const c = document.getElementById(containerId);
  c.style.gridTemplateColumns = `repeat(${cols},1fr)`;
  c.innerHTML = '';
  for(let i=0;i<rows*cols;i++){
    const d=document.createElement('div');
    d.className='dot';
    c.appendChild(d);
  }
}

function animateDots(containerId, pattern='scan'){
  const dots = document.getElementById(containerId).querySelectorAll('.dot');
  dots.forEach(d=>d.classList.remove('on'));
  if(pattern==='scan'){
    let col=0;
    const int = setInterval(()=>{
      dots.forEach((d,i)=>d.classList.toggle('on',i%8===col));
      col=(col+1)%8;
    },120);
    return int;
  }
  if(pattern==='all'){
    dots.forEach(d=>d.classList.add('on'));
  }
}

/* ──────────────────────────────────────────────────
   STATION VISUALIZATIONS
────────────────────────────────────────────────── */
function renderStationVis(stnIdx, vial){
  const vis = document.getElementById('stn-vis');
  vis.innerHTML='';
  const stn = CFG.stations[stnIdx];

  if(stn.type==='defect'){
    // X-ray scanner
    vis.style.flexDirection='column';
    vis.style.gap='8px';
    const scanWrap = document.createElement('div');
    scanWrap.className='scan-wrap';
    scanWrap.style.cssText='position:relative;display:inline-block;';
    // Show vial in "X-ray" mode (desaturated blue outline)
    const xrayColor = vial.defect?'rgba(100,180,255,0.55)':'rgba(130,200,255,0.45)';
    const svgEl = document.createElement('div');
    svgEl.innerHTML = `<svg xmlns="${SVG_NS}" viewBox="0 0 44 120" width="44" height="120">
      <rect x="5" y="16" width="34" height="97" rx="5" fill="none" stroke="${xrayColor}" stroke-width="2"/>
      <rect x="11" y="9" width="22" height="13" rx="3" fill="none" stroke="${xrayColor}" stroke-width="1.5"/>
      <ellipse cx="22" cy="9" rx="12" ry="4" fill="none" stroke="${xrayColor}" stroke-width="1"/>
      ${vial.defect==='crack'?`<path d="M19 28 L24 42 L17 56 L22 72" stroke="rgba(255,80,80,0.9)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M24 42 L29 49" stroke="rgba(255,80,80,0.7)" stroke-width="1.5" fill="none"/>`:''}
      ${vial.defect==='chip'?`<path d="M30 18 L40 14 L41 20 Z" fill="rgba(255,80,80,0.85)" stroke="rgba(255,80,80,0.9)" stroke-width="1"/>
      <circle cx="36" cy="17" r="2" fill="rgba(255,80,80,0.7)"/>`:''}
    </svg>`;
    scanWrap.appendChild(svgEl);
    const scanLine = document.createElement('div');
    scanLine.className='scan-line';
    scanWrap.appendChild(scanLine);
    vis.appendChild(scanWrap);

    const statusEl = document.createElement('div');
    statusEl.style.cssText='font-size:11px;color:rgba(168,200,232,0.85);text-align:center;letter-spacing:.08em;';
    statusEl.textContent = vial.defect?'⚠ ANOMALY DETECTED':'✓ CLEAR';
    statusEl.style.color = vial.defect?'#fca5a5':'#86efac';
    vis.appendChild(statusEl);

  } else if(stn.type==='measure'){
    vis.style.flexDirection='column';vis.style.gap='10px';
    const isLength = CFG.inspection3Type==='length';
    const val = isLength ? vial.length : vial.weight;
    const target = isLength ? CFG.targetLength : CFG.targetWeight;
    const unit = isLength ? 'in' : 'oz';
    const tol = isLength ? 0.5 : 0.5;
    const ok = Math.abs(val-target) <= tol;
    const color = ok?'#22c55e':'#ef4444';
    const label = isLength ? 'LENGTH GAUGE' : 'WEIGHT SENSOR';
    const statusWord = ok?'WITHIN RANGE':(val>target?(isLength?'TOO LONG':'OVERWEIGHT'):(isLength?'TOO SHORT':'UNDERWEIGHT'));

    const scaleFace = document.createElement('div');
    scaleFace.style.cssText=`background:#0d1f33;border-radius:8px;padding:14px 20px;
      border:1.5px solid #2b6cb0;font-family:monospace;text-align:center;min-width:170px;`;
    scaleFace.innerHTML=`
      <div style="font-size:10px;color:#82a4d3;letter-spacing:.12em;margin-bottom:8px;">${label}</div>
      <div style="font-size:36px;font-weight:900;color:${color};letter-spacing:.04em;">${val.toFixed(1)}</div>
      <div style="font-size:11px;color:#82a4d3;margin-top:2px;">${unit} / target: ${target.toFixed(1)} ${unit}</div>
      <div style="margin-top:10px;font-size:12px;font-weight:700;color:${color};
        background:${ok?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)'};padding:4px 10px;border-radius:4px;">
        ${statusWord}
      </div>`;
    vis.appendChild(scaleFace);

    if(isLength){
      // Ruler-style gauge with a marker at the vial's actual length
      const rulerWrap = document.createElement('div');
      rulerWrap.style.cssText='width:180px;';
      const lo=3, hi=7;
      const pct = Math.min(100,Math.max(0,((val-lo)/(hi-lo))*100));
      const targetPct = ((target-lo)/(hi-lo))*100;
      rulerWrap.innerHTML=`
        <div style="position:relative;height:10px;background:#1a4a7a;border-radius:4px;overflow:visible;">
          <div style="position:absolute;left:${targetPct}%;top:-4px;width:2px;height:18px;background:#82a4d3;"></div>
          <div style="position:absolute;left:${pct}%;top:-3px;width:4px;height:16px;background:${color};border-radius:2px;transform:translateX(-2px);transition:left .5s;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:9px;color:#82a4d3;margin-top:4px;">
          <span>${lo}"</span><span>target ${target.toFixed(1)}"</span><span>${hi}"</span>
        </div>`;
      vis.appendChild(rulerWrap);
    } else {
      const barWrap = document.createElement('div');
      barWrap.style.cssText='width:160px;height:8px;background:#1a4a7a;border-radius:4px;overflow:hidden;';
      const pct = Math.min(100,Math.max(0,((val-8)/(target+3-8))*100));
      barWrap.innerHTML=`<div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width .5s;"></div>`;
      vis.appendChild(barWrap);
    }

  } else if(stn.type==='color'){
    // Color sensor
    vis.style.flexDirection='column';vis.style.gap='10px';
    const colorOK = vial.color==='correct';
    const vialFill = colorOK?'#2b6cb0':'#5b3a8a';
    const panel = document.createElement('div');
    panel.style.cssText='display:flex;align-items:center;gap:12px;';
    panel.innerHTML=`
      <div style="text-align:center">
        <div style="font-size:9px;color:#82a4d3;letter-spacing:.08em;margin-bottom:5px;">REFERENCE</div>
        <div style="width:40px;height:70px;background:#2b6cb0;border-radius:6px;border:2px solid #82a4d3;"></div>
      </div>
      <div style="color:#82a4d3;font-size:18px;">vs</div>
      <div style="text-align:center">
        <div style="font-size:9px;color:#82a4d3;letter-spacing:.08em;margin-bottom:5px;">SAMPLE</div>
        <div style="width:40px;height:70px;background:${vialFill};border-radius:6px;border:2px solid ${colorOK?'#82a4d3':'#ef4444'};"></div>
      </div>`;
    vis.appendChild(panel);
    const matchEl = document.createElement('div');
    matchEl.style.cssText=`font-size:12px;font-weight:700;padding:4px 12px;border-radius:6px;
      color:${colorOK?'#86efac':'#fca5a5'};
      background:${colorOK?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)'};`;
    matchEl.textContent = colorOK?'✓ COLOR MATCH':'✗ COLOR DEVIATION DETECTED';
    vis.appendChild(matchEl);
  }
}

/* ──────────────────────────────────────────────────
   STATION CHOICES
────────────────────────────────────────────────── */
function getChoices(stnIdx, vial){
  const stn = CFG.stations[stnIdx];
  if(stn.type==='color'){
    return [
      {label:'Color matches reference', icon:'✓', correct:vial.color==='correct', pass:true},
      {label:'Color deviation detected', icon:'✗', correct:vial.color!=='correct', pass:false},
    ];
  } else if(stn.type==='defect'){
    return [
      {label:'No structural defects', icon:'✓', correct:vial.defect===null, pass:true},
      {label:'Crack detected', icon:'⚡', correct:vial.defect==='crack', pass:false},
      {label:'Chip detected', icon:'🔺', correct:vial.defect==='chip', pass:false},
    ];
  } else { // measure
    const isLength = CFG.inspection3Type==='length';
    const val = isLength ? vial.length : vial.weight;
    const t = isLength ? CFG.targetLength : CFG.targetWeight;
    const unit = isLength ? 'in' : 'oz';
    const bigLabel = isLength ? 'Too long' : 'Overweight';
    const smallLabel = isLength ? 'Too short' : 'Underweight';
    return [
      {label:`Correct ${isLength?'length':'weight'} (${t.toFixed(1)} ${unit} target)`, icon:'✓', correct:Math.abs(val-t)<=0.5, pass:true},
      {label:bigLabel, icon:'▲', correct:val>t+0.5, pass:false},
      {label:smallLabel, icon:'▼', correct:val<t-0.5, pass:false},
    ];
  }
}

/* ──────────────────────────────────────────────────
   RUN STATION
────────────────────────────────────────────────── */
let dotInterval=null;

function startStation(){
  const stn = CFG.stations[state.stationIdx];
  document.getElementById('stn-name').textContent = `Station ${stn.num} — ${stn.name}`;
  document.getElementById('stn-display-title').textContent = stn.displayTitle;
  document.getElementById('result-question').textContent = stn.question;
  buildDots('stn-dots',6,8);
  if(dotInterval) clearInterval(dotInterval);
  dotInterval = animateDots('stn-dots','scan');
  renderVialAtStation();
}

function renderVialAtStation(){
  const stn = CFG.stations[state.stationIdx];
  const vials = state.vialsForStation;
  const pos = state.currentVialPos;

  document.getElementById('stn-prog').textContent =
    `Vial ${pos+1} of ${vials.length} | Station ${stn.num}`;

  if(pos>=vials.length){
    advanceStation();
    return;
  }

  const vial = vials[pos];
  renderStationVis(state.stationIdx, vial);

  // Choices
  const choices = getChoices(state.stationIdx, vial);
  const choicesEl = document.getElementById('result-choices');
  choicesEl.innerHTML='';
  choices.forEach(ch=>{
    const btn = document.createElement('button');
    btn.className='choice-btn';
    btn.innerHTML=`<span class="choice-icon">${ch.icon}</span>${ch.label}`;
    btn.onclick=()=>{
      if(state.answered) return;
      state.answered=true;
      if(ch.correct){
        btn.classList.add('correct-ans');
        setTimeout(()=>{
          state.answered=false;
          if(ch.pass){
            const isLastStation = state.stationIdx === CFG.stations.length-1;
            if(isLastStation){
              state.approvedVials.push({...vial});
              renderApprovedPanel();
            }
            // vial continues to the next station; array unchanged, so advance normally
            state.currentVialPos++;
          } else {
            // Rejected: splice removes this vial, so the next vial in
            // sequence shifts down into this same index -- don't advance.
            state.rejectedAll.push({...vial, stationNum:state.stationIdx+1});
            state.vialsForStation.splice(pos,1);
            renderQueue();
          }
          renderVialAtStation();
        },600);
      } else {
        btn.classList.add('wrong-ans');
        animateShake(document.getElementById('stn-vis'));
        setTimeout(()=>{
          btn.classList.remove('wrong-ans');
          state.answered=false;
        },700);
      }
    };
    choicesEl.appendChild(btn);
  });

  renderQueue();
  renderApprovedPanel();
}

function renderQueue(){
  const grid = document.getElementById('queue-grid');
  grid.innerHTML='';
  const vials = state.vialsForStation;
  vials.forEach((v,i)=>{
    const wrap = document.createElement('div');
    wrap.className='qvial' + (i===state.currentVialPos?' current':i<state.currentVialPos?' passed':'');
    wrap.innerHTML=miniVialSVG({defect:null,color:'correct',size:24})+
      `<div class="qvial-label">${v.id}</div>`;
    grid.appendChild(wrap);
  });
}

function renderApprovedPanel(){
  const goal = CFG.approvalGoal || 10;
  const count = state.approvedVials.length;
  document.getElementById('approved-count').innerHTML = `<span>${count}</span> / ${goal}`;

  const thisStation = state.stationIdx+1;
  const flaggedHere = state.rejectedAll.filter(v=>v.stationNum===thisStation).length;
  document.getElementById('flagged-line').textContent =
    `${flaggedHere} flagged at this station`;

  const grid = document.getElementById('pedestal-grid');
  grid.innerHTML='';
  for(let i=0;i<goal;i++){
    if(i < count){
      const wrap = document.createElement('div');
      wrap.className='pedestal-slot filled';
      wrap.innerHTML = miniVialSVG({defect:null,color:'correct',size:20});
      grid.appendChild(wrap);
    } else {
      const empty = document.createElement('div');
      empty.className='pedestal-slot empty';
      grid.appendChild(empty);
    }
  }
}

/* ──────────────────────────────────────────────────
   ADVANCE STATION
────────────────────────────────────────────────── */
function advanceStation(){
  if(dotInterval) clearInterval(dotInterval);
  state.stationIdx++;
  state.currentVialPos=0;
  state.answered=false;

  if(state.stationIdx>=CFG.stations.length){
    state.goodVials=[...state.vialsForStation];
    showDistribution();
    return;
  }

  // Remove passing vials from this station from vialsForStation
  // (already filtered in renderVialAtStation by splicing rejected ones)
  // Now show transition to next station
  const stn = CFG.stations[state.stationIdx];
  showStationTransition(stn,()=>{
    showScreen('s-station');
    startStation();
  });
}

/* ──────────────────────────────────────────────────
   DISTRIBUTION
────────────────────────────────────────────────── */
function showDistribution(){
  if(dotInterval) clearInterval(dotInterval);
  const rack = document.getElementById('dist-rack');
  rack.innerHTML='';
  state.goodVials.forEach(v=>{
    const slot = document.createElement('div');
    slot.className='dist-vial-slot';
    slot.innerHTML=vialSVG({defect:null,color:'correct',size:40})+
      `<div class="dist-vial-label">${v.id}</div>`;
    rack.appendChild(slot);
  });
  const rejected=state.rejectedAll.length;
  const good=state.goodVials.length;
  const total=state.vials.length;
  document.getElementById('dist-score').innerHTML=
    `<strong>${good}</strong> of ${total} vials passed all QC stations. ` +
    `<strong>${rejected}</strong> defective vial${rejected===1?'':'s'} removed.`;
  showScreen('s-dist');
}

/* ──────────────────────────────────────────────────
   BREAKTHROUGH
────────────────────────────────────────────────── */
function showBreakthrough(){
  const breakVials=document.getElementById('break-vials');
  breakVials.innerHTML='';
  state.goodVials.forEach(v=>{
    const wrap=document.createElement('div');
    wrap.className='break-vial-wrap';
    wrap.innerHTML=vialSVG({defect:null,color:'correct',size:36})+
      `<div class="break-vial-glow"></div>`;
    breakVials.appendChild(wrap);
  });
  showScreen('s-break');

  const audio=document.getElementById('vo-audio');
  const statusEl=document.getElementById('break-audio-status');
  const btn=document.getElementById('break-btn');

  audio.currentTime=0;
  audio.play().then(()=>{
    statusEl.textContent='▶ Playing voiceover…';
  }).catch(()=>{
    statusEl.textContent='🔇 Tap screen to play voiceover';
    document.getElementById('s-break').addEventListener('click',()=>audio.play(),{once:true});
  });

  audio.onended=()=>{
    statusEl.style.display='none';
    btn.classList.add('show');
  };
  audio.onerror=()=>{
    statusEl.textContent='';
    btn.classList.add('show');
  };
}

/* ──────────────────────────────────────────────────
   NAVIGATION WIRING
────────────────────────────────────────────────── */
document.getElementById('btn-start').onclick=()=>{
  initState();
  buildRack();
  showScreen('s-rack');
};

document.getElementById('btn-begin').onclick=()=>{
  const stn=CFG.stations[0];
  showStationTransition(stn,()=>{
    showScreen('s-station');
    startStation();
  });
};

document.getElementById('btn-dist').onclick=()=>showBreakthrough();

document.getElementById('break-btn').onclick=()=>{
  const audio=document.getElementById('vo-audio');
  audio.pause(); audio.currentTime=0;
  initState();
  showScreen('s-intro');
};

/* ──────────────────────────────────────────────────
   ADMIN MODE
────────────────────────────────────────────────── */
const adminGear=document.getElementById('admin-gear');
const adminOv=document.getElementById('admin-overlay');

adminGear.onclick=openAdminPin;
document.addEventListener('keydown',e=>{
  if(e.ctrlKey&&e.shiftKey&&(e.key==='A'||e.key==='a')){e.preventDefault();openAdminPin();}
});

function openAdminPin(){
  adminOv.classList.add('show');
  adminOv.innerHTML=`<div class="admin-pin-box">
    <h3>Admin Mode</h3>
    <div class="admin-pin-err" id="ap-err"></div>
    <input type="password" id="ap-in" inputmode="numeric" maxlength="8" placeholder="PIN" autofocus>
    <button id="ap-btn">Unlock</button>
  </div>`;
  document.getElementById('ap-btn').onclick=checkPin;
  document.getElementById('ap-in').onkeydown=e=>{if(e.key==='Enter')checkPin();};
  adminOv.onclick=e=>{if(e.target===adminOv)adminOv.classList.remove('show');};
  setTimeout(()=>document.getElementById('ap-in').focus(),50);
}

function checkPin(){
  if(document.getElementById('ap-in').value===CFG.adminPin) renderAdminPanel();
  else document.getElementById('ap-err').textContent='Incorrect PIN.';
}

function ea(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}

function renderAdminPanel(){
  adminOv.innerHTML=`<div class="admin-panel">
    <h2>Admin Panel — Room 5</h2>
    <p class="note">Edit game text, voiceover script, and vial defect data. "Apply" previews instantly. "Download config.json" saves your changes — replace the file in your repo.</p>
    <div class="admin-sec"><h4>Game Text</h4>
      <div class="admin-field"><label>Room label</label><input type="text" id="af-rl" value="${ea(CFG.roomLabel)}"></div>
      <div class="admin-field"><label>Game title</label><input type="text" id="af-gt" value="${ea(CFG.gameTitle)}"></div>
      <div class="admin-field"><label>Intro description</label><textarea id="af-is">${ea(CFG.introSub)}</textarea></div>
      <div class="admin-field"><label>Distribution sub-text</label><textarea id="af-ds">${ea(CFG.distSub)}</textarea></div>
      <div class="admin-field"><label>Breakthrough title</label><input type="text" id="af-bt" value="${ea(CFG.breakTitle)}"></div>
      <div class="admin-field"><label>Voiceover script (shown on screen)</label><textarea id="af-bs">${ea(CFG.breakScript)}</textarea></div>
    </div>
    <div class="admin-sec"><h4>QC Parameters</h4>
      <div class="admin-field">
        <label>Inspection 3 type</label>
        <select id="af-i3type" style="width:100%;padding:7px 9px;font-size:13px;border:1px solid #ddd;border-radius:5px;font-family:var(--font);">
          <option value="length" ${CFG.inspection3Type==='length'?'selected':''}>Length (inches)</option>
          <option value="weight" ${CFG.inspection3Type==='weight'?'selected':''}>Weight (oz)</option>
        </select>
      </div>
      <div class="admin-field"><label>Target length (inches)</label><input type="text" id="af-tl" value="${CFG.targetLength}"></div>
      <div class="admin-field"><label>Target weight (oz)</label><input type="text" id="af-tw" value="${CFG.targetWeight}"></div>
      <p class="note" style="margin:4px 0 0 0;">Switching this dropdown updates Station 3's name, description, and on-screen labels automatically — no need to edit those separately. Each vial already has both a length and a weight value in the data, so switching doesn't require re-entering vial data.</p>
    </div>
    <div class="admin-sec"><h4>Admin Access</h4>
      <div class="admin-field"><label>Admin PIN</label><input type="text" id="af-pin" value="${ea(CFG.adminPin)}"></div>
    </div>
    <div class="admin-actions">
      <button class="btn-aa" id="aa-apply">Apply &amp; Preview</button>
      <button class="btn-ad" id="aa-dl">Download config.json</button>
      <button class="btn-ac" id="aa-close">Close</button>
    </div>
  </div>`;
  document.getElementById('aa-apply').onclick=applyAdmin;
  document.getElementById('aa-dl').onclick=()=>{applyAdmin();downloadConfig();};
  document.getElementById('aa-close').onclick=()=>adminOv.classList.remove('show');
}

function applyAdmin(){
  CFG.roomLabel=document.getElementById('af-rl').value;
  CFG.gameTitle=document.getElementById('af-gt').value;
  CFG.introSub=document.getElementById('af-is').value;
  CFG.distSub=document.getElementById('af-ds').value;
  CFG.breakTitle=document.getElementById('af-bt').value;
  CFG.breakScript=document.getElementById('af-bs').value;
  CFG.targetLength=parseFloat(document.getElementById('af-tl').value)||5.0;
  CFG.targetWeight=parseFloat(document.getElementById('af-tw').value)||10.0;
  CFG.inspection3Type=document.getElementById('af-i3type').value;
  CFG.adminPin=document.getElementById('af-pin').value;
  syncMeasureStationLabels();
  applyConfig();
}

// Keeps Station 3's name/icon/description/display-title/question in
// sync with whichever measurement type (length or weight) is active,
// so nothing has to be hand-edited separately when the type changes.
function syncMeasureStationLabels(){
  const stn = CFG.stations.find(s=>s.type==='measure');
  if(!stn) return;
  if(CFG.inspection3Type==='length'){
    stn.name='Length';
    stn.icon='📏';
    stn.desc=`Precision gauge verifies each vial is exactly ${CFG.targetLength.toFixed(1)} inches long.`;
    stn.displayTitle='Precision Gauge';
    stn.question='What does the length reading show?';
  } else {
    stn.name='Weight';
    stn.icon='⚖️';
    stn.desc=`Precision scale verifies each vial is exactly ${CFG.targetWeight.toFixed(1)} oz.`;
    stn.displayTitle='Precision Scale';
    stn.question='What does the weight reading show?';
  }
}

function downloadConfig(){
  const json=JSON.stringify(CFG,null,2);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='config.json';
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
