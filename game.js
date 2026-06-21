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
};

/* ---------- Insight content (the payoff of each level) ---------- */
const INSIGHTS = [
  { tag:'The headline', h:'4+ years turning chaos into clarity',
    p:'Senior Data Analyst who takes messy, real-world data and hands back decisions people actually trust. That outlier you just removed? That\'s the instinct.' },
  { tag:'By the numbers', h:'60+ stakeholders · 35% faster · same-day reporting',
    p:'Built and governed 15+ dashboards used across the business, standardised the metrics, and cut report turnaround from three days to same-day.' },
  { tag:'Banking · Risk', h:'Credit & risk monitoring for a US bank',
    p:'Connected the dots in lending data — repayment patterns, risk indicators, account performance — and found where manual checks could become automated controls.' },
  { tag:'Multi-domain', h:'Healthcare · Retail · Research · Fintech',
    p:'The domain changes, the instinct stays. Each cluster you sorted is a field I\'ve worked in — from hospital data to sales & inventory to wealth management.' },
  { tag:'Research · Dissertation', h:'Found a pollution episode hidden in the noise',
    p:'My MSc dissertation analysed a city-wide PM2.5 sensor network, flagged faulty sensors, and surfaced a real May-2024 pollution event buried in noisy data. Exactly what you just did.' },
];

const TOOLS = ["SQL","Python","R","Power BI","Tableau","Looker","dbt","Databricks","Snowflake","Oracle","Git","GCP","pandas","scikit-learn","DAX"];

/* ---------- State ---------- */
let levelIdx = 0;
let currentLevel = null;
let collected = [];
const TOTAL_LEVELS = INSIGHTS.length;

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
   Click the red outlier points to remove them. When only the clean
   cluster remains, the level completes.
   =================================================================== */
function Level1(){
  const pts=[]; const cx=W/2, cy=H/2;
  const cleanN=46, noiseN=22;
  for(let i=0;i<cleanN;i++){
    pts.push({x:cx+rand(-150,150),y:cy+rand(-90,90),outlier:false,gone:false,r:rand(2.5,4)});
  }
  for(let i=0;i<noiseN;i++){
    let x,y;do{x=rand(40,W-40);y=rand(90,H-60);}while(dist(x,y,cx,cy)<230);
    pts.push({x,y,outlier:true,gone:false,r:rand(3,5),pulse:rand(0,6)});
  }
  this.onResize=()=>{};
  this.onDown=(mx,my)=>{
    for(const p of pts){
      if(!p.gone&&p.outlier&&dist(mx,my,p.x,p.y)<16){
        p.gone=true; toast('outlier removed');
        if(pts.every(q=>q.gone||!q.outlier)){ complete(); }
        return;
      }
    }
    // clicking a clean point gently nudges feedback
    for(const p of pts){
      if(!p.gone&&!p.outlier&&dist(mx,my,p.x,p.y)<14){ toast('that\'s signal — keep it'); return; }
    }
  };
  let done=false;
  function complete(){ if(done)return; done=true; setTimeout(()=>finishLevel(),420); }
  this.draw=(t)=>{
    // hover cue
    let hot=null;
    for(const p of pts){ if(!p.gone&&p.outlier&&dist(pointer.x,pointer.y,p.x,p.y)<16){hot=p;break;} }
    for(const p of pts){
      if(p.gone)continue;
      ctx.beginPath();
      if(p.outlier){
        const pulse=0.5+0.5*Math.sin(t*0.004+p.pulse);
        ctx.arc(p.x,p.y,p.r+pulse*1.5,0,7);
        ctx.fillStyle = p===hot?'rgba(251,191,36,0.95)':'rgba(239,68,68,'+(0.55+pulse*0.3)+')';
        ctx.fill();
        if(p===hot){ ctx.beginPath();ctx.arc(p.x,p.y,16,0,7);ctx.strokeStyle='rgba(251,191,36,0.6)';ctx.lineWidth=1.5;ctx.stroke(); }
      }else{
        ctx.arc(p.x,p.y,p.r,0,7);
        ctx.fillStyle='rgba(34,211,238,0.7)';
        ctx.fill();
      }
    }
  };
  showPrompt('Level 1 · Filter','The data is full of noise.','Click the <span class="key">red outliers</span> to remove them. Keep the signal.');
}

