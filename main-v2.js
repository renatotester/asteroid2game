/* --- Joystick analógico --- */
const stickEl = document.getElementById('stick');
const nubEl   = document.getElementById('nub');
const stick = { active:false, dx:0, dy:0, mag:0, cx:0, cy:0, radius:70 };

function resetNub(){
  nubEl.style.left="50%";
  nubEl.style.top="50%";
  nubEl.style.transform="translate(-50%,-50%)";
}
resetNub();

function updateStick(clientX, clientY){
  const r = stickEl.getBoundingClientRect();
  stick.cx = r.left + r.width/2;
  stick.cy = r.top + r.height/2;
  stick.radius = r.width/2 - 8;
  let dx = clientX - stick.cx, dy = clientY - stick.cy;
  const len = Math.hypot(dx,dy) || 0.0001;
  const k = Math.min(1, len / stick.radius);
  stick.dx = dx/len; stick.dy = dy/len; stick.mag = k;
  nubEl.style.left = (50 + stick.dx*50*k) + "%";
  nubEl.style.top  = (50 + stick.dy*50*k) + "%";
  nubEl.style.transform="translate(-50%,-50%)";
}

function stickStart(x,y){ stick.active=true; updateStick(x,y); }
function stickEnd(){ stick.active=false; stick.dx=stick.dy=0; stick.mag=0; resetNub(); }

/* Pointer + Touch events */
stickEl.addEventListener("pointerdown", e=>{ e.preventDefault(); stickStart(e.clientX,e.clientY); });
stickEl.addEventListener("pointermove", e=>{ if(stick.active) updateStick(e.clientX,e.clientY); });
stickEl.addEventListener("pointerup",   e=>{ stickEnd(); });
stickEl.addEventListener("pointercancel", e=>{ stickEnd(); });

stickEl.addEventListener("touchstart", e=>{
  e.preventDefault();
  const t=e.touches[0];
  stickStart(t.clientX,t.clientY);
},{passive:false});
stickEl.addEventListener("touchmove", e=>{
  e.preventDefault();
  const t=e.touches[0];
  if(stick.active) updateStick(t.clientX,t.clientY);
},{passive:false});
stickEl.addEventListener("touchend", e=>{ stickEnd(); });

