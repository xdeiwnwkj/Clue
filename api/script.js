// ─────────────────────────────────────────
// IMPORTANT: Replace this URL after you deploy the Worker on Cloudflare!
// ─────────────────────────────────────────
const API_URL = "https://broad-limit-1bb8.baconmasteroof.workers.dev";

// ── DEVTOOLS DETECTION ──
(function(){
  const ov = document.getElementById("devBlockOverlay");
  function block(){
    ov.style.display="flex";
    const troll=document.getElementById("trollArea");
    if(troll && troll.innerHTML) _savedTrollHTML=troll.innerHTML;
    ["question","clues","trollArea","status"].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.innerHTML="";
    });
    const a=document.getElementById("answer");
    if(a) a.value="";
  }
  function unblock(){
    ov.style.display="none";
    renderQuestion(); updateClues();
    const troll=document.getElementById("trollArea");
    if(troll && _savedTrollHTML) troll.innerHTML=_savedTrollHTML;
  }
  document.addEventListener("keydown",function(e){
    if(e.key==="F12"||(e.ctrlKey&&e.shiftKey&&/^[ijcIJC]$/.test(e.key))||(e.ctrlKey&&/^[uU]$/.test(e.key))){
      e.preventDefault(); e.stopPropagation(); block(); return false;
    }
  },true);
  document.addEventListener("contextmenu",e=>e.preventDefault());
  document.addEventListener("copy",e=>e.preventDefault());
  document.addEventListener("cut",e=>e.preventDefault());
  document.addEventListener("paste",e=>e.preventDefault());
  document.addEventListener("selectstart",e=>e.preventDefault());
  const th=160;
  setInterval(function(){
    if(window.outerWidth-window.innerWidth>th||window.outerHeight-window.innerHeight>th){
      block();
    } else {
      if(ov.style.display==="flex") unblock();
    }
  },500);
  setInterval(function(){
    const s=performance.now();
    debugger;
    if(performance.now()-s>300) block();
  },1000);
})();

// ── QUESTIONS (no answers here — only display text) ──
const _Q = [
  { qRaw: "54 68 61 69 6C 61 6E 64" },
  { qRaw: "Q2hhdEdQVA==" },
  { qRaw: "01000111 01001001 01000110 01010100 01000101 01000100 00100000 01000011 01001111 01001101 01010000 01010101 01010100 01000101 01010010" },
  { qRaw: "FRPSXWHU" }
];

let current = 0;
let unlocked = []; // stores clue texts returned from the server
let currentCode = "";
let _busy = false;
let _savedTrollHTML = "";

function renderQuestion(){
  if(current >= _Q.length){
    document.getElementById("question").innerText = "ภารกิจเสร็จสิ้น";
    document.getElementById("answer").style.display = "none";
    return;
  }
  document.getElementById("question").innerText = "ข้อ "+(current+1)+": "+_Q[current].qRaw;
}

function updateClues(){
  const container = document.getElementById("clues");
  container.innerHTML = "";
  for(let i = 0; i < _Q.length; i++){
    const div = document.createElement("div");
    if(unlocked[i]){
      div.className = "clue-item";
      div.innerHTML = `<div class="clue-header"><span class="clue-label">ส่วนที่ ${i+1}</span><button class="copy-btn" onclick="copyClue(${i})" title="คัดลอก">📋 คัดลอก</button></div><div class="clue-text" id="clue-text-${i}"></div>`;
      div.querySelector(`#clue-text-${i}`).textContent = unlocked[i];
    } else {
      div.className = "clue-item locked";
      div.innerHTML = `<div class="clue-label">ส่วนที่ ${i+1} : [ล็อก]</div>`;
    }
    container.appendChild(div);
  }
}