/* ===================================================================
   LEVEL 2 — SORT THE BARS
   Drag bars to sort them ascending. When ordered, reveals stats.
   =================================================================== */
function Level2(){
  const n=6; const vals=[3,1,5,2,6,4]; // shuffled
  const labels=['','','','','',''];
  const bars=[];
  const bw=Math.min(74,(W-120)/n - 16);
  const gap=16; const totalW=n*(bw+gap)-gap; const startX=(W-totalW)/2;
  const baseY=H-120; const maxH=H*0.42;
  for(let i=0;i<n;i++){
    bars.push({val:vals[i], x:startX+i*(bw+gap), tx:startX+i*(bw+gap), h:(vals[i]/6)*maxH, w:bw});
  }
  let drag=null, offX=0, done=false;
  function slotOrder(){ return [...bars].sort((a,b)=>a.x-b.x); }
  function isSorted(){
    const o=slotOrder(); for(let i=1;i<o.length;i++) if(o[i].val<o[i-1].val) return false; return true;
  }
  function snap(){
    const o=slotOrder();
    o.forEach((b,i)=>{ if(b!==drag) b.tx=startX+i*(bw+gap); });
  }
  this.onDown=(mx,my)=>{
    for(const b of bars){
      if(mx>b.x&&mx<b.x+b.w&&my>baseY-b.h&&my<baseY){ drag=b; offX=mx-b.x; break; }
    }
  };
  this.onMove=(mx,my)=>{ if(drag){ drag.x=mx-offX; drag.tx=drag.x; snap(); } };
  this.onUp=()=>{
    if(drag){ drag=null; snap();
      if(isSorted()&&!done){ done=true; toast('sorted — ascending'); setTimeout(()=>finishLevel(),520); }
    }
  };
  this.draw=()=>{
    for(const b of bars){ if(b!==drag) b.x=lerp(b.x,b.tx,0.25); }
    const o=slotOrder();
    o.forEach((b,i)=>{
      const sorted=isSorted();
      const grad=ctx.createLinearGradient(0,baseY-b.h,0,baseY);
      if(sorted){ grad.addColorStop(0,'rgba(163,230,53,0.95)');grad.addColorStop(1,'rgba(34,211,238,0.7)'); }
      else{ grad.addColorStop(0,'rgba(71,85,105,0.9)');grad.addColorStop(1,'rgba(51,65,85,0.6)'); }
      ctx.fillStyle = b===drag?'rgba(251,191,36,0.9)':grad;
      roundRect(b.x,baseY-b.h,b.w,b.h,6); ctx.fill();
    });
    // baseline
    ctx.strokeStyle='rgba(28,40,64,1)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(startX-20,baseY+1);ctx.lineTo(startX+totalW+20,baseY+1);ctx.stroke();
  };
  this.onResize=()=>{};
  showPrompt('Level 2 · Sort','Unsorted bars hide the story.','<span class="key">Drag</span> the bars into ascending order.');
}
function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

/* ===================================================================
   LEVEL 3 — CONNECT THE POINTS
   Hover/drag across scattered points in order to draw a trend line.
   Touch each point left-to-right to connect them.
   =================================================================== */
