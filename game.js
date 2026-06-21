/* ===================================================================
   SIGNAL HUNTER — an interactive data-analyst portfolio game
   Each level is a real "clean the data" interaction that unlocks
   an insight about Rishabh Singh.
   =================================================================== */

const C = {
  void:'#070B14', panel:'#0f1626', cyan:'#22D3EE', lime:'#A3E635',
  amber:'#FBBF24', noise:'#475569', noiseDim:'#334155', text:'#E2E8F0',
  dim:'#8295ad', line:'#1c2840'
};

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
let W, H, DPR = Math.min(window.devicePixelRatio || 1, 2);

function resize(){
  W = canvas.offsetWidth; H = canvas.offsetHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize', ()=>{ resize(); if(currentLevel) currentLevel.onResize && currentLevel.onResize(); });

/* ---------- DOM refs ---------- */
const el = {
  intro: document.getElementById('intro'),
  final: document.getElementById('final'),
  prompt: document.getElementById('prompt'),
  pTag: document.getElementById('pTag'),
  pTitle: document.getElementById('pTitle'),
  pHint: document.getElementById('pHint'),
  insight: document.getElementById('insight'),
  insightH: document.getElementById('insightH'),
  insightP: document.getElementById('insightP'),
  insightNext: document.getElementById('insightNext'),
  toast: document.getElementById('toast'),
  dots: document.getElementById('levelDots'),
  muteBtn: document.getElementById('muteBtn'),
};

/* ---------- Insight content ---------- */
const INSIGHTS = [
  { tag:'The headline', h:'4+ years turning chaos into clarity',
    p:'Senior Data Analyst who takes messy, real-world data and hands back decisions people actually trust. That outlier you just removed? That\'s the instinct.' },
  { tag:'By the numbers', h:'60+ stakeholders · 35% faster · same-day reporting',
    p:'Built and governed 15+ dashboards used across the business, standardised the metrics, and cut report turnaround from three days to same-day.' },
  { tag:'Banking · Risk', h:'Credit & risk monitoring for a US bank',
    p:'Connected the dots in lending data: repayment patterns, risk indicators, account performance. Found where manual checks could become automated controls.' },
  { tag:'Multi-domain', h:'Healthcare · Retail · Research · Fintech',
    p:'The domain changes, the instinct stays. Each cluster you sorted is a field I\'ve worked in: hospital data, sales and inventory, wealth management.' },
  { tag:'Research · Dissertation', h:'Found a pollution episode hidden in the noise',
    p:'My MSc dissertation analysed a city-wide PM2.5 sensor network, flagged faulty sensors, and surfaced a real May-2024 pollution event buried in noisy data. Exactly what you just did.' },
];

const TOOLS = ["SQL","Python","R","Power BI","Tableau","Looker","dbt","Databricks","Snowflake","Oracle","Git","GCP","pandas","scikit-learn","DAX"];

/* ---------- State ---------- */
let levelIdx = 0;
let currentLevel = null;
let collected = [];
const TOTAL_LEVELS = INSIGHTS.length;

/* ===================================================================
   AUDIO ENGINE v2 — Web Audio step sequencer
   Clear melodic pulse: C pentatonic arpeggio, bass anchor, echo tail.
   Feels like calm puzzle-game music, not a drone.
   =================================================================== */
let audioCtx = null;
let masterGain = null;
let audioMuted = false;
let _delay = null, _delayFb = null, _delayMix = null;
let _seqTimer = null, _nextNote = 0, _step = 0;
const MASTER_VOL = 0.15;

// 78 BPM, 8th-note grid
const _BPM  = 78;
const _S    = 60 / _BPM / 2;   // one 8th note in seconds (~0.385 s)
const _NSTEPS = 16;
const _AHEAD  = 0.12;           // schedule this far ahead
const _TICK   = 22;             // scheduler poll interval ms

// C pentatonic: C4 E4 G4 A4 C5
const _P = [261.63, 329.63, 392.00, 440.00, 523.25];
// 16-step melody pattern. -1 = rest. Ascending arc that resolves cleanly.
const _MEL = [0,-1,2,3, 4,-1,2,-1, 1,2,-1,3, 4,2,0,-1];
// Bass hits: step index → frequency. C3 on beat 1, G3 on beat 3.
const _BASS = {0:130.81, 8:196.00};

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Soft limiter keeps the mix clean
  const lim = audioCtx.createDynamicsCompressor();
  lim.threshold.value = -8; lim.knee.value = 4;
  lim.ratio.value = 12; lim.attack.value = 0.001; lim.release.value = 0.12;

  masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(MASTER_VOL, audioCtx.currentTime);
  lim.connect(masterGain);
  masterGain.connect(audioCtx.destination);
  audioCtx._bus = lim;

  // Dotted-8th delay (1.5 steps) adds groove and spaciousness
  _delay   = audioCtx.createDelay(2.0);
  _delay.delayTime.value = _S * 1.5;
  _delayFb = audioCtx.createGain(); _delayFb.gain.value = 0.28;
  _delayMix= audioCtx.createGain(); _delayMix.gain.value = 0.17;
  _delay.connect(_delayFb); _delayFb.connect(_delay);   // feedback loop
  _delay.connect(_delayMix); _delayMix.connect(lim);    // wet output

  _nextNote = audioCtx.currentTime + 0.05;
  _step = 0;
  _seqTick();
}