function copyClue(i){
  if(!unlocked[i]) return;
  _copyText(unlocked[i], document.querySelectorAll('#clues .copy-btn')[i]);
}
function copyQuestion(){
  const el = document.getElementById("question");
  if(!el||!el.textContent) return;
  _copyText(el.textContent, document.getElementById("copyQuestionBtn"));
}
function _copyText(text, btn){
  function flash(){
    if(btn){ btn.classList.add("copied"); btn.textContent="✓ คัดลอกแล้ว"; setTimeout(()=>{ btn.classList.remove("copied"); btn.innerHTML="📋 คัดลอก"; },1500); }
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(flash).catch(()=>{ _copyFallback(text); flash(); });
  } else { _copyFallback(text); flash(); }
}
function _copyFallback(text){
  const ta=document.createElement("textarea"); ta.value=text; ta.style.cssText="position:fixed;opacity:0;top:0;left:0;"; document.body.appendChild(ta); ta.focus(); ta.select(); try{ document.execCommand("copy"); }catch(e){} document.body.removeChild(ta);
}
function normalize(s){ return s.trim().toLowerCase(); }
function setAnswerBtn(disabled){ const btn=document.querySelector('.card button'); if(btn) btn.disabled=disabled; }

// ── CHECK ANSWER via API ──
async function checkAnswer(){
  if(_busy) return;
  const userAnswer = normalize(document.getElementById("answer").value);
  if(!userAnswer) return;

  _busy = true;
  setAnswerBtn(true);
  document.getElementById("status").innerHTML = "<span style='color:#8b949e'>กำลังตรวจสอบ...</span>";

  try {
    const res = await fetch(API_URL + "/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Key": "my-super-secret-key-123"
      },
      body: JSON.stringify({
        stage: current,
        answer: userAnswer
      })
    });
    const data = await res.json();

    if(data.correct){
      // Server returns the clue only when the answer is right
      unlocked[current] = data.clue;
      startTrollStage();
    } else {
      document.getElementById("status").innerHTML = "<span class='error'>คำตอบไม่ถูกต้อง</span>";
      setAnswerBtn(false);
      _busy = false;
    }
  } catch(e) {
    document.getElementById("status").innerHTML = "<span class='error'>เชื่อมต่อ API ไม่ได้ ลองใหม่</span>";
    setAnswerBtn(false);
    _busy = false;
  }
}

// ── HINT via API ──
async function fetchHint(){
  try {
    const res = await fetch(API_URL + "/hint", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Key": "my-super-secret-key-123"
      },
      body: JSON.stringify({
        stage: current
      })
    });
    const data = await res.json();
    return data.hint || "?";
  } catch(e) { return "เชื่อมต่อไม่ได้"; }
}

function unlockStage(){
  current++;
  updateClues(); renderQuestion();
  document.getElementById("answer").value = "";
  document.getElementById("status").innerHTML = "<span class='success'>ปลดล็อกสำเร็จ</span>";
  document.getElementById("trollArea").innerHTML = "";
  _savedTrollHTML = "";
  resetHint();
  setAnswerBtn(false);
  _busy = false;
}

