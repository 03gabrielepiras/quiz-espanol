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
    .replace(/[.?!]+$/," ")
    .trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}

function escapeReg(s){
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(str){
  return (str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

const $ = (id) => document.getElementById(id);

/* -------------------- Data pools (accent-less for matching) -------------------- */
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

/* -------------------- Glossary ES -> IT (starter) -------------------- */
const GLOSS = {
  // core
  "hay": "c'e / ci sono",
  "mucho": "molto",
  "mucha": "molta",
  "muchos": "molti",
  "muchas": "molte",
  "aqui": "qui",
  "ahi": "li (vicino a te)",
  "alli": "la (lontano)",

  // preposizioni/frasi
  "encima de": "sopra (a) / sopra di",
  "debajo de": "sotto (a) / sotto di",
  "delante de": "davanti a",
  "detras de": "dietro a",
  "al lado de": "accanto a",
  "dentro de": "dentro (a)",
  "fuera de": "fuori da",
  "entre": "tra / fra",

  // casa
  "casa": "casa",
  "piso": "appartamento",
  "habitacion": "stanza / camera",
  "cocina": "cucina",
  "bano": "bagno",
  "salon": "salotto",
  "comedor": "sala da pranzo",
  "dormitorio": "camera da letto",
  "jardin": "giardino",

  // verbi
  "tener": "avere",
  "tiene": "ha",
  "ser": "essere",
  "es": "e'",
  "llamarse": "chiamarsi",
  "se llama": "si chiama"
};

// Auto-aggiunta: oggetti, stanze, familiari
for(const r of rooms){
  const key = norm(r.replace(/^el |^la /,""));
  if(!GLOSS[key]){
    // traduzioni base (non perfette, ma utili per prima superiore)
    const map = {
      "cocina":"cucina","salon":"salotto","comedor":"sala da pranzo","dormitorio":"camera da letto",
      "bano":"bagno","pasillo":"corridoio","habitacion":"stanza","estudio":"studio",
      "terraza":"terrazza","balcon":"balcone","garaje":"garage","jardin":"giardino"
    };
    if(map[key]) GLOSS[key] = map[key];
  }
}
for(const o of objects){
  const key = norm(o.s.replace(/^un |^una /,""));
  const map = {
    "mesa":"tavolo","silla":"sedia","sofa":"divano","cama":"letto","armario":"armadio",
    "lampara":"lampada","espejo":"specchio","nevera":"frigorifero","horno":"forno",
    "ducha":"doccia","lavabo":"lavandino","television":"televisione","ordenador":"computer",
    "libro":"libro","ventana":"finestra","puerta":"porta","alfombra":"tappeto",
    "estanteria":"scaffale","cuadro":"quadro","planta":"pianta"
  };
  if(map[key] && !GLOSS[key]) GLOSS[key] = map[key];
}
for(const f of family){
  const key = norm(f.sing.replace(/^mi /,""));
  const map = {
    "madre":"madre","padre":"padre","hermano":"fratello","hermana":"sorella",
    "abuelo":"nonno","abuela":"nonna","tio":"zio","tia":"zia","primo":"cugino","prima":"cugina"
  };
  if(map[key] && !GLOSS[key]) GLOSS[key] = map[key];
}

const PHRASES = Object.keys(GLOSS).filter(k => k.includes(" ")).sort((a,b)=>b.length-a.length);

function wrapGloss(text){
  let html = escapeHtml(text);

  // 1) frasi (es: "al lado de")
  for(const phrase of PHRASES){
    const re = new RegExp(`\\b${escapeReg(phrase)}\\b`, "gi");
    html = html.replace(re, (m) => {
      const key = norm(phrase);
      const it = GLOSS[key];
      if(!it) return escapeHtml(m);
      return `<span class="gloss-word" data-es="${escapeHtml(m)}" data-key="${escapeHtml(key)}">${escapeHtml(m)}</span>`;
    });
  }

  // 2) parole singole
  html = html.replace(/\\b([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\\b/g, (m) => {
    const key = norm(m);
    if(!GLOSS[key]) return m;
    return `<span class="gloss-word" data-es="${escapeHtml(m)}" data-key="${escapeHtml(key)}">${escapeHtml(m)}</span>`;
  });

  return html;
}

function showGlossTooltip(x, y, esText, key){
  const tip = $("glossTooltip");
  $("glossEs").textContent = `ES: ${esText}`;
  $("glossIt").textContent = `IT: ${GLOSS[key]}`;

  tip.style.left = `${Math.min(x, window.innerWidth - 340)}px`;
  tip.style.top  = `${Math.min(y + 14, window.innerHeight - 140)}px`;
  tip.classList.remove("hidden");
}

function hideGlossTooltip(){
  $("glossTooltip").classList.add("hidden");
}

/* -------------------- Grammar hints (for OPEN feedback and note) -------------------- */
function hintRule(ruleId, details){
  const base = {
    HAY_EXISTE: "Usa HAY per dire che una cosa esiste in un luogo: 'Hay una mesa en la cocina.'",
    SER_PROF: "Professione: usa SER (Es medico / Es profesora).",
    TENER_EDAD: "Eta: usa TENER (Tiene 15 anos). Non 'es 15 anos'.",
    MUCHO_ACUERDO: "'Mucho' concorda: mucho/mucha/muchos/muchas (genere+numero).",
    DEICTIC: "Qui/li: aqui (qui), ahi (li vicino a te), alli (la lontano).",
    PREP_DE: "Con encima/debajo/delante/detras/al lado/dentro/fuera serve 'de': encima de...",
    ENTRE: "Con ENTRE non mettere 'de': 'entre la mesa y la silla'."
  }[ruleId] || "Controlla la struttura della frase.";

  return details ? `${base} ${details}` : base;
}

/* -------------------- Question models -------------------- */
function qMCQ(prompt, choices, answerIndex, explanation, tag, grammar){
  return { type:"mcq", prompt, choices, answerIndex, explanation, tag, grammar };
}
function qOPEN(prompt, validator, sample, tag, grammar){
  return { type:"open", prompt, validator, sample, tag, grammar };
}

/* -------------------- OPEN validators -------------------- */
function makeValidator_HayInRoom(o, room){
  const oN = norm(o.s);
  const roomN = norm(room);
  const re1 = new RegExp(`^hay ${escapeReg(oN)} en ${escapeReg(roomN)}$`);
  const re2 = new RegExp(`^en ${escapeReg(roomN)} hay ${escapeReg(oN)}$`);

  return (userText) => {
    const u = norm(userText);

    if(/\\best(a|an)\\b/.test(u) && u.includes(" hay ")){
      return { ok:false, correct:`Hay ${o.s} en ${room}.`, hint: hintRule("HAY_EXISTE", "Evita 'esta hay...'.") };
    }
    if(u.startsWith("esta ") || u.startsWith("estan ")){
      return { ok:false, correct:`Hay ${o.s} en ${room}.`, hint: hintRule("HAY_EXISTE", "Qui chiediamo esistenza, non posizione.") };
    }

    const ok = re1.test(u) || re2.test(u);
    return ok
      ? { ok:true, correct:`Hay ${o.s} en ${room}.`, hint:"OK: struttura corretta." }
      : { ok:false, correct:`Hay ${o.s} en ${room}.`, hint: hintRule("HAY_EXISTE") };
  };
}

function makeValidator_MuchoPlural(obj, room){
  const roomN = norm(room);
  const nounPlural = norm(obj.p);
  const correctMucho = (obj.g === "f") ? "muchas" : "muchos";

  const re1 = new RegExp(`^hay ${escapeReg(correctMucho)} ${escapeReg(nounPlural)} en ${escapeReg(roomN)}$`);
  const re2 = new RegExp(`^en ${escapeReg(roomN)} hay ${escapeReg(correctMucho)} ${escapeReg(nounPlural)}$`);

  return (userText) => {
    const u = norm(userText);

    const hasSomeMucho = /\\bmucho(s)?\\b|\\bmucha(s)?\\b/.test(u);
    const okMucho = u.includes(`${correctMucho} ${nounPlural}`);
    if(hasSomeMucho && !okMucho){
      return {
        ok:false,
        correct:`Hay ${correctMucho} ${obj.p} en ${room}.`,
        hint: hintRule("MUCHO_ACUERDO", `Qui: ${correctMucho} ${obj.p}.`)
      };
    }

    const ok = re1.test(u) || re2.test(u);
    return ok
      ? { ok:true, correct:`Hay ${correctMucho} ${obj.p} en ${room}.`, hint:"OK: concordanza corretta." }
      : { ok:false, correct:`Hay ${correctMucho} ${obj.p} en ${room}.`, hint: hintRule("MUCHO_ACUERDO") };
  };
}

function makeValidator_DeicticHay(deic, obj, room){
  const dN = norm(deic);
  const oN = norm(obj.s);
  const roomN = norm(room);

  const re1 = new RegExp(`^${escapeReg(dN)} hay ${escapeReg(oN)} en ${escapeReg(roomN)}$`);
  const re2 = new RegExp(`^en ${escapeReg(roomN)} ${escapeReg(dN)} hay ${escapeReg(oN)}$`);

  return (userText) => {
    const u = norm(userText);
    const ok = re1.test(u) || re2.test(u);
    return ok
      ? { ok:true, correct:`${cap(deic)} hay ${obj.s} en ${room}.`, hint:"OK: uso corretto." }
      : { ok:false, correct:`${cap(deic)} hay ${obj.s} en ${room}.`, hint: hintRule("DEICTIC", `Qui serve '${deic}' + hay.`) };
  };
}

function makeValidator_PrepLocation(prep, obj1, obj2, room){
  const pN = norm(prep.phrase);
  const o1N = norm(obj1.s);
  const o2N = norm(obj2.s);
  const roomN = norm(room);

  let correct;

  if(prep.k === "entre"){
    correct = `Hay ${obj1.s} entre ${obj2.s} y una silla en ${room}.`;
    const re = new RegExp(`^hay ${escapeReg(o1N)} entre ${escapeReg(o2N)} y .+ en ${escapeReg(roomN)}$`);
    return (userText) => {
      const u = norm(userText);
      return re.test(u)
        ? { ok:true, correct, hint:"OK: estructura con entre ... y ..." }
        : { ok:false, correct, hint: hintRule("ENTRE") };
    };
  }

  correct = `Hay ${obj1.s} ${prep.phrase} ${obj2.s} en ${room}.`;
  const reCorrect = new RegExp(`^hay ${escapeReg(o1N)} ${escapeReg(pN)} ${escapeReg(o2N)} en ${escapeReg(roomN)}$`);
  const phraseNoDe = pN.replace(/\\s+de$/,"").trim();
  const reNoDe = new RegExp(`^hay ${escapeReg(o1N)} ${escapeReg(phraseNoDe)} ${escapeReg(o2N)} en ${escapeReg(roomN)}$`);

  return (userText) => {
    const u = norm(userText);
    if(reNoDe.test(u)){
      return { ok:false, correct, hint: hintRule("PREP_DE", `Qui serve '${prep.phrase}' (con de).`) };
    }
    return reCorrect.test(u)
      ? { ok:true, correct, hint:"OK: preposizione corretta." }
      : { ok:false, correct, hint: hintRule("PREP_DE") };
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
      return { ok:false, correct:`${cap(member)} se llama ${name} y tiene ${age} anos. Es ${job}.`, hint: hintRule("TENER_EDAD") };
    }
    if(u.includes("esta ") && u.includes(jobN)){
      return { ok:false, correct:`${cap(member)} se llama ${name} y tiene ${age} anos. Es ${job}.`, hint: hintRule("SER_PROF") };
    }

    return reOk.test(u)
      ? { ok:true, correct:`${cap(member)} se llama ${name} y tiene ${age} anos. Es ${job}.`, hint:"OK." }
      : { ok:false, correct:`${cap(member)} se llama ${name} y tiene ${age} anos. Es ${job}.`, hint: `${hintRule("TENER_EDAD")} ${hintRule("SER_PROF")}` };
  };
}

/* -------------------- MCQ builders -------------------- */
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
  const wrong2 = `Esta ${o1.s} ${prep.phrase} ${o2.s} en ${r}.`;
  const wrong3 = (prep.k === "detras")
    ? `Hay ${o1.s} detras ${o2.s} en ${r}.`
    : `Hay ${o1.s} en ${r} ${prep.phrase} ${o2.s}.`;

  const choices = shuffle([correct, wrong1, wrong2, wrong3]);
  const answerIndex = choices.indexOf(correct);

  const grammar = (prep.k === "entre")
    ? "HAY + X + entre A y B + en + lugar"
    : "HAY + X + (encima/debajo/delante/detras/al lado/dentro/fuera) DE + Y + en + lugar";

  return qMCQ(
    "Elige la frase correcta:",
    choices,
    answerIndex,
    `Regola: 'hay' = esistenza. Corretta: ${correct}`,
    "hay + lugar",
    grammar
  );
}

function buildMCQ_Mucho(level){
  const o = pick(objects);
  const room = pick(rooms);
  const correctForm = (o.g === "f") ? "muchas" : "muchos";
  const correct = `Hay ${correctForm} ${o.p} en ${room}.`;

  const choices = shuffle([
    `Hay mucho ${o.p} en ${room}.`,
    `Hay mucha ${o.p} en ${room}.`,
    `Hay muchos ${o.p} en ${room}.`,
    `Hay muchas ${o.p} en ${room}.`
  ]);

  return qMCQ(
    "Completa con la forma correcta de 'mucho':",
    choices,
    choices.indexOf(correct),
    `Plural: ${correctForm} + ${o.p}.`,
    "mucho/a/os/as",
    "MUCHO: mucho/mucha/muchos/muchas + sustantivo (concordanza)"
  );
}

function buildMCQ_Deictic(level){
  const d = pick(deictics);
  const r = pick(rooms);
  const o = pick(objects);

  const correct = `${d} hay ${o.s} en ${r}.`;
  const wrongA = `${d} esta ${o.s} en ${r}.`;
  const wrongB = `Hay ${d} ${o.s} en ${r}.`;
  const wrongC = `${d} tengo ${o.s} en ${r}.`;

  const choices = shuffle([correct, wrongA, wrongB, wrongC]);

  return qMCQ(
    `Elige la frase correcta usando '${d}':`,
    choices,
    choices.indexOf(correct),
    `Struttura: '${d} hay ...'.`,
    "aqui/ahi/alli",
    "DEICTICOS: aqui (qui), ahi (li), alli (la) + HAY + ..."
  );
}

function buildMCQ_House(level){
  const t = pick(houseTypes);
  const roomCount = pick([2,3,4,5]);
  const hasGarden = Math.random() < 0.4;

  const correct = `Mi casa es ${t}. Tiene ${roomCount} habitaciones${hasGarden ? " y un jardin" : ""}.`;
  const wrong1 = `Mi casa esta ${t}. Tiene ${roomCount} habitaciones${hasGarden ? " y un jardin" : ""}.`;
  const wrong2 = `Mi casa es ${t}. Tiene ${roomCount} habitacion${hasGarden ? " y un jardin" : ""}.`;
  const wrong3 = `Mi casa es ${t}. Tiene ${roomCount} habitaciones${hasGarden ? " y una jardin" : ""}.`;

  const choices = shuffle([correct, wrong1, wrong2, wrong3]);

  return qMCQ(
    "Elige la descripcion correcta:",
    choices,
    choices.indexOf(correct),
    "Ojo: 'Mi casa es...'; plural: habitaciones; 'un jardin'.",
    "descripcion casa",
    "DESCRIBIR CASA: Mi casa es ... / Tiene + numero + habitaciones"
  );
}

function buildMCQ_Family(level){
  const f = pick(family);
  const name = pick(["Ana","Lucia","Pablo","Mario","Sara","Laura","Diego","Elena","Carlos","Marta"]);
  const job = pick(["medico","profesor","estudiante","ingeniera","cocinero","enfermera","abogado","dependienta"]);
  const age = pick([12,13,14,15,16,17,40,42,45,50,65,70]);

  const correct = `${cap(f.sing)} se llama ${name} y tiene ${age} anos. Es ${job}.`;
  const wrong1 = `${cap(f.sing)} se llama ${name} y es ${age} anos. Es ${job}.`;
  const wrong2 = `${cap(f.sing)} llama ${name} y tiene ${age} anos. Es ${job}.`;
  const wrong3 = `${cap(f.sing)} se llama ${name} y tiene ${age} anos. Esta ${job}.`;

  const choices = shuffle([correct, wrong1, wrong2, wrong3]);

  return qMCQ(
    "Elige la frase correcta sobre la familia:",
    choices,
    choices.indexOf(correct),
    "Edad: TENER anos. Profesion: SER ...",
    "familia",
    "FAMILIA: se llama + nombre; tiene + edad; es + profesion"
  );
}

const cultureFixed = [
  qMCQ("Que ciudad es la capital de Espana?", ["Barcelona","Madrid","Valencia","Sevilla"], 1, "La capital es Madrid.", "cultura", "CULTURA: capital de Espana = Madrid"),
  qMCQ("En que ciudad esta la Sagrada Familia?", ["Madrid","Barcelona","Bilbao","Granada"], 1, "Esta en Barcelona.", "cultura", "CULTURA: Sagrada Familia = Barcelona"),
  qMCQ("Donde esta el Museo del Prado?", ["Madrid","Barcelona","Bilbao","Granada"], 0, "Esta en Madrid.", "cultura", "CULTURA: Museo del Prado = Madrid"),
  qMCQ("Las Ramblas es una calle famosa de...", ["Madrid","Barcelona","Salamanca","Toledo"], 1, "En Barcelona.", "cultura", "CULTURA: Las Ramblas = Barcelona")
];
function buildMCQ_Culture(level){
  return pick(cultureFixed);
}

/* -------------------- OPEN builders -------------------- */
function buildOPEN_HayInRoom(level){
  const o = pick(objects);
  const room = pick(rooms);
  const sample = `Hay ${o.s} en ${room}.`;
  return qOPEN(
    `Scrivi una frase corretta che dica che c'e ${o.s} in ${room}. (Usa 'hay')`,
    makeValidator_HayInRoom(o, room),
    sample,
    "hay (aperta)",
    "HAY: Hay + nome + en + luogo (oppure: En + luogo + hay + nome)"
  );
}

function buildOPEN_Mucho(level){
  const obj = pick(objects);
  const room = pick(rooms);
  const correctMucho = (obj.g === "f") ? "muchas" : "muchos";
  const sample = `Hay ${correctMucho} ${obj.p} en ${room}.`;
  return qOPEN(
    `Scrivi una frase con 'hay' + 'mucho' (forma giusta) per dire che in ${room} ci sono molti/e ${obj.p}.`,
    makeValidator_MuchoPlural(obj, room),
    sample,
    "mucho (aperta)",
    "MUCHO: mucho/mucha/muchos/muchas + nome (concordanza)"
  );
}

function buildOPEN_Deictic(level){
  const d = pick(deictics);
  const obj = pick(objects);
  const room = pick(rooms);
  const sample = `${cap(d)} hay ${obj.s} en ${room}.`;
  return qOPEN(
    `Scrivi una frase corretta con '${d}' + 'hay' + oggetto + stanza.`,
    makeValidator_DeicticHay(d, obj, room),
    sample,
    "deicticos (aperta)",
    "DEICTICOS + HAY: aqui/ahi/alli + hay + nome + en + luogo"
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

  const grammar = (prep.k === "entre")
    ? "POSICION: entre A y B (senza 'de')"
    : "POSICION: encima/debajo/delante/detras/al lado/dentro/fuera + DE";

  return qOPEN(
    `Scrivi una frase con 'hay' usando la posizione '${prep.phrase}'.`,
    makeValidator_PrepLocation(prep, obj1, obj2, room),
    sample,
    "preposiciones (aperta)",
    grammar
  );
}

function buildOPEN_Family(level){
  const f = pick(family);
  const name = pick(["Ana","Lucia","Pablo","Mario","Sara","Laura","Diego","Elena","Carlos","Marta"]);
  const job = pick(["medico","profesor","estudiante","ingeniera","cocinero","enfermera","abogado","dependienta"]);
  const age = pick([12,13,14,15,16,17,40,42,45,50,65,70]);
  const sample = `${cap(f.sing)} se llama ${name} y tiene ${age} anos. Es ${job}.`;

  return qOPEN(
    `Scrivi una frase su ${f.sing}: nome + eta + lavoro.`,
    makeValidator_FamilyAgeJob(f.sing, name, age, job),
    sample,
    "familia (aperta)",
    "FAMILIA: X se llama ...; tiene ... anos; es + profesion"
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
    const exists = all.some(x => {
      const k2 = (x.type === "mcq")
        ? `mcq||${x.prompt}||${x.choices.join("||")}`
        : `open||${x.prompt}||${x.sample}`;
      return k2 === key;
    });
    if(!exists) all.push(q);
  }

  return all.slice(0,250);
}

/* -------------------- App State -------------------- */
let BANK = generate250("normal");
let quiz = [];
let idx = 0;
let score = 0;
let locked = false;
let wrongLog = [];

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

  $("grammarText").textContent = q.grammar || "-";

  $("qtext").innerHTML = wrapGloss(q.prompt);

  // toggle MCQ vs OPEN UI
  $("choices").innerHTML = "";
  $("openWrap").classList.add("hidden");

  if(q.type === "mcq"){
    const choicesEl = $("choices");
    q.choices.forEach((c, i) => {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.type = "button";
      btn.innerHTML = wrapGloss(c);
      btn.addEventListener("click", () => chooseMCQ(i, btn));
      choicesEl.appendChild(btn);
    });
  } else {
    $("openWrap").classList.remove("hidden");
    $("openHint").innerHTML = `Esempio valido: ${wrapGloss(q.sample)}`;
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
  if(correctBtn) correctBtn.classList.add("correct");

  if(i === q.answerIndex){
    score += 1;
    $("feedback").innerHTML = `✅ <strong>Correcto</strong> — ${escapeHtml(q.explanation)}`;
  } else {
    btn.classList.add("wrong");
    $("feedback").innerHTML = `❌ <strong>No</strong> — ${escapeHtml(q.explanation)}`;
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
    $("feedback").innerHTML = `✅ <strong>Correcto</strong> — ${escapeHtml(res.hint)}`;
  } else {
    $("feedback").innerHTML = `❌ <strong>No</strong><br><span class="muted">Suggerimento:</span> ${escapeHtml(res.hint)}<br><span class="muted">Corretto:</span> <strong>${wrapGloss(res.correct)}</strong>`;
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
  else if(pct >= 60) msg += " Bene, continua cosi.";
  else msg += " Da ripassare: hay, mucho, preposizioni, tener anos, ser...";

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
        <div class="tag">Errore ${k+1} • ${escapeHtml(q.tag)} • MCQ</div>
        <div><strong>Domanda:</strong> ${wrapGloss(q.prompt)}</div>
        <div><strong>La tua risposta:</strong> ${wrapGloss(chosen)}</div>
        <div><strong>Corretto:</strong> ${wrapGloss(correct)}</div>
        <div class="muted" style="margin-top:6px">${escapeHtml(q.explanation)}</div>
      `;
    } else {
      const user = w.userText ?? "(vuota)";
      const preview = q.validator("");
      div.innerHTML = `
        <div class="tag">Errore ${k+1} • ${escapeHtml(q.tag)} • OPEN</div>
        <div><strong>Domanda:</strong> ${wrapGloss(q.prompt)}</div>
        <div><strong>La tua risposta:</strong> ${escapeHtml(user)}</div>
        <div><strong>Esempio corretto:</strong> ${wrapGloss(preview.correct)}</div>
        <div class="muted" style="margin-top:6px">${escapeHtml(preview.hint)}</div>
      `;
    }

    box.appendChild(div);
  });

  box.classList.remove("hidden");
}

/* -------------------- Quiz building with format -------------------- */
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
  alert("Fatto! Ho rigenerato una banca di 250 domande.");
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

// click-to-translate
document.addEventListener("click", (e) => {
  const el = e.target.closest(".gloss-word");
  if(!el){
    hideGlossTooltip();
    return;
  }
  e.preventDefault();
  const key = el.getAttribute("data-key");
  const esText = el.getAttribute("data-es");
  const r = el.getBoundingClientRect();
  showGlossTooltip(r.left, r.top, esText, key);
});

document.addEventListener("keydown", (e) => {
  if(e.key === "Escape") hideGlossTooltip();
});

/* Avvio */
show("setup");