function _melNote(freq, t, durSteps, vol) {
  const osc  = audioCtx.createOscillator();
  const hi   = audioCtx.createOscillator(); // octave harmonic for bell brightness
  const env  = audioCtx.createGain();
  const filt = audioCtx.createBiquadFilter();

  filt.type = 'lowpass'; filt.frequency.value = 3200; filt.Q.value = 0.5;
  osc.type = 'triangle'; osc.frequency.value = freq;
  hi.type  = 'sine';     hi.frequency.value  = freq * 2;
  const hiG = audioCtx.createGain(); hiG.gain.value = 0.11;

  const dur = _S * durSteps;
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(vol, t + 0.007);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  hi.connect(hiG); hiG.connect(filt);
  osc.connect(filt); filt.connect(env);
  env.connect(audioCtx._bus);  // dry
  env.connect(_delay);          // into echo send

  osc.start(t); hi.start(t);
  osc.stop(t + dur + 0.04); hi.stop(t + dur + 0.04);
}

function _bassNote(freq, t) {
  const osc  = audioCtx.createOscillator();
  const env  = audioCtx.createGain();
  const filt = audioCtx.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = 300; filt.Q.value = 0.4;
  osc.type = 'sine'; osc.frequency.value = freq;
  const dur = _S * 3.6;
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.18, t + 0.016);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(filt); filt.connect(env); env.connect(audioCtx._bus);
  osc.start(t); osc.stop(t + dur + 0.04);
}

function _schedStep(step, t) {
  if (audioMuted) return;
  const ni = _MEL[step];
  if (ni >= 0) _melNote(_P[ni], t, 1.8, 0.25);
  if (_BASS[step] !== undefined) _bassNote(_BASS[step], t);
}

function _seqTick() {
  while (_nextNote < audioCtx.currentTime + _AHEAD) {
    _schedStep(_step, _nextNote);
    _nextNote += _S;
    _step = (_step + 1) % _NSTEPS;
  }
  _seqTimer = setTimeout(_seqTick, _TICK);
}

function playInsightSound() {
  if (!audioCtx || audioMuted) return;
  const now = audioCtx.currentTime;
  // Bright ascending bell chord — C5 E5 G5, inharmonic partial gives shimmer
  [[523.25,0],[659.25,0.06],[783.99,0.13]].forEach(([f,dt])=>{
    const t  = now + dt;
    const o1 = audioCtx.createOscillator();
    const o2 = audioCtx.createOscillator(); // bell partial at 2.76×
    const g2 = audioCtx.createGain(); g2.gain.value = 0.14;
    const env= audioCtx.createGain();
    o1.type='sine'; o1.frequency.value=f;
    o2.type='sine'; o2.frequency.value=f*2.76;
    env.gain.setValueAtTime(0,t);
    env.gain.linearRampToValueAtTime(0.27,t+0.004);
    env.gain.exponentialRampToValueAtTime(0.0001,t+1.15);
    o1.connect(env); o2.connect(g2); g2.connect(env);
    env.connect(masterGain);
    o1.start(t); o2.start(t); o1.stop(t+1.2); o2.stop(t+1.2);
  });
}

function setMute(muted) {
  audioMuted = muted;
  if (masterGain && audioCtx) {
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, audioCtx.currentTime, 0.04);
  }
  el.muteBtn.textContent = muted ? '♪ off' : '♪ on';
  el.muteBtn.classList.toggle('muted', muted);
}

el.muteBtn.addEventListener('click', () => setMute(!audioMuted));

/* ===================================================================
   INSIGHT POPUP — animated reveal
   Canvas particle burst + CSS animation on the card itself.
   =================================================================== */
let particles = [];