function scrollToTroll(){
  setTimeout(()=>{ const el=document.getElementById("trollArea"); if(el) el.scrollIntoView({behavior:"smooth",block:"start"}); },120);
}
function startTrollStage(){
  const m=current%5;
  if(m===0)fakeAd();
  else if(m===1)fakeAI();
  else if(m===2)runawayButton();
  else if(m===3)fakeLoading();
  else codeGate();
  scrollToTroll();
}
function fakeAd(){
  let sec=60, done=false;
  document.getElementById("trollArea").innerHTML=`<div class="card"><h3>📺 โปรดรอสักครู่...</h3><p id="count">${sec}</p></div>`;
  let t=setInterval(()=>{ sec--; document.getElementById("count").innerText=sec; if(sec<=0&&!done){ done=true; clearInterval(t); unlockStage(); } },1000);
}
function fakeAI(){
  generateCode();
  document.getElementById("trollArea").innerHTML=`<div class="card"><h3>🤖 AI VERIFICATION</h3><p>พิมพ์รหัสนี้:</p><h2 style="color:#ffcc00">${currentCode}</h2><input id="humanInput" placeholder="15 ตัวอักษร"><button onclick="verifyHuman()">ยืนยัน</button></div>`;
}
function verifyHuman(){ if(document.getElementById("humanInput").value.trim()===currentCode) unlockStage(); else alert("❌ AI DETECTED"); }
function runawayButton(){
  document.getElementById("trollArea").innerHTML=`<div class="card" id="runawayCard" style="min-height:200px;position:relative;"><h3>🎯 จับปุ่มให้ได้</h3><button id="runaway" style="position:absolute;left:50%;top:60%;transform:translate(-50%,-50%);">กดฉัน</button></div>`;
  const btn=document.getElementById("runaway"); const card=document.getElementById("runawayCard"); let caught=false;
  function moveBtn(){ if(caught) return; const cw=card.offsetWidth,ch=card.offsetHeight,bw=btn.offsetWidth+8,bh=btn.offsetHeight+8,padTop=52,maxX=Math.max(0,cw-bw),maxY=Math.max(0,ch-bh-padTop); btn.style.left=Math.floor(Math.random()*maxX)+"px"; btn.style.top=Math.floor(padTop+Math.random()*maxY)+"px"; btn.style.transform="none"; }
  btn.addEventListener("mouseenter",moveBtn);
  btn.addEventListener("touchstart",e=>{ e.preventDefault(); moveBtn(); },{passive:false});
  btn.onclick=()=>{ if(caught) return; caught=true; btn.disabled=true; unlockStage(); };
}
function fakeLoading(){
  document.getElementById("trollArea").innerHTML=`<div class="card"><h3>⏳ Processing...</h3><progress id="bar" value="0" max="100"></progress></div>`;
  let p=0,done=false; let t=setInterval(()=>{ p+=Math.random(); document.getElementById("bar").value=p; if(p>=100&&!done){ done=true; clearInterval(t); unlockStage(); } },200);
}
function generateCode(){ const chars="1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzกขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ"; let c=""; for(let i=0;i<15;i++) c+=chars[Math.floor(Math.random()*chars.length)]; currentCode=c; }
function codeGate(){ generateCode(); document.getElementById("trollArea").innerHTML=`<div class="card"><h3>🔐 VERIFY CODE</h3><p>พิมพ์รหัสให้ตรง:</p><h2 style="color:#ffcc00">${currentCode}</h2><input id="codeInput"><button onclick="checkCode()">ยืนยัน</button></div>`; }
function checkCode(){ if(document.getElementById("codeInput").value.trim()===currentCode) unlockStage(); else alert("❌ WRONG CODE"); }

// ── HINT SYSTEM ──
let _hintClicks = 0;
const HINT_TARGET = 300;

async function hintClick(){
  _hintClicks++;
  const pct = Math.min((_hintClicks / HINT_TARGET) * 100, 100);
  const bar = document.getElementById("hintBar");
  const btn = document.getElementById("hintBtn");
  const box = document.getElementById("hintBox");
  const isAlmost = _hintClicks >= 210;
  bar.style.width = pct + "%";
  if(_hintClicks >= HINT_TARGET){
    bar.className = "hint-progress-bar ready";
    btn.className = "hint-btn ready";
    btn.innerHTML = "💡 กำลังโหลดคำใบ้...";
    const hintText = await fetchHint();
    const labels = ["HEX","BASE64","BINARY","CAESAR (ROT13)"];
    box.style.display = "block";
    box.innerHTML = `<span style="color:#8b949e;font-size:0.78rem;display:block;margin-bottom:4px;">${labels[current]}</span>${hintText}`;
    btn.innerHTML = "💡 คำใบ้ปลดล็อกแล้ว!";
  } else {
    bar.className = "hint-progress-bar" + (isAlmost ? " almost" : "");
    btn.className = "hint-btn" + (isAlmost ? " almost" : "");
    btn.innerHTML = `💡 คลิก 300 ครั้งเพื่อดูคำใบ้ <span id="hintCount">(${_hintClicks}/300)</span>`;
  }
}
function resetHint(){
  _hintClicks = 0;
  const bar=document.getElementById("hintBar"); const btn=document.getElementById("hintBtn"); const box=document.getElementById("hintBox");
  if(bar){ bar.style.width="0%"; bar.className="hint-progress-bar"; }
  if(btn){ btn.className="hint-btn"; btn.innerHTML=`💡 คลิก 300 ครั้งเพื่อดูคำใบ้ <span id="hintCount">(0/300)</span>`; }
  if(box){ box.style.display="none"; box.textContent=""; }
}

renderQuestion(); updateClues();
