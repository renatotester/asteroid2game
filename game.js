/* ASTRO OPS — Versão 2: simples, estável e sem colisões de nomes */
(() => {
  'use strict';

  // ===== Canvas / DPI / Sizing =====
  const DPR = Math.max(1, self.devicePixelRatio || 1);
  const rootEl  = document.getElementById('wrap');
  const canvas  = document.getElementById('game');
  const ctx     = canvas.getContext('2d', { alpha:false });

  function fitCanvas(){
    const hud  = document.querySelector('.hud');
    const help = document.querySelector('.help');
    const availH = Math.max(240, innerHeight - (hud?.offsetHeight||0) - (help?.offsetHeight||0));
    canvas.style.height = availH + 'px';
    const rect = canvas.getBoundingClientRect();
    const w = rect.width  || (canvas.parentElement?.clientWidth || innerWidth);
    const h = rect.height || availH;
    canvas.width  = Math.round(w * DPR);
    canvas.height = Math.round(h * DPR);
  }
  addEventListener('resize', () => requestAnimationFrame(fitCanvas), { passive:true });
  requestAnimationFrame(() => requestAnimationFrame(fitCanvas));

  // ===== Fullscreen =====
  const btnFS = document.getElementById('btnFS');
  async function toggleFS(){
    try{
      if(!document.fullscreenElement){ await (rootEl.requestFullscreen?.call(rootEl)); }
      else{ await (document.exitFullscreen?.call(document)); }
    }catch{ /* ignora */ }
    setTimeout(fitCanvas, 60);
  }
  btnFS.addEventListener('click', toggleFS);
  addEventListener('keydown', e=>{ if(e.key.toLowerCase()==='f'){ e.preventDefault(); toggleFS(); }});

  // ===== HUD / Overlay =====
  const $ = s => document.querySelector(s);
  const scEl = $('#score'), lvEl = $('#level'), hiEl = $('#hi');
  const overlay = $('#overlay'), ovMsg = $('#ovMsg'), ovScore = $('#ovScore'), ovHi = $('#ovHi'), ovLevel = $('#ovLevel');

  // ===== Utils =====
  const W = () => canvas.width, H = () => canvas.height;
  const rand=(a=1,b)=> b===undefined?Math.random()*a: a+Math.random()*(b-a);
  const rint=(a,b)=> Math.floor(rand(a,b));
  const wrap=(v,max)=> (v+max)%max;
  const dist2=(a,b)=>{ const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy; };

  // ===== Áudio bip =====
  let audio=null, muted=false;
  try{
    const AC = self.AudioContext||self.webkitAudioContext; audio = new AC();
    const unlock = ()=>{ if(audio.state==='suspended') audio.resume(); removeEventListener('pointerdown',unlock); removeEventListener('keydown',unlock); };
    addEventListener('pointerdown',unlock,{once:true}); addEventListener('keydown',unlock,{once:true});
  }catch{ muted=true; }
  function beep({f=440,t='square',d=.08,v=.2}={}){ if(muted||!audio) return;
    const t0=audio.currentTime, o=audio.createOscillator(), g=audio.createGain();
    o.type=t; o.frequency.setValueAtTime(f,t0);
    g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(v,t0+.005); g.gain.exponentialRampToValueAtTime(.0001,t0+d+.05);
    o.connect(g).connect(audio.destination); o.start(t0); o.stop(t0+d+.06);
  }
  const sShoot=()=>beep({f:880,t:'square',d:.06,v:.18});
  const sBoom =()=>beep({f:120,t:'triangle',d:.22,v:.3});

  // ===== Estado =====
  const state = {
    running:false, paused:false,
    score:0, level:1, lives:3,
    hi: Number(localStorage.getItem('astroops.v2.hi')||0)
  };
  hiEl.textContent = state.hi; ovHi.textContent = state.hi;

  // ===== Entidades =====
  class Ship{
    constructor(){
      this.x=W()/2; this.y=H()/2; this.vx=0; this.vy=0; this.a=-Math.PI/2;
      this.r=16*DPR; this.cool=0; this.inv=2; this.thr=false;
    }
    update(dt, keys){
      const rot=3.4, acc=300*DPR, damp=.995;
      if(keys.left)  this.a -= rot*dt;
      if(keys.right) this.a += rot*dt;
      this.thr = keys.up;
      if(this.thr){ this.vx+=Math.cos(this.a)*acc*dt; this.vy+=Math.sin(this.a)*acc*dt; }
      this.vx*=Math.pow(damp,dt*60); this.vy*=Math.pow(damp,dt*60);
      this.x = wrap(this.x + this.vx*dt, W()); this.y = wrap(this.y + this.vy*dt, H());
      this.cool -= dt;
      if(keys.fire && this.cool<=0){ this.shoot(); this.cool=.18; }
      if(this.inv>0) this.inv-=dt;
    }
    shoot(){
      const sp=700*DPR;
      bullets.push(new Bullet(this.x+Math.cos(this.a)*this.r, this.y+Math.sin(this.a)*this.r, this.vx+Math.cos(this.a)*sp, this.vy+Math.sin(this.a)*sp));
      sShoot();
    }
    draw(){
      const blink = this.inv>0 && Math.floor(this.inv*10)%2===0;
      ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.a); ctx.lineWidth=2*DPR;
      ctx.strokeStyle= blink ? 'rgba(179,243,255,.5)' : '#b3f3ff';
      ctx.beginPath();
      ctx.moveTo(18*DPR,0); ctx.lineTo(-14*DPR,11*DPR); ctx.lineTo(-8*DPR,0); ctx.lineTo(-14*DPR,-11*DPR); ctx.closePath(); ctx.stroke();
      if(this.thr && !blink){ ctx.strokeStyle='#45ff9c'; ctx.beginPath(); ctx.moveTo(-14*DPR,6*DPR); ctx.lineTo(-24*DPR,0); ctx.lineTo(-14*DPR,-6*DPR); ctx.stroke(); }
      ctx.restore();
    }
  }
  class Bullet{
    constructor(x,y,vx,vy){ this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.r=2.5*DPR; this.life=.9; }
    update(dt){ this.life-=dt; this.x=wrap(this.x+this.vx*dt,W()); this.y=wrap(this.y+this.vy*dt,H()); }
    draw(){ ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fill(); }
  }
  class Rock{
    constructor(x,y,size=3){
      this.x=x; this.y=y; this.s=size;
      const sp=rand(30,80)*(4-size)*DPR, ang=rand(0,Math.PI*2);
      this.vx=Math.cos(ang)*sp; this.vy=Math.sin(ang)*sp; this.a=rand(0,Math.PI*2); this.rot=rand(-1,1);
      this.r=(size===3?46:size===2?28:16)*DPR;
      const n=rint(9,14);
      this.poly=Array.from({length:n},(_,i)=>{const t=i/n*Math.PI*2, R=this.r*rand(.78,1.12); return {x:Math.cos(t)*R,y:Math.sin(t)*R};});
    }
    update(dt){ this.x=wrap(this.x+this.vx*dt,W()); this.y=wrap(this.y+this.vy*dt,H()); this.a+=this.rot*dt; }
    split(){ if(this.s>1){ rocks.push(new Rock(this.x,this.y,this.s-1), new Rock(this.x,this.y,this.s-1)); } }
    draw(){
      ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.a); ctx.lineWidth=2*DPR; ctx.strokeStyle='#9bd4ff';
      const p=this.poly; ctx.beginPath(); ctx.moveTo(p[0].x,p[0].y); for(let i=1;i<p.length;i++) ctx.lineTo(p[i].x,p[i].y); ctx.closePath(); ctx.stroke();
      ctx.restore();
    }
  }

  // ===== Entrada =====
  const keys = { left:false,right:false,up:false,fire:false };
  addEventListener('keydown', e=>{
    const k=e.key.toLowerCase();
    if(['arrowleft','arrowright','arrowup',' '].includes(e.key)) e.preventDefault();
    if(k==='arrowleft') keys.left=true;
    if(k==='arrowright')keys.right=true;
    if(k==='arrowup')   keys.up=true;
    if(k===' ')         keys.fire=true;
    if(k==='p')         togglePause();
    if(k==='r' && !state.running) startGame();
    if((k===' '||k==='enter') && !state.running) startGame();
  });
  addEventListener('keyup', e=>{
    const k=e.key.toLowerCase();
    if(k==='arrowleft') keys.left=false;
    if(k==='arrowright')keys.right=false;
    if(k==='arrowup')   keys.up=false;
    if(k===' ')         keys.fire=false;
  });
  overlay.addEventListener('click', ()=>{ if(!state.running) startGame(); });

  // ===== Jogo =====
  let ship=null;
  let bullets=[], rocks=[];
  const stars = Array.from({length:120}, ()=>({x:Math.random(), y:Math.random(), z:rand(.4,1.4)}));

  function spawnLevel(){
    bullets.length=0; rocks.length=0;
    const n = 3 + state.level;
    for(let i=0;i<n;i++){
      let x,y; do{ x=rand(0,W()); y=rand(0,H()); }while(dist2({x,y}, ship||{x:W()/2,y:H()/2}) < (220*DPR)**2);
      rocks.push(new Rock(x,y,3));
    }
  }

  function startGame(){
    state.score=0; state.level=1; state.lives=3;
    scEl.textContent=0; lvEl.textContent=1;
    ship = new Ship();
    spawnLevel();
    overlay.classList.add('hidden');
    state.running=true; state.paused=false;
    canvas.focus({preventScroll:true});
  }

  function gameOver(){
    state.running=false;
    if(state.score>state.hi){ state.hi=state.score; localStorage.setItem('astroops.v2.hi', state.hi); }
    hiEl.textContent = state.hi;
    ovScore.textContent = state.score; ovHi.textContent = state.hi; ovLevel.textContent = state.level;
    ovMsg.innerHTML='GAME OVER — Pressione <b>R</b>, <b>Espaço</b>, <b>Enter</b> ou <b>Clique</b> para reiniciar';
    overlay.classList.remove('hidden');
  }

  function togglePause(){
    if(!state.running) return;
    state.paused = !state.paused;
    ovMsg.textContent = 'PAUSA — Pressione P para continuar';
    if(state.paused) overlay.classList.remove('hidden'); else overlay.classList.add('hidden');
  }

  // ===== Loop (nomes exclusivos para evitar qualquer colisão) =====
  let loopPrev = performance.now();
  function update(dt){
    // estrelas
    for(const s of stars){ s.x = (s.x + 0.04*dt*s.z) % 1; }

    // nave
    ship.update(dt, keys);

    // balas
    for(let i=bullets.length-1;i>=0;i--){ bullets[i].update(dt); if(bullets[i].life<=0) bullets.splice(i,1); }

    // rochas
    for(let i=0;i<rocks.length;i++) rocks[i].update(dt);

    // colisões bala-rocha
    for(let i=rocks.length-1;i>=0;i--){
      const r=rocks[i];
      for(let j=bullets.length-1;j>=0;j--){
        const b=bullets[j];
        if(dist2(r,b) < (r.r+b.r)**2){
          bullets.splice(j,1);
          sBoom();
          if(r.s>1) r.split();
          rocks.splice(i,1);
          state.score += (r.s===3?60:r.s===2?90:140);
          scEl.textContent = state.score;
          break;
        }
      }
    }

    // colisão nave-rocha
    for(const r of rocks){
      if(dist2(ship,r) < (ship.r+r.r)**2){
        if(ship.inv<=0){
          state.lives--;
          sBoom();
          ship = new Ship();
          if(state.lives<0){ gameOver(); return; }
        }
        break;
      }
    }

    // nível completo
    if(rocks.length===0){
      state.level++; lvEl.textContent = state.level;
      spawnLevel();
    }
  }

  function render(){
    // fundo
    ctx.fillStyle = '#08131d'; ctx.fillRect(0,0,W(),H());
    // estrelas
    ctx.fillStyle='#87b2d0';
    for(const s of stars){ ctx.fillRect((s.x*W())|0, (s.y*H())|0, (1.2*s.z)*DPR, (1.2*s.z)*DPR); }

    // entidades
    rocks.forEach(r=>r.draw());
    bullets.forEach(b=>b.draw());
    ship.draw();

    // vidas (mini naves)
    ctx.save(); ctx.translate(12*DPR,14*DPR);
    for(let i=0;i<Math.max(0,state.lives);i++){
      ctx.save(); ctx.translate(i*20*DPR,0);
      ctx.strokeStyle='#45ff9c'; ctx.lineWidth=2*DPR;
      ctx.beginPath(); ctx.moveTo(10*DPR,0); ctx.lineTo(-8*DPR,7*DPR); ctx.lineTo(-4*DPR,0); ctx.lineTo(-8*DPR,-7*DPR); ctx.closePath(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function loop(now){
    const dt = Math.min(0.05, (now - loopPrev)/1000);
    loopPrev = now;
    if(state.running && !state.paused){ update(dt); }
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Estado inicial
  ovScore.textContent = '0'; ovLevel.textContent = '1';
  overlay.classList.remove('hidden');
})();