function spawnParticles(cx, cy) {
  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.4;
    const speed = 1.4 + Math.random() * 3.2;
    const cols = ['rgba(200,218,235,', 'rgba(210,225,240,', 'rgba(226,234,244,'];
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, decay: 0.022 + Math.random() * 0.018,
      r: 1.5 + Math.random() * 2.5,
      col: cols[Math.floor(Math.random() * cols.length)],
    });
  }
}

function updateParticles() {
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.04; // gentle gravity
    p.life -= p.decay;
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, 7);
    ctx.fillStyle = p.col + p.life.toFixed(2) + ')';
    ctx.fill();
  }
}

/* ---------- Insight text animations ---------- */
function typewriterTitle(elH, text, onDone) {
  const numMatch = text.match(/^(\d+)(\+?%?)/);
  if (numMatch) {
    // Count up the leading number, then the rest is already present
    const target = parseInt(numMatch[1]);
    const suffix = numMatch[2];
    const rest   = text.slice(numMatch[0].length);
    let cur = 0;
    const STEPS = 32;
    const inc = () => {
      cur = Math.min(target, cur + Math.max(1, Math.ceil(target / STEPS)));
      elH.textContent = cur + suffix + rest;
      if (cur < target) requestAnimationFrame(inc);
      else setTimeout(() => onDone && onDone(), 80);
    };
    requestAnimationFrame(inc);
  } else {
    // Typewriter with blinking cursor, target ~600 ms total
    const chars = [...text];
    const PER = Math.max(14, Math.min(38, 600 / chars.length));
    elH.innerHTML = '<span class="tw-t"></span><span class="tw-cur">_</span>';
    const tw = elH.querySelector('.tw-t');
    const cur = elH.querySelector('.tw-cur');
    let i = 0;
    const tick = () => {
      tw.textContent = chars.slice(0, i).join('');
      i++;
      if (i <= chars.length) setTimeout(tick, PER);
      else setTimeout(() => { cur.style.display = 'none'; onDone && onDone(); }, 220);
    };
    tick();
  }
}

function revealBodyLines(elP, text) {
  // Split on sentence boundaries, reveal each line with a staggered fade
  const parts = text.split('. ');
  const sents = parts.map((s, i) => i < parts.length - 1 ? s + '.' : s);
  elP.innerHTML = sents.map(s => `<span class="body-line">${s}</span>`).join(' ');
  sents.forEach((_, i) =>
    setTimeout(() => elP.querySelectorAll('.body-line')[i]?.classList.add('in'), i * 140)
  );
}

/* ---------- Build HUD dots ---------- */
for(let i=0;i<TOTAL_LEVELS;i++){
  const d=document.createElement('span'); d.className='ld'; el.dots.appendChild(d);
}
function updateDots(){
  [...el.dots.children].forEach((d,i)=>{
    d.className='ld'+(i<levelIdx?' done':i===levelIdx?' active':'');
  });
}

/* ---------- Helpers ---------- */
function toast(msg){
  el.toast.textContent='> '+msg; el.toast.classList.add('show');
  clearTimeout(el.toast._t); el.toast._t=setTimeout(()=>el.toast.classList.remove('show'),1600);
}
function showPrompt(tag,title,hint){
  el.pTag.textContent=tag; el.pTitle.textContent=title; el.pHint.innerHTML=hint;
  el.prompt.classList.remove('hidden'); el.prompt.style.opacity='1';
}
function hidePrompt(){ el.prompt.style.opacity='0'; }
function lerp(a,b,t){return a+(b-a)*t;}
function dist(ax,ay,bx,by){const dx=ax-bx,dy=ay-by;return Math.sqrt(dx*dx+dy*dy);}
function rand(a,b){return a+Math.random()*(b-a);}

/* ---------- Pointer plumbing ---------- */
let pointer={x:0,y:0,down:false};
function pos(e){
  const r=canvas.getBoundingClientRect();
  const t=e.touches?e.touches[0]:e;
  return {x:t.clientX-r.left, y:t.clientY-r.top};
}
canvas.addEventListener('mousedown',e=>{const p=pos(e);pointer={x:p.x,y:p.y,down:true};currentLevel&&currentLevel.onDown&&currentLevel.onDown(p.x,p.y);});
canvas.addEventListener('mousemove',e=>{const p=pos(e);pointer.x=p.x;pointer.y=p.y;currentLevel&&currentLevel.onMove&&currentLevel.onMove(p.x,p.y);});
window.addEventListener('mouseup',()=>{pointer.down=false;currentLevel&&currentLevel.onUp&&currentLevel.onUp();});
canvas.addEventListener('touchstart',e=>{e.preventDefault();const p=pos(e);pointer={x:p.x,y:p.y,down:true};currentLevel&&currentLevel.onDown&&currentLevel.onDown(p.x,p.y);},{passive:false});
canvas.addEventListener('touchmove',e=>{e.preventDefault();const p=pos(e);pointer.x=p.x;pointer.y=p.y;currentLevel&&currentLevel.onMove&&currentLevel.onMove(p.x,p.y);},{passive:false});
window.addEventListener('touchend',()=>{pointer.down=false;currentLevel&&currentLevel.onUp&&currentLevel.onUp();});