function Level3(){
  const n=8; const pts=[];
  const startX=W*0.12, endX=W*0.88, midY=H*0.5;
  for(let i=0;i<n;i++){
    const x=lerp(startX,endX,i/(n-1));
    const y=midY+Math.sin(i*0.9)*H*0.14 + rand(-14,14);
    pts.push({x,y,hit:false,order:i});
  }
  let next=0, done=false;
  this.onDown=(mx,my)=>tryHit(mx,my);
  this.onMove=(mx,my)=>{ if(pointer.down) tryHit(mx,my); };
  function tryHit(mx,my){
    if(next>=n)return;
    const p=pts[next];
    if(dist(mx,my,p.x,p.y)<26){
      p.hit=true; next++;
      if(next>=n&&!done){ done=true; toast('trend connected'); setTimeout(()=>finishLevel(),520); }
      else toast((n-next)+' points left');
    }
  }
  this.draw=(t)=>{
    // connecting line through hit points
    ctx.beginPath();
    let started=false;
    for(const p of pts){ if(p.hit){ if(!started){ctx.moveTo(p.x,p.y);started=true;}else ctx.lineTo(p.x,p.y);} }
    if(started){
      ctx.strokeStyle='rgba(34,211,238,0.85)';ctx.lineWidth=2.5;
      ctx.shadowColor='rgba(34,211,238,0.6)';ctx.shadowBlur=12;ctx.stroke();ctx.shadowBlur=0;
    }
    pts.forEach((p,i)=>{
      ctx.beginPath();
      const isNext=i===next;
      const pulse=isNext?0.5+0.5*Math.sin(t*0.005):0;
      ctx.arc(p.x,p.y,p.hit?5:6+pulse*2,0,7);
      if(p.hit) ctx.fillStyle='rgba(163,230,53,0.95)';
      else if(isNext){ ctx.fillStyle='rgba(251,191,36,0.95)';
        ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,18,0,7);ctx.strokeStyle='rgba(251,191,36,'+(0.3+pulse*0.4)+')';ctx.lineWidth=1.5;ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,5,0,7);ctx.fillStyle='rgba(251,191,36,0.95)'; }
      else ctx.fillStyle='rgba(71,85,105,0.8)';
      ctx.fill();
    });
  };
  this.onResize=()=>{};
  showPrompt('Level 3 · Connect','Scattered points, no story — yet.','Trace through the <span class="key">glowing point</span>, in order, to reveal the trend.');
}

/* ===================================================================
   LEVEL 4 — CLUSTER THE DOTS
   Drag dots of 4 colours into their matching zones (domains).
   =================================================================== */
function Level4(){
  const zones=[
    {name:'Healthcare', col:'#22D3EE'},
    {name:'Retail', col:'#A3E635'},
    {name:'Research', col:'#FBBF24'},
    {name:'Fintech', col:'#f472b6'},
  ];
  const zw=Math.min(190,(W-100)/4-14); const zgap=14;
  const ztotal=zones.length*(zw+zgap)-zgap; const zstart=(W-ztotal)/2;
  const zy=H-150, zh=110;
  zones.forEach((z,i)=>{ z.x=zstart+i*(zw+zgap); z.y=zy; z.w=zw; z.h=zh; z.count=0; });
  const dots=[]; const perZone=3;
  zones.forEach((z,zi)=>{
    for(let k=0;k<perZone;k++){
      dots.push({x:rand(60,W-60),y:rand(110,H*0.5),zi,placed:false,r:7});
    }
  });
  let drag=null, offX=0, offY=0, done=false;
  this.onDown=(mx,my)=>{
    for(let i=dots.length-1;i>=0;i--){ const d=dots[i];
      if(!d.placed&&dist(mx,my,d.x,d.y)<14){ drag=d; offX=mx-d.x; offY=my-d.y; break; }
    }
  };
  this.onMove=(mx,my)=>{ if(drag){ drag.x=mx-offX; drag.y=my-offY; } };
  this.onUp=()=>{
    if(drag){
      const z=zones[drag.zi];
      if(drag.x>z.x&&drag.x<z.x+z.w&&drag.y>z.y&&drag.y<z.y+z.h){
        drag.placed=true; z.count++;
        toast(z.name+' ✓');
        if(dots.every(d=>d.placed)&&!done){ done=true; setTimeout(()=>finishLevel(),520); }
      } else {
        // wrong or empty drop — check if dropped in a wrong zone
        for(const z2 of zones){ if(z2!==z&&drag.x>z2.x&&drag.x<z2.x+z2.w&&drag.y>z2.y&&drag.y<z2.y+z2.h){ toast('wrong cluster'); } }
      }
      drag=null;
    }
  };
  this.draw=(t)=>{
    // zones
    zones.forEach(z=>{
      const hovering=drag&&drag.zi===zones.indexOf(z)&&drag.x>z.x&&drag.x<z.x+z.w&&drag.y>z.y&&drag.y<z.y+z.h;
      ctx.fillStyle=hexA(z.col,hovering?0.16:0.06);
      roundRect(z.x,z.y,z.w,z.h,10);ctx.fill();
      ctx.strokeStyle=hexA(z.col,0.5);ctx.lineWidth=1.5;
      ctx.setLineDash([6,5]);roundRect(z.x,z.y,z.w,z.h,10);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle=hexA(z.col,0.9);ctx.font='600 13px "JetBrains Mono",monospace';ctx.textAlign='center';
      ctx.fillText(z.name+'  '+z.count+'/'+perZone, z.x+z.w/2, z.y+z.h/2+4);
    });
    ctx.textAlign='left';
    // dots
    dots.forEach(d=>{
      const z=zones[d.zi];
      ctx.beginPath();ctx.arc(d.x,d.y,d===drag?d.r+2:d.r,0,7);
      ctx.fillStyle=hexA(z.col,d.placed?0.95:0.8);ctx.fill();
      if(d===drag){ctx.beginPath();ctx.arc(d.x,d.y,d.r+6,0,7);ctx.strokeStyle=hexA(z.col,0.5);ctx.lineWidth=1.5;ctx.stroke();}
    });
  };
  this.onResize=()=>{};
  showPrompt('Level 4 · Cluster','Mixed signals from every domain.','<span class="key">Drag</span> each dot into its matching field below.');
}
function hexA(hex,a){const n=parseInt(hex.slice(1),16);return'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';}

