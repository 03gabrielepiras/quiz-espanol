"use strict";

/* ====== CONFIG ====== */
const TOTAL_BANK = 250;

/* ====== DOM ====== */
const $ = (id) => document.getElementById(id);

/* ====== Utils ====== */
function randInt(n){ return Math.floor(Math.random()*n); }
function pick(arr){ return arr[randInt(arr.length)]; }
function shuffle(a){
  const arr = a.slice();
  for(let i=arr.length-1;i>0;i--){
    const j = randInt(i+1);
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}
function norm(s){
  return (s??"").trim().toLowerCase().replace(/\s+/g," ").replace(/[.?!]+$/g,"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}
function escapeHtml(str){
  return (str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* ====== Glossario ES->IT (base, estendibile) ====== */
const GLOSS = {
  "hay":"c'e / ci sono",
  "aqui":"qui",
  "ahi":"li (vicino a te)",
  "alli":"la (lontano)",
  "encima de":"sopra (a)",
  "debajo de":"sotto (a)",
  "delante de":"davanti a",
  "detras de":"dietro a",
  "al lado de":"accanto a",
  "dentro de":"dentro (a)",
  "fuera de":"fuori da",
  "entre":"tra / fra",
  "se llama":"si chiama",
  "tiene":"ha",
  "tener":"avere",
  "es":"e",
  "ser":"essere",
  "cocina":"cucina",
  "salon":"salotto",
  "bano":"bagno",
  "dormitorio":"camera da letto",
  "comedor":"sala da pranzo",
  "cama":"letto",
  "silla":"sedia",
  "mesa":"tavolo",
  "sofa":"divano",
  "nevera":"frigo",
  "cuadro":"quadro",
  "padre":"padre",
  "madre":"madre",
  "abuelo":"nonno",
  "abuela":"nonna",
};

const PHRASES = Object.keys(GLOSS).filter(k=>k.includes(" ")).sort((a,b)=>b.length-a.length);

function wrapGloss(text){
  let html = escapeHtml(text);
  // frasi
  for(const phrase of PHRASES){
    const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\$&")}\\b`,"gi");
    html = html.replace(re,(m)=>{
      const key = phrase;
      return `<span class="gloss-word" data-key="${escapeHtml(key)}" data-es="${escapeHtml(m)}">${escapeHtml(m)}</span>`;
    });
  }
  // singole
  html = html.replace(/\b([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\b/g,(m)=>{
    const key = norm(m);
    if(!GLOSS[key]) return m;
    return `<span class="gloss-word" data-key="${escapeHtml(key)}" data-es="${escapeHtml(m)}">${escapeHtml(m)}</span>`;
  });
  return html;
}

function showGloss(el){
  const key = el.getAttribute("data-key");
  const es = el.getAttribute("data-es");
  const it = GLOSS[key];
  if(!it) return;
  const tip = $("glossTooltip");
  $("glossIt").textContent = `IT: ${it}`;
  $("glossEs").textContent = `ES: ${es}`;
  const r = el.getBoundingClientRect();
  tip.style.left = `${Math.min(r.left, window.innerWidth-340)}px`;
  tip.style.top = `${Math.min(r.bottom+10, window.innerHeight-120)}px`;
  tip.classList.remove("hidden");
}
function hideGloss(){ $("glossTooltip").classList.add("hidden"); }

/* ====== Dati lessico ====== */
const rooms = ["la cocina","el salon","el comedor","el dormitorio","el bano","el pasillo","la terraza","el balcon","el jardin"]; 
const objects = [
  {s:"una mesa", key:"mesa"},
  {s:"una silla", key:"silla"},
  {s:"un sofa", key:"sofa"},
  {s:"una cama", key:"cama"},
  {s:"una nevera", key:"nevera"},
  {s:"un cuadro", key:"cuadro"},
  {s:"una lampara", key:"lampara"},
  {s:"una puerta", key:"puerta"},
  {s:"una ventana", key:"ventana"},
  {s:"una alfombra", key:"alfombra"},
  {s:"una padella", key:"padella"} // italianismo: lo usiamo per aggancio, vedi note
];
const family = ["mi madre","mi padre","mi hermano","mi hermana","mi abuelo","mi abuela"]; 
const preps = [
  {k:"encima de", it:"sopra a"},
  {k:"debajo de", it:"sotto a"},
  {k:"delante de", it:"davanti a"},
  {k:"detras de", it:"dietro a"},
  {k:"al lado de", it:"accanto a"},
  {k:"dentro de", it:"dentro a"},
  {k:"fuera de", it:"fuori da"},
  {k:"entre", it:"tra"},
];
const deictics = ["aqui","ahi","alli"]; 

/* ====== Modelli domanda ====== */
function qMCQ({prompt, choices, correctIndex, tag, postit}){
  return { type:"mcq", prompt, choices, correctIndex, tag, postit };
}
function qOPEN({prompt, tag, postit, checkFn, sample}){
  return { type:"open", prompt, tag, postit, checkFn, sample };
}
function qFILL({prompt, tag, postit, sentence, missing, answers, hint}){
  // sentence: array di token/segmenti, con "____" dove manca
  return { type:"fill", prompt, tag, postit, sentence, missing, answers, hint };
}

/* ====== Post-it helper ====== */
function postIt(title, ruleIt, examples=[], vocab=[]){
  return { title, ruleIt, examples, vocab };
}
function renderPostit(p){
  if(!p) return "";
  const ex = (p.examples||[]).map(e=>`<li>${wrapGloss(e)}</li>`).join("");
  const vb = (p.vocab||[]).map(v=>`<li><strong>${wrapGloss(v.es)}</strong> = ${escapeHtml(v.it)}</li>`).join("");
  return `
    <div class="muted"><strong>${escapeHtml(p.title)}</strong></div>
    <div style="margin-top:6px;">${escapeHtml(p.ruleIt)}</div>
    ${p.examples?.length?`<div style="margin-top:8px;"><strong>Esempi:</strong><ul>${ex}</ul></div>`:""}
    ${p.vocab?.length?`<div style="margin-top:8px;"><strong>Parole utili:</strong><ul>${vb}</ul></div>`:""}
  `;
}

/* ====== Validatori (piu permissivi) ====== */
function checkBetween(user){
  const u = norm(user);
  if(!u.includes("hay")) return {ok:false, msg:"Devi usare 'hay'."};
  if(!u.includes("entre")) return {ok:false, msg:"Devi usare 'entre'."};
  if(!u.includes(" y ")) return {ok:false, msg:"Con 'entre' servono due elementi: 'entre A y B'."};
  return {ok:true, msg:"Ok: struttura 'hay ... entre A y B' corretta."};
}
function checkDeictic(d){
  return (user)=>{
    const u = norm(user);
    if(!u.startsWith(d)) return {ok:false, msg:`Qui chiediamo di iniziare con '${d}'.`};
    if(!u.includes(" hay ") && !u.includes(" hay")) return {ok:false, msg:"Devi usare 'hay'."};
    return {ok:true, msg:"Ok: deittico + hay corretti."};
  };
}
function checkFamily(user){
  const u = norm(user);
  if(!u.includes("se llama")) return {ok:false, msg:"Manca 'se llama' (si chiama)."};
  if(!u.includes("tiene")) return {ok:false, msg:"Manca 'tiene' per l'età (tiene ... años)."};
  // bonus: se c'e es + professione ok, ma non obbligatorio
  return {ok:true, msg:"Ok: se llama + tiene (eta) usati correttamente."};
}
function checkMucho(user){
  const u = norm(user);
  if(!u.includes("hay")) return {ok:false, msg:"Devi usare 'hay'."};
  if(!(u.includes("mucho")||u.includes("mucha")||u.includes("muchos")||u.includes("muchas"))){
    return {ok:false, msg:"Devi usare una forma di 'mucho/a/os/as'."};
  }
  return {ok:true, msg:"Ok: hai usato 'hay' + una forma di 'mucho'."};
}

/* ====== Generazione banca (mix semplice) ====== */
function buildBank(){
  const out = [];

  // 1) MCQ grammatica base
  for(let i=0;i<120;i++){
    const o = pick(objects);
    const r = pick(rooms);
    const correct = `Hay ${o.s} en ${r}.`;
    const choices = shuffle([
      correct,
      `Esta ${o.s} en ${r}.`,
      `Hay ${o.s} ${r}.`,
      `Soy ${o.s} en ${r}.`
    ]);
    out.push(qMCQ({
      prompt:"Scegli la frase corretta (esistenza):",
      choices,
      correctIndex: choices.indexOf(correct),
      tag:"HAY",
      postit: postIt(
        "HAY (c'e / ci sono)",
        "Usa HAY per dire che qualcosa ESISTE in un luogo: Hay + nome + en + luogo.",
        ["Hay una mesa en el salon.","En el bano hay una silla."],
        [{es:"hay", it:"c'e / ci sono"},{es:"en", it:"in"},{es:o.s, it:`oggetto (${o.key})`},{es:r, it:"stanza"}]
      )
    }));
  }

  // 2) Open: deictics
  for(let i=0;i<30;i++){
    const d = pick(deictics);
    const o = pick(objects);
    const r = pick(rooms);
    out.push(qOPEN({
      prompt:`Scrivi una frase corretta con '${d}' + 'hay' + oggetto + stanza.`,
      tag:"DEICTICOS",
      sample:`${d} hay ${o.s} en ${r}.`,
      checkFn: checkDeictic(d),
      postit: postIt(
        "Deittici (qui/li/la)",
        "Struttura: aqui/ahi/alli + hay + nome + en + luogo.",
        [`${d} hay un cuadro en el salon.`,"aqui hay una cama en el dormitorio."],
        [{es:"aqui", it:"qui"},{es:"ahi", it:"li"},{es:"alli", it:"la"},{es:"hay", it:"c'e/ci sono"}]
      )
    }));
  }

  // 3) Open: entre
  for(let i=0;i<25;i++){
    const o1 = pick(objects);
    const o2 = pick(objects);
    const r = pick(rooms);
    out.push(qOPEN({
      prompt:"Scrivi una frase con 'hay' usando la posizione 'entre'.",
      tag:"PREPOSICIONES",
      sample:`Hay ${o1.s} entre ${o2.s} y una silla en ${r}.`,
      checkFn: checkBetween,
      postit: postIt(
        "ENTRE (tra A e B)",
        "Con ENTRE non mettere 'de'. Serve: entre A y B.",
        ["Hay una mesa entre la cocina y el salon.","El cuadro esta entre la ventana y la puerta."],
        [{es:"entre", it:"tra"},{es:"y", it:"e"},{es:o1.s, it:"oggetto"},{es:"salon", it:"salotto"}]
      )
    }));
  }

  // 4) Fill-in: coniugazione presente (solo -er/-ir base)
  const verbSets = [
    {inf:"comer", it:"mangiare", root:"com", endings:{yo:"o",tu:"es",el:"e",nos:"emos",vos:"eis",ellos:"en"}},
    {inf:"vivir", it:"vivere", root:"viv", endings:{yo:"o",tu:"es",el:"e",nos:"imos",vos:"is",ellos:"en"}},
  ];
  const persons = [
    {k:"yo", label:"yo"},
    {k:"tu", label:"tu"},
    {k:"el", label:"el/ella"},
    {k:"nos", label:"nosotros"},
    {k:"ellos", label:"ellos/ellas"},
  ];
  for(let i=0;i<35;i++){
    const v = pick(verbSets);
    const p = pick(persons);
    const correct = v.root + v.endings[p.k];
    const sent = [`${p.label} `, "____", " en casa."];
    out.push(qFILL({
      prompt:`Completa la frase: presente indicativo. Verbo (${v.inf}) = ${v.it}.`,
      tag:"VERBI",
      sentence: sent,
      missing:"verbo",
      answers:[correct],
      hint:`Coniuga ${v.inf}: ${p.label} -> ${correct}`,
      postit: postIt(
        "Presente indicativo (verbi regolari)",
        "Regola rapida: -ER: yo -o, tu -es, el -e, nosotros -emos, ellos -en. -IR: yo -o, tu -es, el -e, nosotros -imos, ellos -en.",
        [`(${v.inf}) yo ${v.root+v.endings.yo}, tu ${v.root+v.endings.tu}, el ${v.root+v.endings.el}`],
        [{es:v.inf, it:v.it},{es:"presente", it:"presente"}]
      )
    }));
  }

  // 5) Open: famiglia (piu libera)
  for(let i=0;i<40;i++){
    const who = pick(family);
    out.push(qOPEN({
      prompt:`Scrivi una frase su '${who}': nome + eta (tiene ... anos). Puoi aggiungere altro.`,
      tag:"FAMILIA",
      sample:`${who} se llama Elena y tiene 65 anos.`,
      checkFn: checkFamily,
      postit: postIt(
        "Famiglia: presentare una persona",
        "Struttura base: X se llama + nombre; tiene + edad (+ anos). (Opzionale) Es + profesion / No trabaja / Esta jubilado.",
        ["Mi abuelo se llama Mario y tiene 70 anos.","Mi madre se llama Ana y tiene 45 anos. Es profesora."],
        [{es:"se llama", it:"si chiama"},{es:"tiene", it:"ha"},{es:"anos", it:"anni"},{es:"es", it:"e"}]
      )
    }));
  }

  // 6) MCQ mucho
  for(let i=0;i<30;i++){
    const correct = "Hay muchas sillas en el salon.";
    const choices = shuffle([
      correct,
      "Hay mucha sillas en el salon.",
      "Hay muchos silla en el salon.",
      "Hay mucho sillas en el salon.",
    ]);
    out.push(qMCQ({
      prompt:"Scegli la frase corretta (mucho):",
      choices,
      correctIndex: choices.indexOf(correct),
      tag:"MUCHO",
      postit: postIt(
        "MUCHO (molto/molti)",
        "Concorda in genere/numero: mucho (m sing), mucha (f sing), muchos (m pl), muchas (f pl).",
        ["Hay muchas sillas.","Hay mucho pan."],
        [{es:"muchas", it:"molte"},{es:"muchos", it:"molti"},{es:"mucha", it:"molta"},{es:"mucho", it:"molto"}]
      )
    }));
  }

  // completa fino a 250 con shuffle
  const filled = shuffle(out).slice(0, TOTAL_BANK);
  while(filled.length < TOTAL_BANK){
    filled.push(pick(out));
  }
  return filled.slice(0,TOTAL_BANK);
}

const BANK = buildBank();

/* ====== Stato quiz ====== */
let mode = "train"; // train | verify
let running = false;
let startTime = 0;
let timerHandle = null;

let quiz = [];
let current = 0;
let answers = []; // per domanda: {selectedIndex?, text? , correct?}
let locked = [];  // train: risposta data

/* ====== Timer ====== */
function fmtTime(sec){
  const m = String(Math.floor(sec/60)).padStart(2,'0');
  const s = String(sec%60).padStart(2,'0');
  return `${m}:${s}`;
}
function tick(){
  const sec = Math.floor((Date.now()-startTime)/1000);
  $("timer").textContent = fmtTime(sec);
}
function startTimer(){
  startTime = Date.now();
  tick();
  timerHandle = setInterval(tick, 1000);
}
function stopTimer(){
  if(timerHandle){ clearInterval(timerHandle); timerHandle=null; }
}

/* ====== UI helpers ====== */
function scoreNow(){
  let s = 0;
  for(let i=0;i<quiz.length;i++) if(answers[i]?.correct) s++;
  return s;
}
function updateScore(){
  $("score").textContent = String(scoreNow());
  $("total").textContent = String(quiz.length);
}

function renderIndex(){
  const index = $("index");
  index.innerHTML = "";
  for(let i=0;i<quiz.length;i++){
    const b = document.createElement("button");
    b.className = "qbtn";
    b.textContent = String(i+1);
    if(i===current) b.classList.add("current");
    if(answers[i]?.correct === true) b.classList.add("good");
    if(answers[i]?.correct === false) b.classList.add("bad");
    b.addEventListener("click", ()=>{ if(!running) return; current=i; renderQuestion(); });
    index.appendChild(b);
  }
}

function setExplain(show){
  $("explain").style.display = show?"block":"none";
}

function renderQuestion(){
  const q = quiz[current];
  $("chapterLabel").textContent = `Domanda ${current+1} / ${quiz.length} · Tipo: ${q.type.toUpperCase()} · Tema: ${q.tag} · Modalita: ${mode==='train'?'Allenamento':'Verifica'}`;

  // prompt
  $("prompt").innerHTML = wrapGloss(q.prompt);

  // post-it sempre visibile (aiuta)
  $("explainTitle").textContent = "Post-it grammaticale (in italiano)";
  $("explainText").innerHTML = renderPostit(q.postit);
  $("explainLong").textContent = (q.type === "open" && q.sample) ? `Esempio: ${q.sample}` : (q.type==="fill"? (q.hint||"") : "");
  setExplain(true);

  // options area
  const opt = $("options");
  opt.innerHTML = "";

  if(q.type === "mcq"){
    q.choices.forEach((c, idx)=>{
      const btn = document.createElement("button");
      btn.className = "opt";
      btn.type = "button";
      btn.innerHTML = wrapGloss(c);

      // visual selection in verify
      const a = answers[current];
      if(mode==="verify" && a?.selectedIndex === idx) btn.classList.add("current");

      btn.addEventListener("click", (e)=>{
        // Se click arriva da gloss-word, non rispondere
        if(e.target && e.target.closest && e.target.closest(".gloss-word")) return;
        if(!running) return;
        onAnswerMCQ(idx);
      });
      opt.appendChild(btn);
    });

    // in train: se già risposto, mostra colori
    if(mode==="train" && locked[current]){
      const a = answers[current];
      const buttons = Array.from(opt.querySelectorAll("button.opt"));
      buttons[q.correctIndex].classList.add("good");
      if(a?.selectedIndex != null && a.selectedIndex !== q.correctIndex) buttons[a.selectedIndex].classList.add("bad");
    }

  } else if(q.type === "open"){
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="muted">Scrivi la risposta (in spagnolo):</div>
      <input id="openInput" class="textinput" type="text" placeholder="Scrivi qui..." />
      <div class="bar" style="margin-top:10px; gap:8px;">
        <button id="checkOpenBtn" class="primary">Verifica</button>
        <span class="muted" id="openFeedback"></span>
      </div>
    `;
    opt.appendChild(wrap);
    const inp = $("openInput");
    const fb = $("openFeedback");

    // restore
    if(answers[current]?.text){ inp.value = answers[current].text; }

    $("checkOpenBtn").addEventListener("click", ()=>{
      if(!running) return;
      if(mode==="verify"){
        // in verifica: salva solo testo, niente giudizio ora
        answers[current] = { text: inp.value, correct: null };
        fb.textContent = "Salvato (in verifica il voto arriva alla fine).";
        renderIndex();
      } else {
        const res = q.checkFn(inp.value);
        answers[current] = { text: inp.value, correct: !!res.ok };
        locked[current] = true;
        fb.textContent = res.ok ? "✅ Ok" : `❌ ${res.msg}`;
        updateScore();
        renderIndex();
      }
    });

  } else if(q.type === "fill"){
    const sentHtml = q.sentence.map(part => part === "____" ? `<input id="fillInput" class="textinput" type="text" placeholder="..." />` : escapeHtml(part)).join("");
    opt.innerHTML = `
      <div class="muted">Completa la frase (una parola):</div>
      <div style="margin:10px 0; font-size:18px;">${sentHtml}</div>
      <div class="bar" style="gap:8px;">
        <button id="checkFillBtn" class="primary">Verifica</button>
        <span class="muted" id="fillFeedback"></span>
      </div>
      <div class="muted" style="margin-top:8px;">Suggerimento: ${escapeHtml(q.hint||"")}</div>
    `;

    const inp = $("fillInput");
    const fb = $("fillFeedback");
    if(answers[current]?.text) inp.value = answers[current].text;

    $("checkFillBtn").addEventListener("click", ()=>{
      if(!running) return;
      const v = norm(inp.value);
      if(mode==="verify"){
        answers[current] = { text: inp.value, correct: null };
        fb.textContent = "Salvato (in verifica il voto arriva alla fine).";
        renderIndex();
        return;
      }
      const ok = q.answers.map(norm).includes(v);
      answers[current] = { text: inp.value, correct: ok };
      locked[current] = true;
      fb.textContent = ok ? "✅ Corretto" : `❌ Corretto: ${q.answers[0]}`;
      updateScore();
      renderIndex();
    });
  }

  renderIndex();
  updateScore();
}

function onAnswerMCQ(selectedIndex){
  const q = quiz[current];

  if(mode === "verify"){
    answers[current] = { selectedIndex, correct: null };
    renderQuestion();
    renderIndex();
    return;
  }

  if(locked[current]) return;
  const correct = (selectedIndex === q.correctIndex);
  answers[current] = { selectedIndex, correct };
  locked[current] = true;

  // update UI
  const buttons = Array.from($("options").querySelectorAll("button.opt"));
  buttons[q.correctIndex].classList.add("good");
  if(!correct) buttons[selectedIndex].classList.add("bad");

  updateScore();
  renderIndex();
}

/* ====== Navigation ====== */
function prev(){ if(!running) return; if(current>0){ current--; renderQuestion(); } }
function next(){ if(!running) return; if(current<quiz.length-1){ current++; renderQuestion(); } }

/* ====== Risultati (verifica) ====== */
function finish(){
  if(!running) return;

  // se verifica: valuta adesso
  if(mode === "verify"){
    for(let i=0;i<quiz.length;i++){
      const q = quiz[i];
      const a = answers[i] || {};
      if(q.type === "mcq"){
        if(a.selectedIndex == null) a.correct = false;
        else a.correct = (a.selectedIndex === q.correctIndex);
        answers[i] = a;
      } else if(q.type === "open"){
        // open: consideriamo corretto se passa checkFn
        const res = q.checkFn(a.text||"");
        a.correct = !!res.ok;
        answers[i] = a;
      } else if(q.type === "fill"){
        const ok = q.answers.map(norm).includes(norm(a.text||""));
        a.correct = ok;
        answers[i] = a;
      }
    }
  }

  running = false;
  stopTimer();

  const s = scoreNow();
  const t = quiz.length;
  const pct = Math.round((s/t)*100);
  let voto = 2;
  if(pct>=90) voto = 10;
  else if(pct>=80) voto = 9;
  else if(pct>=70) voto = 8;
  else if(pct>=60) voto = 7;
  else if(pct>=50) voto = 6;
  else voto = 5;

  $("results").style.display = "block";
  $("resultsBody").innerHTML = `
    <div class="pill">Punteggio: <strong>${s}</strong> / ${t} (${pct}%)</div>
    <div class="pill">Voto stimato: <strong>${voto}</strong></div>
    <div style="margin-top:10px;" class="muted">In 'Verifica' il voto si calcola solo quando premi “Fine & Voto”.</div>
  `;

  renderIndex();
  updateScore();
}

function restart(){
  stopTimer();
  $("timer").textContent = "00:00";
  $("results").style.display = "none";
  running = false;

  quiz = shuffle(BANK).slice(0, 90); // come diritto: default 90
  answers = Array.from({length: quiz.length}, () => ({}));
  locked  = Array.from({length: quiz.length}, () => false);
  current = 0;
  $("total").textContent = String(quiz.length);
  $("score").textContent = "0";
  $("prompt").textContent = "Premi “Avvia” per iniziare.";
  $("options").innerHTML = "";
  setExplain(false);
  $("index").innerHTML = "";
}

function start(){
  running = true;
  $("results").style.display = "none";
  startTimer();
  renderQuestion();
}

function toggleMode(){
  mode = (mode === "train") ? "verify" : "train";
  $("modeBtn").textContent = `Modalita: ${mode==='train'?'Allenamento':'Verifica'}`;
  // reset valutazioni in verifica per non confondere
  if(mode === "verify"){
    for(let i=0;i<answers.length;i++) answers[i].correct = null;
  }
  renderQuestion();
}

/* ====== Eventi ====== */
$("startBtn").addEventListener("click", ()=>{ if(!running) start(); });
$("finishBtn").addEventListener("click", finish);
$("restartBtn").addEventListener("click", restart);
$("modeBtn").addEventListener("click", toggleMode);
$("prevBtn").addEventListener("click", prev);
$("nextBtn").addEventListener("click", next);

// gloss click: blocca propagazione per non rispondere per sbaglio
document.addEventListener("click", (e)=>{
  const gw = e.target.closest?.(".gloss-word");
  if(gw){
    e.preventDefault();
    e.stopPropagation();
    showGloss(gw);
    return;
  }
  // click fuori chiude tooltip
  hideGloss();
});

document.addEventListener("keydown", (e)=>{
  if(e.key === "Escape") hideGloss();
});

/* ====== Init ====== */
restart();