/* ===================================================================
   LEVEL 1 — FILTER THE NOISE
   One red outlier visually separated from the clean cluster.
   Click the single obvious outlier to complete the level.
   =================================================================== */
function Level1(){
  const pts=[]; const cx=W/2, cy=H/2;
  const cleanN=44;
  // One outlier, placed clearly outside the cluster
  const angle = rand(0, Math.PI*2);
  const odist = rand(260, 300);
  const ox = cx + Math.cos(angle)*odist;
  const oy = cy + Math.sin(angle)*odist;
  const outlier = {x: Math.max(50, Math.min(W-50, ox)), y: Math.max(90, Math.min(H-60, oy)),
    outlier:true, r:rand(4,6), pulse:rand(0,6)};

  for(let i=0;i<cleanN;i++){
    pts.push({x:cx+rand(-140,140),y:cy+rand(-80,80),outlier:false,r:rand(2.5,4)});
  }
  pts.push(outlier);

  let done=false;
  this.onResize=()=>{};
  this.onDown=(mx,my)=>{
    if(done) return;
    if(dist(mx,my,outlier.x,outlier.y)<22){
      done=true; toast('outlier removed');
      setTimeout(()=>finishLevel(),420);
      return;
    }
    for(const p of pts){
      if(!p.outlier&&dist(mx,my,p.x,p.y)<14){ toast('that\'s signal, keep it'); return; }
    }
  };
  this.draw=(t)=>{
    const hot = dist(pointer.x,pointer.y,outlier.x,outlier.y)<22;
    for(const p of pts){
      ctx.beginPath();
      if(p.outlier){
        const pulse=0.5+0.5*Math.sin(t*0.004+p.pulse);
        ctx.arc(p.x,p.y,p.r+pulse*2,0,7);
        ctx.fillStyle = hot?'rgba(251,191,36,0.95)':'rgba(239,68,68,'+(0.6+pulse*0.3)+')';
        ctx.fill();
        ctx.beginPath();ctx.arc(p.x,p.y,22,0,7);
        ctx.strokeStyle=hot?'rgba(251,191,36,0.7)':'rgba(239,68,68,'+(0.25+pulse*0.2)+')';
        ctx.lineWidth=1.5;ctx.stroke();
      }else{
        ctx.arc(p.x,p.y,p.r,0,7);
        ctx.fillStyle='rgba(34,211,238,0.65)';
        ctx.fill();
      }
    }
    // connecting halo line from cluster centroid to outlier
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(outlier.x,outlier.y);
    ctx.strokeStyle='rgba(239,68,68,0.12)';ctx.lineWidth=1;ctx.setLineDash([4,8]);ctx.stroke();ctx.setLineDash([]);
  };
  showPrompt('Level 1 · Filter','The data is full of noise.','Click the <span class="key">red outlier</span> to remove it. Keep the signal.');
}

/* ===================================================================
   LEVEL 2 — SORT THE BARS
   One bar is clearly the tallest (the standout metric).
   Click it to "identify the key metric" and complete the level.
   =================================================================== */
