"use strict";

/* -------------------- Utilities -------------------- */
function randInt(n){ return Math.floor(Math.random()*n); }
function pick(arr){ return arr[randInt(arr.length)]; }
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = randInt(i+1);
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function uniqByKey(items, keyFn){
  const seen = new Set();
  const out = [];
  for(const it of items){
    const k = keyFn(it);
    if(seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function norm(s){
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g," ")
    .replace(/[.?!]+$/,"" )
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}

const $ = (id) => document.getElementById(id);

/* -------------------- Data pools -------------------- */
const rooms = [
  "la cocina","el salon","el comedor","el dormitorio","el bano","el pasillo",
  "la habitacion","el estudio","la terraza","el balcon","el garaje","el jardin"
];

const houseTypes = [
  "un piso","una casa","una casa adosada","una casa unifamiliar","un apartamento","un chalet"
];

const family = [
  {sing:"mi madre", role:"madre"},
  {sing:"mi padre", role:"padre"},
  {sing:"mi hermano", role:"hermano"},
  {sing:"mi hermana", role:"hermana"},
  {sing:"mi abuelo", role:"abuelo"},
  {sing:"mi abuela", role:"abuela"},
  {sing:"mi tio", role:"tio"},
  {sing:"mi tia", role:"tia"},
  {sing:"mi primo", role:"primo"},
  {sing:"mi prima", role:"prima"}
];

const objects = [
  {s:"una mesa", p:"mesas", g:"f"},
  {s:"una silla", p:"sillas", g:"f"},
  {s:"un sofa", p:"sofas", g:"m"},
  {s:"una cama", p:"camas", g:"f"},
  {s:"un armario", p:"armarios", g:"m"},
  {s:"una lampara", p:"lamparas", g:"f"},
  {s:"un espejo", p:"espejos", g:"m"},
  {s:"una nevera", p:"neveras", g:"f"},
  {s:"un horno", p:"hornos", g:"m"},
  {s:"una ducha", p:"duchas", g:"f"},
  {s:"un lavabo", p:"lavabos", g:"m"},
  {s:"una television", p:"televisiones", g:"f"},
  {s:"un ordenador", p:"ordenadores", g:"m"},
  {s:"un libro", p:"libros", g:"m"},
  {s:"una ventana", p:"ventanas", g:"f"},
  {s:"una puerta", p:"puertas", g:"f"},
  {s:"una alfombra", p:"alfombras", g:"f"},
  {s:"una estanteria", p:"estanterias", g:"f"},
  {s:"un cuadro", p:"cuadros", g:"m"},
  {s:"una planta", p:"plantas", g:"f"}
];

const placePreps = [
  {k:"encima", phrase:"encima de"},
  {k:"debajo", phrase:"debajo de"},
  {k:"dentro", phrase:"dentro de"},
  {k:"fuera", phrase:"fuera de"},
  {k:"entre", phrase:"entre"},
  {k:"al_lado", phrase:"al lado de"},
  {k:"delante", phrase:"delante de"},
  {k:"detras", phrase:"detras de"}
];

const deictics = ["aqui","ahi","alli"];

/* -------------------- Question models --------------------
MCQ: {type:"mcq", prompt, choices[], answerIndex, explanation, tag}
OPEN: {type:"open", prompt, validator(userText)->{ok:boolean, correct:string, hint:string}, sample:string, tag}
----------------------------------------------------------- */

function qMCQ(prompt, choices, answerIndex, explanation, tag){
  return { type:"mcq", prompt, choices, answerIndex, explanation, tag };
}

function qOPEN(prompt, validator, sample, tag){
  return { type:"open", prompt, validator, sample, tag };
}

/* -------------------- Grammar helpers for OPEN -------------------- */
function hintRule(ruleId, details){
  const base = {
    HAY_EXISTE: "Usa **hay** per dire che una cosa esiste in un luogo: “Hay una mesa en la cocina.”",
    SER_PROF: "Professione: usa **ser** (Es médico / Es profesora).",
    TENER_EDAD: "Età: usa **tener** (Tiene 15 años). Non “es 15 años”.",
    MUCHO_ACUERDO: "“Mucho” concorda in genere e numero: **mucho/mucha/muchos/muchas**.",
    DEICTIC: "Qui/lì: **aquí** (vicino), **ahí** (lì vicino a te), **allí** (là lontano).",
    PREP_DE: "Con preposizioni come encima/debajo/delante/detrás/al lado/dentro/fuera serve **de**: “encima de…”.",
    ENTRE: "Con **entre** non mettere “de”: “entre la mesa y la silla”."
  }[ruleId] || "Controlla la struttura della frase.";

  return details ? `${base} ${details}` : base;
}

function escapeReg(s){
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeValidator_HayInRoom(o, room){
  const oN = norm(o.s);
  const roomN = norm(room);

  const re1 = new RegExp(`^hay ${escapeReg(oN)} en ${escapeReg(roomN)}$`);
  const re2 = new RegExp(`^en ${escapeReg(roomN)} hay ${escapeReg(oN)}$`);

  return (userText) => {
    const u = norm(userText);

    if(/\best(a|an)\b/.test(u) && u.includes(" hay ")){
      return { ok:false, correct:`Hay ${o.s} en ${room}.`, hint: hintRule("HAY_EXISTE", "Evita “está hay…”.") };
    }
    if(u.startsWith("esta ") || u.startsWith("estan ")){
      return { ok:false, correct:`Hay ${o.s} en ${room}.`, hint: hintRule("HAY_EXISTE", "“Está” indica posizione; qui chiediamo esistenza.") };
    }

    const ok = re1.test(u) || re2.test(u);
    return ok
      ? { ok:true, correct:`Hay ${o.s} en ${room}.`, hint:"✅ Struttura corretta." }
      : { ok:false, correct:`Hay ${o.s} en ${room}.`, hint: hintRule("HAY_EXISTE") };
  };
}

function makeValidator_MuchoPlural(obj, room){
  const roomN = norm(room);
  const nounPlural = norm(obj.p);
  const correctMucho = (obj.g === "f") ? "muchas" : "muchos";

  const re = new RegExp(`^(hay )?${correctMucho} ${escapeReg(nounPlural)} en ${escapeReg(roomN)}$`);
  const re2 = new RegExp(`^en ${escapeReg(roomN)} (hay )?${correctMucho} ${escapeReg(nounPlural)}$`);

  return (userText) => {
    const full = norm(userText);

    const hasWrong = /\bmucho(s)?\b|\bmucha(s)?\b/.test(full) && !full.includes(`${correctMucho} ${nounPlural}`);
    if(hasWrong){
      return {
        ok:false,
        correct:`Hay ${correctMucho} ${obj.p} en ${room}.`,
        hint: hintRule("MUCHO_ACUERDO", `Qui: **${correctMucho} ${obj.p}**.`)
      };
    }

    const ok = re.test(full) || re2.test(full);
    return ok
      ? { ok:true, correct:`Hay ${correctMucho} ${obj.p} en ${room}.`, hint:"✅ Concordanza corretta." }
      : { ok:false, correct:`Hay ${correctMucho} ${obj.p} en ${room}.`, hint: hintRule("MUCHO_ACUERDO") };
  };
}

function makeValidator_DeicticHay(deic, obj, room){
  const dN = norm(deic);
  const oN = norm(obj.s);
  const roomN = norm(room);

  const re = new RegExp(`^${escapeReg(dN)} hay ${escapeReg(oN)} en ${escapeReg(roomN)}$`);
  const re2 = new RegExp(`^en ${escapeReg(roomN)} ${escapeReg(dN)} hay ${escapeReg(oN)}$`);

  return (userText) => {
    const u = norm(userText);

    const ok = re.test(u) || re2.test(u);
    return ok
      ? { ok:true, correct:`${cap(deic)} hay ${obj.s} en ${room}.`, hint:"✅ Uso corretto." }
      : { ok:false, correct:`${cap(deic)} hay ${obj.s} en ${room}.`, hint: hintRule("DEICTIC", `Qui serve **${deic}** + “hay”.`) };
  };
}

function makeValidator_PrepLocation(prep, obj1, obj2, room){
  const pN = norm(prep.phrase);
  const o1N = norm(obj1.s);
  const o2N = norm(obj2.s);
  const roomN = norm(room);

  let correct;
  let okRegexes = [];

  if(prep.k === "entre"){
    correct = `Hay ${obj1.s} entre ${obj2.s} y ${pick(objects).s} en ${room}.`;
    const re = new RegExp(`^hay ${escapeReg(o1N)} entre ${escapeReg(o2N)} y .+ en ${escapeReg(roomN)}$`);
    okRegexes.push(re);
  } else {
    correct = `Hay ${obj1.s} ${prep.phrase} ${obj2.s} en ${room}.`;
    const re1 = new RegExp(`^hay ${escapeReg(o1N)} ${escapeReg(pN)} ${escapeReg(o2N)} en ${escapeReg(roomN)}$`);
    okRegexes.push(re1);

    const phraseNoDe = pN.replace(/\s+de$/," ").trim();
    const reNoDe = new RegExp(`^hay ${escapeReg(o1N)} ${escapeReg(phraseNoDe)} ${escapeReg(o2N)} en ${escapeReg(roomN)}$`);
    okRegexes.push(reNoDe);
  }

  return (userText) => {
    const u = norm(userText);

    if(prep.k === "entre"){
      const ok = okRegexes[0].test(u);
      return ok
        ? { ok:true, correct, hint:"✅ Struttura con “entre … y …” corretta." }
        : { ok:false, correct, hint: hintRule("ENTRE", "Struttura: “Hay X entre A y B en …”.") };
    }

    const reCorrect = okRegexes[0];
    const reNoDe = okRegexes[1];

    if(reNoDe && reNoDe.test(u)){
      return { ok:false, correct, hint: hintRule("PREP_DE", `Qui serve **${prep.phrase}** (con “de”).`) };
    }

    const ok = reCorrect.test(u);
    return ok
      ? { ok:true, correct, hint:"✅ Preposizione corretta." }
      : { ok:false, correct, hint: hintRule("PREP_DE", `Esempio: “Hay X ${prep.phrase} Y …”.`) };
  };
}

function makeValidator_FamilyAgeJob(member, name, age, job){
  const mN = norm(member);
  const nameN = norm(name);
  const jobN = norm(job);

  const reOk = new RegExp(`^${escapeReg(mN)} se llama ${escapeReg(nameN)} y tiene ${age} anos(\\.?|)( es ${escapeReg(jobN)}\\.?|)$`);
  const reBadEdad = new RegExp(`^${escapeReg(mN)} se llama ${escapeReg(nameN)} y es ${age} anos`);

  return (userText) => {
    const u = norm(userText);

    if(reBadEdad.test(u)){
      return { ok:false, correct:`${cap(member)} se llama ${name} y tiene ${age} años. Es ${job}.`, hint: hintRule("TENER_EDAD") };
    }
    if(u.includes("esta ") && u.includes(jobN)){
      return { ok:false, correct:`${cap(member)} se llama ${name} y tiene ${age} años. Es ${job}.`, hint: hintRule("SER_PROF") };
    }

    const ok = reOk.test(u);
    return ok
      ? { ok:true, correct:`${cap(member)} se llama ${name} y tiene ${age} años. Es ${job}.`, hint:"✅ Benissimo." }
      : { ok:false, correct:`${cap(member)} se llama ${name} y tiene ${age} años. Es ${job}.`, hint: `${hintRule("TENER_EDAD")} ${hintRule("SER_PROF")}` };
  };
}

/* -------------------- Builders (MCQ) -------------------- */
function buildMCQ_HayLocation(level){
  const o1 = pick(objects);
  const o2 = pick(objects);
  const r = pick(rooms);
  const prep = pick(placePreps);

  let correct;
  if(prep.k === "entre"){
    correct = `Hay ${o1.s} entre ${o2.s} y ${pick(objects).s} en ${r}.`;
  } else {
    correct = `Hay ${o1.s} ${prep.phrase} ${o2.s} en ${r}.`;
  }

  const wrong1 = (prep.k === "entre")
    ? `Hay ${o1.s} ${prep.phrase} ${o2.s} en ${r}.`
    : `Hay ${o1.s} ${prep.phrase} ${o2.s} ${r}.`;
  const wrong2 = `Está ${o1.s} ${prep.phrase} ${o2.s} en ${r}.`;
  const wrong3 = (prep.k === "detras")
    ? `Hay ${o1.s} detras ${o2.s} en ${r}.`
    : `Hay ${o1.s} en ${r} ${prep.phrase} ${o2.s}.`;

  let choices = shuffle([correct, wrong1, wrong2, wrong3]);
  const answerIndex = choices.indexOf(correct);

  return qMCQ(
    "Elige la frase correcta:",
    choices,
    answerIndex,
    `Regola: “hay” = esistenza. Corretta: ${correct}`,
    "hay + lugar"
  );
}

function buildMCQ_Mucho(level){
  const o = pick(objects);
  const room = pick(rooms);
  const correctForm = (o.g==="f") ? "muchas" : "muchos";
  const correct = `Hay ${correctForm} ${o.p} en ${room}.`;

  const choices = shuffle([
    `Hay mucho ${o.p} en ${room}.`,
    `Hay mucha ${o.p} en ${room}.`,
    `Hay muchos ${o.p} en ${room}.`,
    `Hay muchas ${o.p} en ${room}.`
  ]);

  return qMCQ(
    "Completa con la forma correcta de “mucho":",
    choices,
    choices.indexOf(correct),
    `Plural: ${o.g==="f" ? "muchas" : "muchos"} + ${o.p}.`,
    "mucho/a/os/as"
  );
}

function buildMCQ_Deictic(level){
  const d = pick(deictics);
  const r = pick(rooms);
  const o = pick(objects);

  const correct = `${d} hay ${o.s} en ${r}.`;
  const wrongA = `${d} está ${o.s} en ${r}.`;
  const wrongB = `Hay ${d} ${o.s} en ${r}.`;
  const wrongC = `${d} tengo ${o.s} en ${r}.`;

  const choices = shuffle([correct, wrongA, wrongB, wrongC]);
  return qMCQ(
    `Elige la frase correcta usando “${d}”:`,
    choices,
    choices.indexOf(correct),
    `Struttura: “${d} hay …”.`,
    "aquí/ahí/allí"
  );
}

function buildMCQ_House(level){
  const t = pick(houseTypes);
  const roomCount = pick([2,3,4,5]);
  const hasGarden = Math.random() < 0.4;

  const correct = `Mi casa es ${t}. Tiene ${roomCount} habitaciones${hasGarden ? " y un jardín" : ""}.`;
  const wrong1 = `Mi casa está ${t}. Tiene ${roomCount} habitaciones${hasGarden ? " y un jardín" : ""}.`;
  const wrong2 = `Mi casa es ${t}. Tiene ${roomCount} habitación${hasGarden ? " y un jardín" : ""}.`;
  const wrong3 = `Mi casa es ${t}. Tiene ${roomCount} habitaciones${hasGarden ? " y una jardín" : ""}.`;

  const choices = shuffle([correct, wrong1, wrong2, wrong3]);
  return qMCQ(
    "Elige la descripción correcta:",
    choices,
    choices.indexOf(correct),
    "Ojo: “Mi casa es…”; plural: “habitaciones”; “un jardín” (masc.).",
    "descripción casa"
  );
}

function buildMCQ_Family(level){
  const f = pick(family);
  const name = pick(["Ana","Lucia","Pablo","Mario","Sara","Laura","Diego","Elena","Carlos","Marta"]);
  const job = pick(["medico","profesor","estudiante","ingeniera","cocinero","enfermera","abogado","dependienta"]);
  const age = pick([12,13,14,15,16,17,40,42,45,50,65,70]);

  const correct = `${cap(f.sing)} se llama ${name} y tiene ${age} años. Es ${job}.`;
  const wrong1 = `${cap(f.sing)} se llama ${name} y es ${age} años. Es ${job}.`;
  const wrong2 = `${cap(f.sing)} llama ${name} y tiene ${age} años. Es ${job}.`;
  const wrong3 = `${cap(f.sing)} se llama ${name} y tiene ${age} años. Está ${job}.`;

  const choices = shuffle([correct, wrong1, wrong2, wrong3]);
  return qMCQ(
    "Elige la frase correcta sobre la familia:",
    choices,
    choices.indexOf(correct),
    "Edad: “tener años”. Professione: “ser …”.",
    "familia"
  );
}

const cultureFixed = [
  qMCQ("¿Qué ciudad es la capital de España?", ["Barcelona","Madrid","Valencia","Sevilla"], 1, "La capital es Madrid.", "cultura"),
  qMCQ("¿En qué ciudad está la Sagrada Familia?", ["Madrid","Barcelona","Bilbao","Granada"], 1, "Está en Barcelona.", "cultura"),
  qMCQ("¿Dónde está el Museo del Prado?", ["Madrid","Barcelona","Bilbao","Granada"], 0, "Está en Madrid.", "cultura"),
  qMCQ("Las Ramblas es una calle famosa de…", ["Madrid","Barcelona","Salamanca","Toledo"], 1, "En Barcelona.", "cultura")
];

function buildMCQ_Culture(level){
  return pick(cultureFixed);
}

/* -------------------- Builders (OPEN) -------------------- */
function buildOPEN_HayInRoom(level){
  const o = pick(objects);
  const room = pick(rooms);
  const sample = `Hay ${o.s} en ${room}.`;
  return qOPEN(
    `Scrivi una frase corretta che dica che c’è ${o.s} in ${room}. (Usa “hay”)`,
    makeValidator_HayInRoom(o, room),
    sample,
    "hay (aperta)"
  );
}

function buildOPEN_Mucho(level){
  const obj = pick(objects);
  const room = pick(rooms);
  const correctMucho = (obj.g === "f") ? "muchas" : "muchos";
  const sample = `Hay ${correctMucho} ${obj.p} en ${room}.`;
  return qOPEN(
    `Scrivi una frase con “hay” + “mucho” (forma giusta) per dire che in ${room} ci sono molte/i ${obj.p}.`,
    makeValidator_MuchoPlural(obj, room),
    sample,
    "mucho/a/os/as (aperta)"
  );
}

function buildOPEN_Deictic(level){
  const d = pick(deictics);
  const obj = pick(objects);
  const room = pick(rooms);
  const sample = `${cap(d)} hay ${obj.s} en ${room}.`;
  return qOPEN(
    `Scrivi una frase corretta con “${d}” + “hay” + oggetto + stanza.`,
    makeValidator_DeicticHay(d, obj, room),
    sample,
    "aquí/ahí/allí (aperta)"
  );
}

function buildOPEN_Prep(level){
  const prep = pick(placePreps);
  const obj1 = pick(objects);
  const obj2 = pick(objects);
  const room = pick(rooms);
  const sample = (prep.k === "entre")
    ? `Hay ${obj1.s} entre ${obj2.s} y una silla en ${room}.`
    : `Hay ${obj1.s} ${prep.phrase} ${obj2.s} en ${room}.`;

  return qOPEN(
    `Scrivi una frase con “hay” usando la posizione “${prep.phrase}” (o “entre … y …”) in una stanza.`,
    makeValidator_PrepLocation(prep, obj1, obj2, room),
    sample,
    "preposiciones (aperta)"
  );
}

function buildOPEN_Family(level){
  const f = pick(family);
  const name = pick(["Ana","Lucia","Pablo","Mario","Sara","Laura","Diego","Elena","Carlos","Marta"]);
  const job = pick(["medico","profesor","estudiante","ingeniera","cocinero","enfermera","abogado","dependienta"]);
  const age = pick([12,13,14,15,16,17,40,42,45,50,65,70]);
  const sample = `${cap(f.sing)} se llama ${name} y tiene ${age} años. Es ${job}.`;

  return qOPEN(
    `Scrivi una frase su ${f.sing}: nome + età + lavoro. (Ricorda: tener años / ser + profesión)`,
    makeValidator_FamilyAgeJob(f.sing, name, age, job),
    sample,
    "familia (aperta)"
  );
}

/* -------------------- Build exactly 250 questions -------------------- */
function generate250(level){
  const plan = [
    {fn: () => buildMCQ_HayLocation(level), n: 60},
    {fn: () => buildMCQ_Mucho(level), n: 40},
    {fn: () => buildMCQ_Deictic(level), n: 30},
    {fn: () => buildMCQ_House(level), n: 25},
    {fn: () => buildMCQ_Family(level), n: 25},
    {fn: () => buildMCQ_Culture(level), n: 20},
    {fn: () => buildOPEN_HayInRoom(level), n: 20},
    {fn: () => buildOPEN_Mucho(level), n: 10},
    {fn: () => buildOPEN_Deictic(level), n: 8},
    {fn: () => buildOPEN_Prep(level), n: 7},
    {fn: () => buildOPEN_Family(level), n: 5}
  ];

  let all = [];
  for(const p of plan){
    for(let i=0;i<p.n;i++) all.push(p.fn());
  }

  all = uniqByKey(all, q => {
    if(q.type === "mcq") return `mcq||${q.prompt}||${q.choices.join("||")}`;
    return `open||${q.prompt}||${q.sample}`;
  });

  const fallback = [
    () => buildMCQ_HayLocation(level),
    () => buildMCQ_Mucho(level),
    () => buildMCQ_Deictic(level),
    () => buildMCQ_House(level),
    () => buildMCQ_Family(level),
    () => buildMCQ_Culture(level),
    () => buildOPEN_HayInRoom(level),
    () => buildOPEN_Mucho(level),
    () => buildOPEN_Deictic(level),
    () => buildOPEN_Prep(level),
    () => buildOPEN_Family(level)
  ];

  while(all.length < 250){
    const q = pick(fallback)();
    const key = (q.type === "mcq")
      ? `mcq||${q.prompt}||${q.choices.join("||")}`
      : `open||${q.prompt}||${q.sample}`;

    if(!all.some(x => {
      const k2 = (x.type === "mcq")
        ? `mcq||${x.prompt}||${x.choices.join("||")}`
        : `open||${x.prompt}||${x.sample}`;
      return k2 === key;
    })) all.push(q);
  }

  return all.slice(0,250);
}

/* -------------------- App State -------------------- */
let BANK = generate250("normal");
let quiz = [];
let idx = 0;
let score = 0;
let locked = false;

let wrongLog = []; // {q, chosenIndex?, userText?}

function show(id){
  ["setup","quiz","result"].forEach(x => $(x).classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function setProgress(){
  const pct = (idx / quiz.length) * 100;
  $("progressBar").style.width = `${pct}%`;
}

function renderQuestion(){
  locked = false;
  $("nextBtn").disabled = true;
  $("feedback").textContent = "";
  $("openHint").textContent = "";
  $("openInput").value = "";

  const q = quiz[idx];
  $("quizTitle").textContent = `Domanda ${idx+1} / ${quiz.length}`;
  $("meta").textContent = `Tipo: ${q.type.toUpperCase()} • Tema: ${q.tag}`;
  $("scorePill").textContent = `Punti: ${score}`;
  $("qtext").textContent = q.prompt;

  $("choices").innerHTML = "";
  $("openWrap").classList.add("hidden");

  if(q.type === "mcq"){
    const choicesEl = $("choices");
    q.choices.forEach((c, i) => {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.type = "button";
      btn.textContent = c;
      btn.addEventListener("click", () => chooseMCQ(i, btn));
      choicesEl.appendChild(btn);
    });
  } else {
    $("openWrap").classList.remove("hidden");
    $("openHint").textContent = `Esempio valido: ${q.sample}`;
    setTimeout(() => $("openInput").focus(), 0);
  }

  setProgress();
}

function chooseMCQ(i, btn){
  if(locked) return;
  locked = true;

  const q = quiz[idx];
  const allBtns = Array.from(document.querySelectorAll(".choice"));
  allBtns.forEach(b => b.disabled = true);

  const correctBtn = allBtns[q.answerIndex];
  correctBtn.classList.add("correct");

  if(i === q.answerIndex){
    score += 1;
    $("feedback").innerHTML = `✅ <strong>Correcto</strong> — ${q.explanation}`;
  } else {
    btn.classList.add("wrong");
    $("feedback").innerHTML = `❌ <strong>No</strong> — ${q.explanation}`;
    wrongLog.push({ q, chosenIndex: i });
  }

  $("scorePill").textContent = `Punti: ${score}`;
  $("nextBtn").disabled = false;
}

function checkOPEN(){
  if(locked) return;
  const q = quiz[idx];
  const userText = $("openInput").value;

  const res = q.validator(userText);
  locked = true;

  if(res.ok){
    score += 1;
    $("feedback").innerHTML = `✅ <strong>Correcto</strong> — ${res.hint}`;
  } else {
    $("feedback").innerHTML = `❌ <strong>No</strong><br><span class="muted">Suggerimento:</span> ${res.hint}<br><span class="muted">Corretto:</span> <strong>${res.correct}</strong>`;
    wrongLog.push({ q, userText });
  }

  $("scorePill").textContent = `Punti: ${score}`;
  $("nextBtn").disabled = false;
}

function finish(){
  show("result");
  const total = quiz.length;
  const pct = Math.round((score/total)*100);

  let msg = `Hai fatto ${score} / ${total} punti (${pct}%).`;
  if(pct >= 90) msg += " Ottimo!";
  else if(pct >= 75) msg += " Molto bene!";
  else if(pct >= 60) msg += " Bene, continua così.";
  else msg += " Da ripassare: hay, mucho, preposizioni, tener años, ser…";

  $("resultText").textContent = msg;

  $("review").classList.add("hidden");
  $("review").innerHTML = "";
}

function renderReview(){
  const box = $("review");
  box.innerHTML = "";

  if(wrongLog.length === 0){
    box.innerHTML = `<div class="reviewItem"><div class="tag">Perfetto</div>Nessun errore 🎉</div>`;
    box.classList.remove("hidden");
    return;
  }

  wrongLog.slice(0,200).forEach((w, k) => {
    const q = w.q;
    const div = document.createElement("div");
    div.className = "reviewItem";

    if(q.type === "mcq"){
      const chosen = q.choices[w.chosenIndex] ?? "(nessuna)";
      const correct = q.choices[q.answerIndex];
      div.innerHTML = `
        <div class="tag">Errore ${k+1} • ${q.tag} • MCQ</div>
        <div><strong>Domanda:</strong> ${q.prompt}</div>
        <div><strong>La tua risposta:</strong> ${chosen}</div>
        <div><strong>Corretto:</strong> ${correct}</div>
        <div class="muted" style="margin-top:6px">${q.explanation}</div>
      `;
    } else {
      const user = w.userText ?? "(vuota)";
      const preview = q.validator("");
      div.innerHTML = `
        <div class="tag">Errore ${k+1} • ${q.tag} • OPEN</div>
        <div><strong>Domanda:</strong> ${q.prompt}</div>
        <div><strong>La tua risposta:</strong> ${user}</div>
        <div><strong>Esempio corretto:</strong> ${preview.correct}</div>
        <div class="muted" style="margin-top:6px">${preview.hint}</div>
      `;
    }

    box.appendChild(div);
  });

  box.classList.remove("hidden");
}

function buildQuizFromBank(bank, mode, count, format, openPct){
  let pool = bank.slice();

  if(format === "mcq") pool = pool.filter(q => q.type === "mcq");
  if(format === "open") pool = pool.filter(q => q.type === "open");

  if(format === "mixed"){
    const opens = pool.filter(q => q.type === "open");
    const mcqs  = pool.filter(q => q.type === "mcq");

    const wantOpen = Math.round((openPct/100) * count);
    const wantMCQ = Math.max(0, count - wantOpen);

    const pickOpen = (mode === "shuffled") ? shuffle(opens).slice(0, wantOpen) : opens.slice(0, wantOpen);
    const pickMCQ  = (mode === "shuffled") ? shuffle(mcqs).slice(0, wantMCQ) : mcqs.slice(0, wantMCQ);

    const mixed = pickOpen.concat(pickMCQ);
    return (mode === "shuffled") ? shuffle(mixed) : mixed;
  }

  return (mode === "shuffled") ? shuffle(pool).slice(0, count) : pool.slice(0, count);
}

/* -------------------- Events -------------------- */
$("startBtn").addEventListener("click", () => {
  const mode = $("mode").value;
  const count = Math.max(1, Math.min(250, parseInt($("count").value || "30", 10)));
  const level = $("level").value;
  const format = $("format").value;
  const openPct = Math.max(0, Math.min(100, parseInt($("openPct").value || "35", 10)));

  BANK = generate250(level);
  quiz = buildQuizFromBank(BANK, mode, count, format, openPct);

  idx = 0;
  score = 0;
  wrongLog = [];

  show("quiz");
  renderQuestion();
});

$("regenBtn").addEventListener("click", () => {
  const level = $("level").value;
  BANK = generate250(level);
  alert("Fatto! Ho rigenerato una banca di 250 domande (con scelte + aperte)." );
});

$("nextBtn").addEventListener("click", () => {
  idx += 1;
  if(idx >= quiz.length) finish();
  else renderQuestion();
});

$("skipBtn").addEventListener("click", () => {
  idx += 1;
  if(idx >= quiz.length) finish();
  else renderQuestion();
});

$("restartBtn").addEventListener("click", () => show("setup"));
$("backBtn").addEventListener("click", () => show("setup"));

$("reviewBtn").addEventListener("click", () => renderReview());

$("checkOpenBtn").addEventListener("click", () => checkOPEN());
$("openInput").addEventListener("keydown", (e) => {
  if(e.key === "Enter"){
    e.preventDefault();
    checkOPEN();
  }
});

/* Avvio */
show("setup");
