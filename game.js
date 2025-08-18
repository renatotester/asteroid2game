/* ASTRO OPS PRO+ — GitHub Pages safe build (sem conflito de globals) */
(() => {
  'use strict';

  // ===== Canvas / DPI / Sizing =====
  const DPR = Math.max(1, self.devicePixelRatio || 1);
  const rootEl = document.getElementById('wrap');
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

  // ===== (código do jogo segue igual até o loop) =====

  // ===== Loop principal =====
  let last=performance.now(), acc=0, fCnt=0, fTimer=0, ufoTimer=8;

  function update(dtRaw){ /* ...igual ao anterior... */ }
  function render(){ /* ...igual ao anterior... */ }

  function loop(now){
    const dt=Math.min(.05,(now-last)/1000);
    last=now;
    acc+=dt; fTimer+=dt; fCnt++;
    while(acc>1/120){ update(1/120); acc-=1/120; }
    render();
    if(fTimer>=.5){ elFPS.textContent=Math.max(1,Math.round(fCnt/fTimer)); fTimer=0; fCnt=0; }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ===== Flow / StartGame / GameOver =====
  // (resto do código sem alteração)
})();