function Level2(){
  const n=6;
  const vals=[2,4,1,3,6,2]; // position 4 (val=6) is the obvious peak
  const targetIdx=4;
  const bw=Math.min(74,(W-120)/n-16);
  const gap=16; const totalW=n*(bw+gap)-gap; const startX=(W-totalW)/2;
  const baseY=H-100; const maxH=H*0.44;
  const bars=[];
  for(let i=0;i<n;i++){
    bars.push({val:vals[i],x:startX+i*(bw+gap),h:(vals[i]/6)*maxH,w:bw});
  }
  const target=bars[targetIdx];
  let done=false;
  this.onResize=()=>{};
  this.onDown=(mx,my)=>{
    if(done) return;
    // check clicked bar
    for(let i=0;i<bars.length;i++){
      const b=bars[i];
      if(mx>b.x&&mx<b.x+b.w&&my>baseY-b.h&&my<baseY){
        if(i===targetIdx){
          done=true; toast('peak metric identified');
          setTimeout(()=>finishLevel(),420);
        } else {
          toast('not the highest value');
        }
        return;
      }
    }
  };
  this.draw=(t)=>{
    const hot=bars.some((b,i)=>i===targetIdx&&pointer.x>b.x&&pointer.x<b.x+b.w&&pointer.y>baseY-b.h&&pointer.y<baseY);
    bars.forEach((b,i)=>{
      const isTarget=i===targetIdx;
      const pulse=isTarget?(0.5+0.5*Math.sin(t*0.003)):0;
      const grad=ctx.createLinearGradient(0,baseY-b.h,0,baseY);
      if(isTarget){
        grad.addColorStop(0,hot?'rgba(251,191,36,0.95)':'rgba(34,211,238,'+(0.75+pulse*0.2)+')');
        grad.addColorStop(1,'rgba(34,211,238,0.4)');
        ctx.shadowColor='rgba(34,211,238,0.5)'; ctx.shadowBlur=isTarget?14:0;
      } else {
        grad.addColorStop(0,'rgba(71,85,105,0.75)');
        grad.addColorStop(1,'rgba(51,65,85,0.45)');
        ctx.shadowBlur=0;
      }
      ctx.fillStyle=grad;
      roundRect(b.x,baseY-b.h,b.w,b.h,6);ctx.fill();
      ctx.shadowBlur=0;
      // value label on target
      if(isTarget){
        ctx.fillStyle=hot?'rgba(251,191,36,1)':'rgba(34,211,238,0.9)';
        ctx.font='700 13px "JetBrains Mono",monospace';ctx.textAlign='center';
        ctx.fillText('▲', b.x+b.w/2, baseY-b.h-10);
        ctx.textAlign='left';
      }
    });
    ctx.strokeStyle='rgba(28,40,64,1)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(startX-20,baseY+1);ctx.lineTo(startX+totalW+20,baseY+1);ctx.stroke();
  };
  this.onMove=()=>{};this.onUp=()=>{};
  showPrompt('Level 2 · Sort','Unsorted bars hide the story.','Click the <span class="key">tallest bar</span> to identify the key metric.');
}
function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

/* ===================================================================
   LEVEL 3 — CONNECT THE POINTS
   A trend line with one visibly broken/misaligned point.
   Click the outlier point that breaks the trend.
   =================================================================== */
function Level3(){
  const n=9; const pts=[];
  const startX=W*0.1, endX=W*0.9, midY=H*0.52;
  // Pick one index to be the rogue point (not first or last)
  const rogueIdx = 4;
  for(let i=0;i<n;i++){
    const x=lerp(startX,endX,i/(n-1));
    const y=midY - (i/(n-1))*H*0.18 + rand(-10,10); // gentle upward trend
    pts.push({x,y,base:y,rogue:false});
  }
  // Displace the rogue point significantly off-trend
  pts[rogueIdx].y = midY + H*0.18 + rand(-10,10);
  pts[rogueIdx].rogue = true;
  const rogue = pts[rogueIdx];
  let done=false;
  this.onResize=()=>{};
  this.onDown=(mx,my)=>{
    if(done) return;
    if(dist(mx,my,rogue.x,rogue.y)<22){
      done=true; toast('broken point found');
      setTimeout(()=>finishLevel(),420);
      return;
    }
    for(const p of pts){
      if(!p.rogue&&dist(mx,my,p.x,p.y)<18){ toast('that follows the trend'); return; }
    }
  };
  this.draw=(t)=>{
    // Draw trend line excluding rogue
    ctx.beginPath();
    pts.forEach((p,i)=>{ if(!p.rogue){ i===0||pts[i-1].rogue?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y); }});
    ctx.strokeStyle='rgba(34,211,238,0.5)';ctx.lineWidth=2;ctx.stroke();

    // Dashed connector showing where rogue should be
    const prev=pts[rogueIdx-1], next=pts[rogueIdx+1];
    ctx.beginPath();ctx.moveTo(prev.x,prev.y);ctx.lineTo(next.x,next.y);
    ctx.strokeStyle='rgba(34,211,238,0.18)';ctx.lineWidth=1.5;ctx.setLineDash([5,7]);ctx.stroke();ctx.setLineDash([]);

    pts.forEach((p)=>{
      ctx.beginPath();
      const hot=p.rogue&&dist(pointer.x,pointer.y,p.x,p.y)<22;
      if(p.rogue){
        const pulse=0.5+0.5*Math.sin(t*0.004);
        ctx.arc(p.x,p.y,5+pulse*2,0,7);
        ctx.fillStyle=hot?'rgba(251,191,36,0.95)':'rgba(239,68,68,'+(0.65+pulse*0.25)+')';
        ctx.fill();
        ctx.beginPath();ctx.arc(p.x,p.y,18+pulse*3,0,7);
        ctx.strokeStyle=hot?'rgba(251,191,36,0.5)':'rgba(239,68,68,'+(0.22+pulse*0.15)+')';
        ctx.lineWidth=1.5;ctx.stroke();
        // drop line to where it should be
        const expectedY=lerp(prev.y,next.y,0.5);
        ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,expectedY);
        ctx.strokeStyle='rgba(239,68,68,0.2)';ctx.lineWidth=1;ctx.setLineDash([3,5]);ctx.stroke();ctx.setLineDash([]);
      } else {
        ctx.arc(p.x,p.y,4,0,7);
        ctx.fillStyle='rgba(34,211,238,0.75)';ctx.fill();
      }
    });
  };
  showPrompt('Level 3 · Connect','Scattered points, no story yet.','Click the <span class="key">point breaking the trend</span> to fix the line.');
}