/* ===================================================================
   LEVEL 5 — SPOT THE ANOMALY
   A field of calm points; one spikes. Click the true anomaly.
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
      // clicked a normal point
      for(const p of pts){ if(!p.anom&&dist(mx,my,p.x,p.y)<16){ toast('that\'s normal variation'); return; } }
    }
  };
  this.draw=(t)=>{
    const a=pts[anomalyIdx];
    const spike=Math.min(1,(t-t0)/1400);
    a.y=a.base-spike*H*0.22;
    // line through baseline points
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

function finishLevel(){
  hidePrompt();
  const ins=INSIGHTS[levelIdx];
  collected.push(ins);
  // celebratory flash handled by insight card
  el.insightH.textContent=ins.h;
  el.insightP.textContent=ins.p;
  el.insight.classList.add('show');
  // mark dot done
  [...el.dots.children][levelIdx]?.classList.remove('active');
  [...el.dots.children][levelIdx]?.classList.add('done');
}

el.insightNext.addEventListener('click',()=>{
  el.insight.classList.remove('show');
  currentLevel=null;
  ctx.clearRect(0,0,W,H);
  setTimeout(()=>{
    if(levelIdx+1<TOTAL_LEVELS){ startLevel(levelIdx+1); }
    else { showFinal(); }
  },380);
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
  // fill any uncollected insights so the dashboard is complete
  for(let i=collected.length;i<TOTAL_LEVELS;i++) collected.push(INSIGHTS[i]);
  el.intro.style.opacity='0'; el.intro.style.pointerEvents='none';
  showFinal();
});

/* ---------- Start / replay ---------- */
document.getElementById('startBtn').addEventListener('click',()=>{
  el.intro.style.opacity='0'; el.intro.style.pointerEvents='none';
  setTimeout(()=>{ el.intro.classList.add('hidden'); resize(); startLevel(0); },500);
});
document.getElementById('replayBtn').addEventListener('click',()=>{
  collected=[]; levelIdx=0;
  el.final.classList.remove('show');
  setTimeout(()=>{ resize(); startLevel(0); },500);
});
// cvBtn is a plain <a download> — no JS override needed

/* ---------- Render loop ---------- */
function loop(t){
  if(currentLevel){
    ctx.clearRect(0,0,W,H);
    currentLevel.draw(t);
  }
  requestAnimationFrame(loop);
}
resize();
requestAnimationFrame(loop);
