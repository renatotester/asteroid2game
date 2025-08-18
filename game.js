/* ASTRO OPS PRO+ — GitHub Pages safe build (sem conflito de globals) */
(() => {
  'use strict';

  // ===== Canvas / DPI / Sizing =====
  const DPR = Math.max(1, self.devicePixelRatio || 1);
  const rootEl = document.getElementById('wrap');  // <— era "wrap"
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  function fitCanvas(){
    const hud=document.querySelector('.hud');
    const help=document.querySelector('.help');
    const availH=Math.max(200, innerHeight - (hud?.offsetHeight||0) - (help?.offsetHeight||0));
    canvas.style.height=availH+'px';
    const rect=canvas.getBoundingClientRect();
    const w=rect.width || (canvas.parentElement?.clientWidth||innerWidth);
    const h=rect.height||availH;
    canvas.width=Math.max(320, Math.round(w*DPR));
    canvas.height=Math.max(240, Math.round(h*DPR));
  }
  addEventListener('resize', ()=>requestAnimationFrame(fitCanvas), {passive:true});
  requestAnimationFrame(()=>requestAnimationFrame(fitCanvas));

  // ===== Fullscreen (com fallback “max”) =====
  const btnFS=document.getElementById('btnFS');
  async function toggleFS(){
    try{
      if(!document.fullscreenElement){
        await (rootEl.requestFullscreen?.call(rootEl));
      }else{
        await (document.exitFullscreen?.call(document));
      }
    }catch{
      rootEl.classList.toggle('max');
    }
    setTimeout(fitCanvas, 60);
  }
  btnFS.addEventListener('click', toggleFS);
  addEventListener('keydown', e=>{ if(e.key.toLowerCase()==='f'){ e.preventDefault(); toggleFS(); }});
  document.addEventListener('fullscreenchange', fitCanvas);

  // ===== HUD / Overlay =====
  const $ = s=>document.querySelector(s);
  const elScore=$('#score'), elHi=$('#hiScore'), elLevel=$('#level'), elFPS=$('#fps'), elCombo=$('#combo');
  const overlay=$('#overlay'), ovScore=$('#ovScore'), ovHi=$('#ovHi'), ovLevel=$('#ovLevel'), ovTitle=$('#title'), ovSub=$('#subtitle');
  const tShield=$('#tShield'), tRapid=$('#tRapid'), tSlow=$('#tSlow');

  // ===== Skins / CRT =====
  const skinSel = document.getElementById('skin');
  const crtRange = document.getElementById('crtRange');
  const applySkin = v=>{
    document.body.classList.remove('skin-classic','skin-neon','skin-sunset','skin-dark','skin-mono');
    document.body.classList.add(`skin-${v}`);
    localStorage.setItem('astroops.skin', v);
  };
  applySkin(localStorage.getItem('astroops.skin')||'classic');
  skinSel.value = localStorage.getItem('astroops.skin')||'classic';
  skinSel.addEventListener('change', e=>applySkin(e.target.value));

  function setCRT(val){
    document.body.classList.toggle('crt', val>0);
    document.documentElement.style.setProperty('--crtAlpha', String(val));
    localStorage.setItem('astroops.crt', val);
  }
  setCRT(Number(localStorage.getItem('astroops.crt')||0));
  crtRange.value = Number(localStorage.getItem('astroops.crt')||0);
  crtRange.addEventListener('input', e=> setCRT(Number(e.target.value)));
  addEventListener('keydown', e=>{ if(e.key.toLowerCase()==='c'){ const v=Number(crtRange.value)>0?0:0.6; crtRange.value=v; setCRT(v); }});

  // ===== Input =====
  const keys=new Set();
  const isSpace=k=>[' ','space','spacebar','space bar'].includes(k);
  const isEnter=k=>['enter','return'].includes(k);
  addEventListener('keydown', e=>{
    const k=e.key.toLowerCase();
    if(['arrowup','arrowleft','arrowright'].includes(k)||isSpace(k)) e.preventDefault();
    keys.add(k);
  });
  addEventListener('keyup', e=>keys.delete(e.key.toLowerCase()));
  addEventListener('keypress', e=>{ if(isSpace(e.key.toLowerCase())) e.preventDefault(); });

  // ===== Áudio =====
  let audio=null, muted=false;
  try{
    const AC=self.AudioContext||self.webkitAudioContext; audio=new AC();
    const unlock=()=>{ if(audio.state==='suspended') audio.resume(); removeEventListener('pointerdown',unlock); removeEventListener('keydown',unlock); };
    addEventListener('pointerdown',unlock,{once:true}); addEventListener('keydown',unlock,{once:true});
  }catch{ muted=true; }
  function beep({freq=440,type='square',dur=.08,vol=.2,slide=0,attack=.002,release=.08}={}){
    if(muted||!audio) return;
    const t0=audio.currentTime, o=audio.createOscillator(), g=audio.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t0);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(50,freq*slide), t0+dur);
    g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(vol,t0+attack);
    g.gain.exponentialRampToValueAtTime(.0001,t0+dur+release);
    o.connect(g).connect(audio.destination); o.start(t0); o.stop(t0+dur+release+.02);
  }
  const sShoot=()=>beep({freq:880,type:'square',dur:.06,vol:.18,slide:.7});
  const sThru =()=>beep({freq:120,type:'sawtooth',dur:.08,vol:.14});
  const sBoom =()=>beep({freq:95 ,type:'triangle',dur:.18,vol:.30,slide:.5});
  const sUFOS =()=>beep({freq:520,type:'sawtooth',dur:.12,vol:.16});
  const sPow  =()=>beep({freq:700,type:'sine',dur:.12,vol:.2});
  const sBoss =()=>beep({freq:220,type:'square',dur:.25,vol:.25,slide:.6});

  // ===== Utils =====
  const W=()=>canvas.width, H=()=>canvas.height;
  const rand=(a=1,b)=> b===undefined?Math.random()*a: a+Math.random()*(b-a);
  const rint=(a,b)=>Math.floor(rand(a,b));
  const wrap=(v,max)=>(v+max)%max;
  const dist2=(a,b)=>{const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy;};
  const lerp=(a,b,t)=>a+(b-a)*t;

  // ===== Estado =====
  let gameRunning=false, paused=false;
  let score=0, level=1, hiScore=Number(localStorage.getItem('astroops.hi.pro+')||0);
  let lives=3, bullets=[], rocks=[], parts=[], ship=null, ufos=[], enemyShots=[], powerups=[];
  let combo=1, comboTimer=0, comboMax=4;
  let timeScale=1, shake=0, shakeX=0, shakeY=0;
  const stars=Array.from({length:120},()=>({x:Math.random(),y:Math.random(),z:rand(0.3,1.5)}));
  elHi.textContent=hiScore; ovHi.textContent=hiScore;

  // ===== Touch (definido cedo pra não dar undefined) =====
  const touch={ thrust:false, fire:false, hyper:false, dx:0, dy:0 };

  // ===== Entidades =====
  class Ship{
    constructor(){ this.x=W()/2; this.y=H()/2; this.vx=0; this.vy=0; this.a=-Math.PI/2; this.r=16*DPR; this.inv=2; this.cool=0; this.thr=false; this.shield=0; this.rapid=0; }
    reset(){ Object.assign(this,new Ship()); this.inv=2; }
    update(dt){
      const rot=3.6, acc=300*DPR, damp=.995;
      if(keys.has('arrowleft'))  this.a-=rot*dt;
      if(keys.has('arrowright')) this.a+=rot*dt;
      this.thr=keys.has('arrowup') || touch.thrust;
      if(this.thr){
        this.vx+=Math.cos(this.a)*acc*dt; this.vy+=Math.sin(this.a)*acc*dt;
        if(Math.random()<7*dt) sThru();
        parts.push(new Part(this.x-Math.cos(this.a)*this.r,this.y-Math.sin(this.a)*this.r, rand(-40,40)*DPR-this.vx*.1, rand(-40,40)*DPR-this.vy*.1, rand(.18,.35),'th'));
      }
      this.vx*=Math.pow(damp,dt*60); this.vy*=Math.pow(damp,dt*60);
      if(touch.dx||touch.dy){ this.a = Math.atan2(touch.dy, touch.dx); }
      this.x=wrap(this.x+this.vx*dt,W()); this.y=wrap(this.y+this.vy*dt,H());
      this.cool-=dt;
      const fireKey = keys.has(' ')||keys.has('space')||keys.has('spacebar') || touch.fire;
      const cd = this.rapid>0? 0.09 : 0.18;
      if(fireKey && this.cool<=0) this.shoot(cd);
      if(keys.has('h') || touch.hyper){ keys.delete('h'); touch.hyper=false; this.hyper(); }
      if(this.shield>0) this.shield-=dt;
      if(this.rapid>0) this.rapid-=dt;
    }
    shoot(nextCD){
      const sp=700*DPR;
      bullets.push(new Bullet(this.x+Math.cos(this.a)*this.r, this.y+Math.sin(this.a)*this.r, this.vx+Math.cos(this.a)*sp, this.vy+Math.sin(this.a)*sp));
      this.cool=nextCD; sShoot();
    }
    hyper(){
      sPow();
      for(let i=0;i<50;i++){
        const x=rand(0,W()), y=rand(0,H());
        if(rocks.every(r=>dist2({x,y},r)>(r.r+80*DPR)**2) && ufos.every(u=>dist2({x,y},u)>(60*DPR)**2)){
          this.x=x; this.y=y; this.vx=this.vy=0; this.inv=1.2; return;
        }
      }
    }
    hit(){
      if(this.inv>0 || this.shield>0){ this.shield=Math.max(0,this.shield-0.6); sPow(); return; }
      lives--; sBoom(); shake=12*DPR;
      for(let i=0;i<26;i++) parts.push(new Part(this.x,this.y,rand(-240,240)*DPR,rand(-240,240)*DPR,rand(.25,.6),'bm'));
      if(lives>=0){ this.reset(); } else gameOver();
    }
    draw(){
      ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.a);
      const blink=this.inv>0 && Math.floor(this.inv*10)%2===0;
      ctx.globalAlpha=blink?0.35:1;
      ctx.lineWidth=2*DPR; ctx.strokeStyle='#b3f3ff';
      ctx.beginPath();
      ctx.moveTo(18*DPR,0); ctx.lineTo(-14*DPR,11*DPR); ctx.lineTo(-8*DPR,0); ctx.lineTo(-14*DPR,-11*DPR); ctx.closePath(); ctx.stroke();
      if(this.thr && !blink){ ctx.strokeStyle='var(--accent)'; ctx.beginPath(); ctx.moveTo(-14*DPR,6*DPR); ctx.lineTo(-22*DPR - Math.random()*6*DPR, 0); ctx.lineTo(-14*DPR,-6*DPR); ctx.stroke(); }
      if(this.shield>0){ ctx.strokeStyle='rgba(69,255,156,.7)'; ctx.lineWidth=1.5*DPR; ctx.beginPath(); ctx.arc(0,0,(this.r+6*DPR),0,Math.PI*2); ctx.stroke(); }
      ctx.restore();
    }
  }
  class Bullet{ constructor(x,y,vx,vy){ this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.life=.9; this.r=2.5*DPR; }
    update(dt){ this.life-=dt; this.x=wrap(this.x+this.vx*dt,W()); this.y=wrap(this.y+this.vy*dt,H()); }
    draw(){ ctx.save(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fill(); ctx.restore(); } }
  class Rock{
    constructor(x,y,s=3,hp=0){
      this.x=x; this.y=y;
      const sp=rand(20,70)*(4-s)*DPR, ang=rand(0,Math.PI*2);
      this.vx=Math.cos(ang)*sp; this.vy=Math.sin(ang)*sp; this.rot=rand(-1,1); this.a=rand(0,Math.PI*2);
      this.s=s; this.r=(s===4?70:s===3?46:s===2?28:16)*DPR;
      this.hp=hp||(s===4?6:s===3?3:s===2?2:1);
      const n=rint(9,14);
      this.poly=Array.from({length:n},(_,i)=>{const t=i/n*Math.PI*2,R=this.r*rand(.78,1.12);return{x:Math.cos(t)*R,y:Math.sin(t)*R};});
    }
    update(dt){ this.x=wrap(this.x+this.vx*dt,W()); this.y=wrap(this.y+this.vy*dt,H()); this.a+=this.rot*dt; }
    hit(){ this.hp--; if(this.hp<=0){ return true; } for(let i=0;i<6;i++) parts.push(new Part(this.x,this.y,rand(-120,120)*DPR,rand(-120,120)*DPR,rand(.12,.25),'sp')); return false; }
    split(){ if(this.s>1){ rocks.push(new Rock(this.x,this.y,this.s-1), new Rock(this.x,this.y,this.s-1)); } }
    draw(){
      ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.a);
      ctx.lineWidth=2*DPR; ctx.strokeStyle='#9bd4ff';
      ctx.beginPath(); const p=this.poly; ctx.moveTo(p[0].x,p[0].y); for(let i=1;i<p.length;i++) ctx.lineTo(p[i].x,p[i].y); ctx.closePath(); ctx.stroke();
      if(this.s>=3){
        ctx.rotate(-this.a); ctx.translate(-this.r, -this.r-10*DPR);
        const w=this.r*2, t=Math.max(0,Math.min(1,this.hp/(this.s===4?6:this.s===3?3:2)));
        ctx.fillStyle='rgba(0,0,0,.4)'; ctx.fillRect(0,0,w,4*DPR);
        ctx.fillStyle='rgba(155,212,255,.9)'; ctx.fillRect(0,0,w*t,4*DPR);
      }
      ctx.restore();
    }
  }
  class Part{ constructor(x,y,vx,vy,life,type){ this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.life=life; this.max=life; this.t=type; }
    update(dt){ this.life-=dt; this.x=wrap(this.x+this.vx*dt,W()); this.y=wrap(this.y+this.vy*dt,H()); this.vx*=.98; this.vy*=.98; }
    draw(){ const a=Math.max(0,this.life/this.max); ctx.save(); let col='rgba(69,255,156,'+a+')'; if(this.t==='bm') col='rgba(255,107,107,'+a+')'; if(this.t==='sp'||this.t==='ufo') col='rgba(255,223,107,'+a+')'; ctx.strokeStyle=col; ctx.lineWidth=this.t==='bm'?2*DPR:1.5*DPR; ctx.beginPath(); ctx.moveTo(this.x,this.y); ctx.lineTo(this.x-this.vx*.05,this.y-this.vy*.05); ctx.stroke(); ctx.restore(); } }
  class UFO{
    constructor(tier=1){
      const side=rint(0,4);
      this.x=side%2===0?(side===0?-40*DPR:W()+40*DPR):rand(0,W());
      this.y=side%2===1?(side===1?-40*DPR:H()+40*DPR):rand(0,H());
      this.vx=rand(-60,60)*DPR; this.vy=rand(-60,60)*DPR;
      this.r=14*DPR; this.cool=rand(.6,1.2); this.tier=tier; this.hp=tier===2?3:1;
    }
    update(dt){
      const aimX=ship.x-this.x, aimY=ship.y-this.y, len=Math.hypot(aimX,aimY)||1;
      const ax=(aimX/len)*(this.tier===2?40:25)*DPR, ay=(aimY/len)*(this.tier===2?40:25)*DPR;
      this.vx=Math.max(-180*DPR,Math.min(180*DPR,this.vx+ax*dt));
      this.vy=Math.max(-180*DPR,Math.min(180*DPR,this.vy+ay*dt));
      this.x=wrap(this.x+this.vx*dt,W()); this.y=wrap(this.y+this.vy*dt,H());
      this.cool-=dt; if(this.cool<=0){ this.shoot(); this.cool=this.tier===2?0.6:1.0; }
    }
    shoot(){ const dir=Math.atan2(ship.y-this.y,ship.x-this.x), sp=(this.tier===2?380:320)*DPR;
      enemyShots.push(new EnemyShot(this.x+Math.cos(dir)*this.r,this.y+Math.sin(dir)*this.r,Math.cos(dir)*sp,Math.sin(dir)*sp)); sUFOS(); }
    hit(){ this.hp--; if(this.hp<=0){ for(let i=0;i<18;i++) parts.push(new Part(this.x,this.y,rand(-220,220)*DPR,rand(-220,220)*DPR,rand(.22,.5),'ufo')); score+=this.tier===2?200:120; elScore.textContent=score; addCombo(); if(Math.random()<0.5) spawnPower(this.x,this.y); return true; } else { for(let i=0;i<8;i++) parts.push(new Part(this.x,this.y,rand(-120,120)*DPR,rand(-120,120)*DPR,rand(.15,.3),'ufo')); return false; } }
    draw(){ ctx.save(); ctx.translate(this.x,this.y); ctx.lineWidth=2*DPR; ctx.strokeStyle='rgba(255,223,107,1)'; ctx.beginPath(); ctx.ellipse(0,0,18*DPR,10*DPR,0,0,Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(0,-4*DPR,6*DPR,0,Math.PI*2); ctx.stroke(); ctx.fillStyle='rgba(255,223,107,.3)'; ctx.beginPath(); ctx.arc(0,6*DPR,2.2*DPR,0,Math.PI*2); ctx.fill(); if(this.tier===2){ ctx.fillStyle='rgba(255,223,107,.7)'; ctx.fillRect(-12*DPR,-18*DPR,(this.hp/3)*24*DPR,3*DPR); } ctx.restore(); }
  }
  class EnemyShot{ constructor(x,y,vx,vy){ this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.life=1.5; this.r=2.8*DPR; } update(dt){ this.life-=dt; this.x=wrap(this.x+this.vx*dt,W()); this.y=wrap(this.y+this.vy*dt,H()); } draw(){ ctx.save(); ctx.fillStyle='rgba(255,223,107,.95)'; ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fill(); ctx.restore(); } }
  class PowerUp{ constructor(x,y,type){ this.x=x; this.y=y; this.vx=rand(-50,50)*DPR; this.vy=rand(-50,50)*DPR; this.r=10*DPR; this.type=type; this.life=10; }
    update(dt){ this.life-=dt; this.x=wrap(this.x+this.vx*dt,W()); this.y=wrap(this.y+this.vy*dt,H()); this.vx*=0.99; this.vy*=0.99; }
    draw(){ ctx.save(); ctx.translate(this.x,this.y); ctx.lineWidth=2*DPR; ctx.strokeStyle=this.type==='shield'?'#45ff9c':this.type==='rapid'?'#79f':'#ffdf6b'; ctx.beginPath(); ctx.arc(0,0,this.r,0,Math.PI*2); ctx.stroke(); ctx.fillStyle=ctx.strokeStyle; ctx.font=(12*DPR)+'px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(this.type==='shield'?'🛡':this.type==='rapid'?'⚡':'🕓',0,1*DPR); ctx.restore(); } }

  // ===== Colisões / Spawns =====
  const hitCC=(a,b)=> dist2(a,b) < (a.r + b.r)**2;
  function spawnPower(x,y){ const types=['shield','rapid','slow']; const t=types[rint(0,types.length)]; powerups.push(new PowerUp(x,y,t)); }
  function spawnLevel(n=level){
    rocks.length=0; ufos.length=0; enemyShots.length=0; powerups.length=0;
    const count=3+n; const boss=(n%5===0); if(boss) sBoss();
    for(let i=0;i<count;i++){ let x,y; do{ x=rand(0,W()); y=rand(0,H()); } while(ship && dist2({x,y},ship)<(200*DPR)**2); rocks.push(new Rock(x,y, boss && i===0 ? 4 : 3)); }
    ufoTimer=rand(6,10);
  }

  // ===== Touch (eventos) =====
  const stick=document.getElementById('stick'); const nub=stick?.querySelector('.nub');
  let stickActive=false,sx=0,sy=0;
  function setNub(px,py){ if(!nub||!stick) return; nub.style.left=px+'px'; nub.style.top=py+'px'; }
  function onStickStart(e){ if(!stick) return; stickActive=true; const r=stick.getBoundingClientRect(); sx=r.left+r.width/2; sy=r.top+r.height/2; handleStick(e); }
  function onStickEnd(){ stickActive=false; touch.dx=touch.dy=0; touch.thrust=false; if(stick) setNub(stick.clientWidth/2, stick.clientHeight/2); }
  function handleStick(e){ if(!stickActive) return; const t=e.touches?e.touches[0]:e; const dx=t.clientX-sx, dy=t.clientY-sy; const max=50; const len=Math.hypot(dx,dy); const k=Math.min(1,len/max); const ndx=(dx/len||0)*k, ndy=(dy/len||0)*k; touch.dx=ndx; touch.dy=ndy; touch.thrust=len>14; setNub(stick.clientWidth/2+ndx*max, stick.clientHeight/2+ndy*max); }
  if(stick){ stick.addEventListener('pointerdown', onStickStart); addEventListener('pointermove', handleStick); addEventListener('pointerup', onStickEnd); addEventListener('pointercancel', onStickEnd); }
  document.getElementById('btnFire') ?.addEventListener('pointerdown',()=>{ touch.fire=true; });
  document.getElementById('btnFire') ?.addEventListener('pointerup',  ()=>{ touch.fire=false; });
  document.getElementById('btnHyper')?.addEventListener('click',     ()=>{ touch.hyper=true; });
  document.getElementById('btnPause')?.addEventListener('click',     ()=>{ paused=!paused; if(paused){ ovTitle.textContent='PAUSA'; ovSub.textContent='Pressione P/⏯ para continuar'; overlay.classList.remove('hidden'); } else overlay.classList.add('hidden'); });

  // ===== Loop =====
  let last=performance.now(), acc=0, fCnt=0, fTimer=0, ufoTimer=8;

  function update(dtRaw){
    if(!gameRunning || paused) return;
    const dt=dtRaw*timeScale;

    for(const s of stars){ s.x=(s.x+0.004*s.z*dt)%1; }
    ship.update(dt);

    for(let i=bullets.length-1;i>=0;i--){ bullets[i].update(dt); if(bullets[i].life<=0) bullets.splice(i,1); }
    for(let i=0;i<rocks.length;i++) rocks[i].update(dt);
    for(let i=parts.length-1;i>=0;i--){ parts[i].update(dt); if(parts[i].life<=0) parts.splice(i,1); }
    for(let i=ufos.length-1;i>=0;i--){ ufos[i].update(dt); }
    for(let i=enemyShots.length-1;i>=0;i--){ enemyShots[i].update(dt); if(enemyShots[i].life<=0) enemyShots.splice(i,1); }
    for(let i=powerups.length-1;i>=0;i--){ powerups[i].update(dt); if(powerups[i].life<=0) powerups.splice(i,1); }

    ufoTimer-=dt; if(ufoTimer<=0){ ufos.push(new UFO(level>=6 && Math.random()<0.5?2:1)); ufoTimer=rand(10,16); }

    // colisões
    for(let i=rocks.length-1;i>=0;i--){
      const r=rocks[i];
      for(let j=bullets.length-1;j>=0;j--){
        const b=bullets[j];
        if(dist2(b,r) < (b.r+r.r)**2){
          b.life=0;
          if(r.hit()){
            sBoom(); shake=Math.max(shake,(r.s>=4?18:12)*DPR);
            for(let k=0;k<(r.s>=3?18:12);k++) parts.push(new Part(b.x,b.y,rand(-250,250)*DPR,rand(-250,250)*DPR,rand(.18,.45),'bm'));
            rocks.splice(i,1); r.split();
            if(Math.random()<0.15) spawnPower(b.x,b.y);
            score+= r.s===4?300 : r.s===3?60 : r.s===2?90 : 140;
            elScore.textContent=score; addCombo();
          }
          break;
        }
      }
    }
    for(let i=ufos.length-1;i>=0;i--){
      const u=ufos[i];
      for(let j=bullets.length-1;j>=0;j--){
        const b=bullets[j];
        if(dist2(b,u) < (b.r+u.r)**2){
          b.life=0;
          if(u.hit()){ ufos.splice(i,1); shake=Math.max(shake,10*DPR); }
          break;
        }
      }
    }
    for(let i=enemyShots.length-1;i>=0;i--){ if(dist2(enemyShots[i],ship) < (enemyShots[i].r+ship.r)**2){ enemyShots.splice(i,1); ship.hit(); } }
    for(const r of rocks){ if(dist2(ship,r) < (ship.r+r.r)**2){ if(r.hit()){ sBoom(); rocks.splice(rocks.indexOf(r),1); r.split(); } ship.hit(); break; } }
    for(const u of ufos){ if(dist2(ship,u) < (ship.r+u.r)**2){ if(u.hit()){ ufos.splice(ufos.indexOf(u),1); } ship.hit(); break; } }
    for(let i=powerups.length-1;i>=0;i--){ const p=powerups[i]; if(dist2(ship,p) < (ship.r+p.r)**2){ applyPower(p.type); powerups.splice(i,1); } }

    if(rocks.length===0 && enemyShots.length===0){
      level++; elLevel.textContent=level;
      if(level%5===0) lives=Math.min(6,lives+1);
      spawnLevel();
    }

    comboTimer-=dt; if(comboTimer<=0 && combo>1){ combo=Math.max(1,combo-1); comboTimer=2.5; elCombo.textContent=combo+'x'; }
    if(timeScale<1){ timeScale=lerp(timeScale,1,dt*0.6); if(Math.abs(timeScale-1)<0.01) timeScale=1; }
    if(shake>0){ shake*=0.9; const ang=Math.random()*Math.PI*2; shakeX=Math.cos(ang)*shake; shakeY=Math.sin(ang)*shake; } else { shakeX=shakeY=0; }
  }

  function render(){
    ctx.clearRect(0,0,W(),H());
    // estrelas
    ctx.save(); ctx.globalAlpha=0.25; ctx.fillStyle='#89b7d3';
    for(const s of stars){ const x=((s.x*W())|0)+shakeX*0.2, y=((s.y*H())|0)+shakeY*0.2; ctx.fillRect(x,y,(1.2*s.z)*DPR,(1.2*s.z)*DPR); }
    ctx.restore();

    ctx.save(); ctx.translate(shakeX,shakeY);
    rocks.forEach(r=>r.draw()); bullets.forEach(b=>b.draw()); enemyShots.forEach(e=>e.draw()); ufos.forEach(u=>u.draw()); powerups.forEach(p=>p.draw()); parts.forEach(p=>p.draw());
    ship && ship.draw();
    ctx.restore();

    // vidas
    ctx.save(); ctx.translate(12*DPR,14*DPR);
    for(let i=0;i<Math.max(0,lives);i++){
      ctx.save(); ctx.translate(i*20*DPR,0);
      ctx.strokeStyle='var(--accent)'; ctx.lineWidth=2*DPR;
      ctx.beginPath(); ctx.moveTo(10*DPR,0); ctx.lineTo(-8*DPR,7*DPR); ctx.lineTo(-4*DPR,0); ctx.lineTo(-8*DPR,-7*DPR); ctx.closePath(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  let last=performance.now(), acc=0, fCnt=0, fTimer=0, ufoTimer=8;
  function loop(now){
    const dt=Math.min(.05,(now-last)/1000); last=now; acc+=dt; fTimer+=dt; fCnt++;
    while(acc>1/120){ update(1/120); acc-=1/120; }
    render();
    if(fTimer>=.5){ elFPS.textContent=Math.max(1,Math.round(fCnt/fTimer)); fTimer=0; fCnt=0; }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ===== Flow =====
  function addCombo(){ combo=Math.min(comboMax, combo+1); comboTimer=3.2; elCombo.textContent=combo+'x'; }
  function applyPower(type){ sPow(); if(type==='shield') ship.shield=8; if(type==='rapid') ship.rapid=8; if(type==='slow'){ timeScale=0.5; setTimeout(()=>{ timeScale=1; },100); } }
  function startGame(){
    score=0; level=1; lives=3; elScore.textContent=0; elLevel.textContent=1; elCombo.textContent='1x';
    bullets=[]; rocks=[]; parts=[]; ufos=[]; enemyShots=[]; powerups=[];
    combo=1; comboTimer=2.5; timeScale=1; shake=0;
    ship=new Ship(); spawnLevel();
    overlay.classList.add('hidden'); gameRunning=true; paused=false; canvas.focus({preventScroll:true});
  }
  function gameOver(){
    gameRunning=false;
    if(score>hiScore){ hiScore=score; localStorage.setItem('astroops.hi.pro+', hiScore); }
    elHi.textContent=hiScore; ovScore.textContent=score; ovHi.textContent=hiScore; ovLevel.textContent=level;
    ovTitle.textContent='GAME OVER'; ovSub.innerHTML='Pressione <b>R</b>, <b>Espaço</b>, <b>Enter</b> ou <b>Clique</b> para reiniciar';
    overlay.classList.remove('hidden');
  }

  // ===== Overlay / Start =====
  ovScore.textContent=0; ovLevel.textContent=1; overlay.classList.remove('hidden');
  overlay.addEventListener('click', e=>{ e.preventDefault(); if(!gameRunning) startGame(); });
  overlay.addEventListener('touchstart', e=>{ e.preventDefault(); if(!gameRunning) startGame(); }, {passive:false});
  canvas.addEventListener('click', ()=>{ if(!gameRunning) startGame(); });
  addEventListener('keydown', e=>{
    const k=e.key.toLowerCase();
    if((isSpace(k)||isEnter(k)||k==='r') && !gameRunning){ e.preventDefault(); startGame(); return; }
    if(k==='p'){ paused=!paused; if(paused){ ovTitle.textContent='PAUSA'; ovSub.textContent='Pressione P para continuar'; overlay.classList.remove('hidden'); } else overlay.classList.add('hidden'); }
    if(k==='m'){ muted=!muted; }
  });

  // ===== Timers HUD =====
  function updTimers(){
    const show=(el,val)=>{ if(!el) return; if(val>0){ el.style.display='inline-block'; el.querySelector('b').textContent=Math.ceil(val); } else el.style.display='none'; };
    show(tShield, ship?.shield||0);
    show(tRapid,  ship?.rapid||0);
    show(tSlow,   timeScale<1 ? 3 : 0);
    requestAnimationFrame(updTimers);
  }
  requestAnimationFrame(updTimers);

})(); // fim IIFE