/* ===================================================================
   LEVEL 4 — CLUSTER THE DOTS
   Four coloured groups of dots, each with one impostor dot of the
   wrong colour mixed in. Click the single impostor.
   =================================================================== */
function Level4(){
  const zoneCols=['#22D3EE','#A3E635','#FBBF24','#f472b6'];
  const zoneNames=['Healthcare','Retail','Research','Fintech'];
  const dots=[];
  const perGroup=7; // dots per colour group
  const cx=W/2, cy=H/2;
  // Place groups in four quadrant-ish areas
  const centres=[
    {x:cx*0.52,y:cy*0.58},{x:cx*1.48,y:cy*0.58},
    {x:cx*0.52,y:cy*1.42},{x:cx*1.48,y:cy*1.42},
  ];

  // Pick one group and one dot within it to be the impostor
  const impostorGroup = Math.floor(rand(0,4));
  const impostorSlot  = Math.floor(rand(1,perGroup)); // not index 0 (keep at least one correct)
  const impostorColor = zoneCols[(impostorGroup+1)%4];

  centres.forEach((ctr,gi)=>{
    for(let k=0;k<perGroup;k++){
      const isImpostor = gi===impostorGroup && k===impostorSlot;
      dots.push({
        x: ctr.x + rand(-70,70),
        y: ctr.y + rand(-46,46),
        col: isImpostor ? impostorColor : zoneCols[gi],
        impostor: isImpostor,
        r: 6,
        pulse: rand(0,6),
      });
    }
  });

  const impostorDot = dots.find(d=>d.impostor);
  let done=false;
  this.onResize=()=>{};
  this.onDown=(mx,my)=>{
    if(done) return;
    // Check impostor first
    if(dist(mx,my,impostorDot.x,impostorDot.y)<18){
      done=true; toast('impostor found: wrong cluster');
      setTimeout(()=>finishLevel(),420);
      return;
    }
    for(const d of dots){
      if(!d.impostor&&dist(mx,my,d.x,d.y)<14){ toast('that one belongs here'); return; }
    }
  };
  this.draw=(t)=>{
    // Draw faint group labels
    centres.forEach((ctr,gi)=>{
      ctx.fillStyle=hexA(zoneCols[gi],0.22);
      ctx.font='600 12px "JetBrains Mono",monospace';ctx.textAlign='center';
      ctx.fillText(zoneNames[gi], ctr.x, ctr.y - 60);
    });
    ctx.textAlign='left';
    dots.forEach(d=>{
      const hot=d.impostor&&dist(pointer.x,pointer.y,d.x,d.y)<18;
      const pulse=d.impostor?(0.5+0.5*Math.sin(t*0.004+d.pulse)):0;
      ctx.beginPath();
      ctx.arc(d.x,d.y,d.r+(d.impostor?pulse*2:0),0,7);
      ctx.fillStyle=hexA(d.col, hot?0.95:d.impostor?0.85:0.78);ctx.fill();
      if(d.impostor){
        ctx.beginPath();ctx.arc(d.x,d.y,16+pulse*3,0,7);
        ctx.strokeStyle=hexA(d.col,hot?0.6:0.3+pulse*0.2);ctx.lineWidth=1.5;ctx.stroke();
      }
    });
  };
  showPrompt('Level 4 · Cluster','Mixed signals from every domain.','Click the <span class="key">dot that doesn\'t belong</span> in its group.');
}
function hexA(hex,a){const n=parseInt(hex.slice(1),16);return'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';}

/* ===================================================================
   LEVEL 5 — SPOT THE ANOMALY  (unchanged mechanic — already perfect)
   =================================================================== */
function Level5(){
  const n=64; const pts=[]; const baseY=H*0.58;
  const startX=W*0.1, endX=W*0.9;
  let anomalyIdx=Math.floor(rand(n*0.45,n*0.7));
  for(let i=0;i<n;i++){
    const x=lerp(startX,endX,i/(n-1));
    const y=baseY+Math.sin(i*0.5)*16+rand(-8,8);
    pts.push({x,y,base:y,i});
  }
  pts[anomalyIdx].anom=true;
  let done=false, t0=performance.now();
  this.onDown=(mx,my)=>{
    const a=pts[anomalyIdx];
    if(dist(mx,my,a.x,a.y)<22){
      if(!done){done=true;toast('anomaly found');setTimeout(()=>finishLevel(),520);}
    } else {
      for(const p of pts){ if(!p.anom&&dist(mx,my,p.x,p.y)<16){ toast('that\'s normal variation'); return; } }
    }
  };
  this.draw=(t)=>{
    const a=pts[anomalyIdx];
    const spike=Math.min(1,(t-t0)/1400);
    a.y=a.base-spike*H*0.22;
    ctx.beginPath();
    pts.forEach((p,i)=>{ i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y); });
    ctx.strokeStyle='rgba(71,85,105,0.7)';ctx.lineWidth=1.5;ctx.stroke();
    pts.forEach(p=>{
      ctx.beginPath();
      if(p.anom){
        const pulse=0.5+0.5*Math.sin(t*0.004);
        const hot=dist(pointer.x,pointer.y,p.x,p.y)<22;
        ctx.arc(p.x,p.y,5+pulse*2,0,7);
        ctx.fillStyle=hot?'rgba(251,191,36,1)':'rgba(34,211,238,'+(0.7+pulse*0.3)+')';
        ctx.fill();
        ctx.beginPath();ctx.arc(p.x,p.y,16+pulse*4,0,7);
        ctx.strokeStyle='rgba(34,211,238,'+(0.3+pulse*0.3)+')';ctx.lineWidth=1.5;ctx.stroke();
      }else{
        ctx.arc(p.x,p.y,2.5,0,7);ctx.fillStyle='rgba(71,85,105,0.8)';ctx.fill();
      }
    });
  };
  this.onResize=()=>{};
  showPrompt('Level 5 · Detect','Hundreds of readings. One matters.','Find and <span class="key">click the anomaly</span> breaking the pattern.');
}

/* ===================================================================
   Level orchestration
   =================================================================== */
const LEVELS=[Level1,Level2,Level3,Level4,Level5];

function startLevel(i){
  levelIdx=i; updateDots();
  currentLevel=new LEVELS[i]();
}

/* ---------- Level transition: data-stream ---------- */
function levelTransition(label, onDone) {
  particles.length = 0;
  const t0   = performance.now();
  const DUR  = 1500;
  const cx   = W / 2, cy = H / 2;

  // Floaters: mostly digits, a sprinkle of data symbols
  const POOL  = '01234567890123456789012345678901234567890123456789%NaN∑';
  const chars = POOL.split('');
  const floaters = Array.from({length: 62}, () => ({
    x:      Math.random() * W,
    y:      Math.random() * H * 1.15 + H * 0.05, // start anywhere on-screen or just below
    ch:     chars[Math.floor(Math.random() * chars.length)],
    spd:    2.2 + Math.random() * 8.2,            // wide range → depth illusion
    sz:     10 + Math.random() * 14,
    alpha:  0.05 + Math.random() * 0.28,
    isCyan: Math.random() < 0.11,
  }));

  const fSize = Math.min(Math.max(24, W * 0.036), 36);
  const eOut  = x => 1 - Math.pow(1 - x, 3); // easeOutCubic
  const eIn   = x => x * x * x;               // easeInCubic

  // Center label travels bottom → centre → top
  function labelY(t) {
    if (t < 0.33) return cy + H * 0.40 * (1 - eOut(t / 0.33));           // rise in
    if (t < 0.66) return cy + Math.sin((t - 0.33) / 0.33 * Math.PI * 3) * 3.5; // float at centre
    return cy - H * 0.44 * eIn((t - 0.66) / 0.34);                       // exit up
  }
  function labelAlpha(t) {
    if (t < 0.09) return t / 0.09;
    if (t < 0.60) return 1;
    if (t < 0.72) return 1 - (t - 0.60) / 0.12;
    return 0;
  }

  function frame(now) {
    const t = Math.min(1, (now - t0) / DUR);

    ctx.fillStyle = 'rgba(7,11,20,0.90)';
    ctx.fillRect(0, 0, W, H);

    // Floating characters — move upward, wrap when off-top
    ctx.textAlign = 'left';
    floaters.forEach(f => {
      f.y -= f.spd;
      if (f.y < -20) {
        f.y = H + 5 + Math.random() * 60;
        f.x = Math.random() * W;
        f.ch = chars[Math.floor(Math.random() * chars.length)];
      }
      ctx.font      = `400 ${f.sz}px "JetBrains Mono",monospace`;
      ctx.fillStyle = f.isCyan
        ? `rgba(34,211,238,${f.alpha})`
        : `rgba(200,215,232,${f.alpha})`;
      ctx.fillText(f.ch, f.x, f.y);
    });

    // Centre label — floats through vacuum
    const ta = labelAlpha(t);
    if (ta > 0) {
      const ly = labelY(t);
      ctx.textAlign    = 'center';
      ctx.shadowColor  = 'rgba(34,211,238,0.28)';
      ctx.shadowBlur   = 20;
      ctx.font         = `600 ${fSize}px "Space Grotesk",sans-serif`;
      ctx.fillStyle    = `rgba(232,238,246,${ta})`;
      ctx.fillText(label, cx, ly);
      // small monospace tag floats with it
      ctx.shadowBlur   = 0;
      ctx.font         = `400 12px "JetBrains Mono",monospace`;
      ctx.fillStyle    = `rgba(34,211,238,${ta * 0.48})`;
      ctx.fillText('// initializing', cx, ly + fSize * 0.92);
      ctx.textAlign    = 'left';
    }

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, W, H);
      onDone();
    }
  }

  requestAnimationFrame(frame);
}

function finishLevel(){
  hidePrompt();
  const ins=INSIGHTS[levelIdx];
  collected.push(ins);
  spawnParticles(W/2, H/2);
  playInsightSound();
  // Clear previous content, show card, then animate text in sequence
  el.insightH.textContent='';
  el.insightP.innerHTML='';
  el.insight.classList.add('show');
  typewriterTitle(el.insightH, ins.h, () => revealBodyLines(el.insightP, ins.p));
  [...el.dots.children][levelIdx]?.classList.remove('active');
  [...el.dots.children][levelIdx]?.classList.add('done');
}

el.insightNext.addEventListener('click',()=>{
  el.insight.classList.remove('show');
  currentLevel=null;
  setTimeout(()=>{
    const nextIdx = levelIdx + 1;
    const label   = nextIdx < TOTAL_LEVELS ? `Reaching Level ${nextIdx + 1}` : 'Signal decoded';
    levelTransition(label, ()=>{
      if(nextIdx < TOTAL_LEVELS){ startLevel(nextIdx); }
      else { showFinal(); }
    });
  },340);
});

/* ---------- Final dashboard ---------- */
function showFinal(){
  hidePrompt(); currentLevel=null;
  const grid=document.getElementById('insightGrid'); grid.innerHTML='';
  collected.forEach((ins,i)=>{
    const c=document.createElement('div'); c.className='icard';
    c.innerHTML=`<div class="ic-tag">${ins.tag}</div><div class="ic-h">${ins.h}</div><div class="ic-p">${ins.p}</div>`;
    grid.appendChild(c);
    setTimeout(()=>c.classList.add('in'), 120*i+120);
  });
  const tl=document.getElementById('finalTools'); tl.innerHTML='';
  TOOLS.forEach(t=>{const s=document.createElement('span');s.className='tool';s.textContent=t;tl.appendChild(s);});
  el.final.classList.add('show');
}

/* ---------- Skip ---------- */
document.getElementById('skipBtn').addEventListener('click',()=>{
  for(let i=collected.length;i<TOTAL_LEVELS;i++) collected.push(INSIGHTS[i]);
  el.intro.style.opacity='0'; el.intro.style.pointerEvents='none';
  showFinal();
});

/* ---------- Start / replay ---------- */
document.getElementById('startBtn').addEventListener('click',()=>{
  initAudio();
  el.intro.style.opacity='0'; el.intro.style.pointerEvents='none';
  setTimeout(()=>{
    el.intro.classList.add('hidden');
    resize();
    levelTransition("Let's visualize", ()=>startLevel(0));
  },580);
});
document.getElementById('replayBtn').addEventListener('click',()=>{
  collected=[]; levelIdx=0;
  el.final.classList.remove('show');
  setTimeout(()=>{ resize(); startLevel(0); },500);
});
// cvBtn is a plain <a download> — no JS override needed

/* ---------- Render loop ---------- */
function loop(t){
  if(currentLevel || particles.length){
    ctx.clearRect(0,0,W,H);
    if(currentLevel) currentLevel.draw(t);
    updateParticles();
    drawParticles();
  }
  requestAnimationFrame(loop);
}
resize();
requestAnimationFrame(loop);
