/* Quiz Spagnolo • STEP 8+9
   STEP 8: progressi salvati in locale (offline)
   STEP 9: modalità classe multi-device SENZA server: studenti esportano un codice, docente importa e vede classifica.
   (Questa soluzione evita backend e funziona anche a scuola con sola condivisione del codice.)
*/

'use strict';

// PWA
window.addEventListener('load', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});


const $ = (id) => document.getElementById(id);

/* -------------------- Usage / Profilo studente -------------------- */
const USAGE_KEY = 'espanol_usage_v1';
function loadUsage(){
  return loadJSON(USAGE_KEY, { sessions:0, answered:0, profileReady:false });
}
function saveUsage(u){ saveJSON(USAGE_KEY, u); }
let USAGE = loadUsage();

/* -------------------- Identity (nome + device) -------------------- */
const IDKEY = {
  name: 'espanol_user_name_v1',
  device: 'espanol_device_id_v1'
};

function getDeviceId(){
  let id = localStorage.getItem(IDKEY.device);
  if(!id){
    id = 'dev_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
    localStorage.setItem(IDKEY.device, id);
  }
  return id;
}

function getSavedName(){
  return (localStorage.getItem(IDKEY.name) || '').trim();
}

function saveName(name){
  localStorage.setItem(IDKEY.name, (name||'').trim());
}


/* -------------------- Storage -------------------- */
const STORAGE = {
  progress: 'espanol_progress_v1',
  history: 'espanol_history_v1',
  teacher: 'espanol_teacher_v1'
};

function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch{ return fallback; }
}
function saveJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function nowISO(){
  return new Date().toISOString();
}

/* -------------------- Helpers -------------------- */
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
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function norm(s){
  return (s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g,' ')
    .replace(/[.?!]+$/,'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function encodeCode(obj){
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return b64;
}
function decodeCode(code){
  const b64 = code.replace(/-/g,'+').replace(/_/g,'/');
  const pad = b64 + '==='.slice((b64.length + 3) % 4);
  const json = decodeURIComponent(escape(atob(pad)));
  return JSON.parse(json);
}

/* -------------------- Audio (TTS) -------------------- */
function speakES(text){
  try{
    if(!text) return;
    if(!('speechSynthesis' in window)) { setToast('Audio non supportato su questo dispositivo.'); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'es-ES';
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }catch{ /* ignore */ }
}

/* -------------------- Content pools -------------------- */
const ROOMS = ['la cocina','el salón','el comedor','el dormitorio','el baño','el pasillo'];
const OBJECTS = [
  {es:'una mesa', it:'un tavolo', g:'f', p:'mesas'},
  {es:'una silla', it:'una sedia', g:'f', p:'sillas'},
  {es:'un sofá', it:'un divano', g:'m', p:'sofás'},
  {es:'una cama', it:'un letto', g:'f', p:'camas'},
  {es:'un armario', it:'un armadio', g:'m', p:'armarios'},
  {es:'una ventana', it:'una finestra', g:'f', p:'ventanas'},
  {es:'una puerta', it:'una porta', g:'f', p:'puertas'}
];
const FAMILY = ['mi madre','mi padre','mi hermano','mi hermana','mi abuelo','mi abuela'];
const JOBS = ['profesor/a','médico/a','estudiante','cocinero/a','enfermero/a','dependiente/a'];
const ADJ_PERM = ['alto/a','bajo/a','joven','simpático/a','inteligente','serio/a'];
const ADJ_STATE = ['cansado/a','contento/a','en casa','en el instituto','en el salón'];
const FREQ = ['siempre','a menudo','a veces','casi nunca','nunca'];

const VERBS = [
  // base/regolari
  {inf:'trabajar', it:'lavorare', type:'ar', yo:'trabajo'},
  {inf:'estudiar', it:'studiare', type:'ar', yo:'estudio'},
  {inf:'vivir', it:'vivere', type:'ir', yo:'vivo'},
  {inf:'comer', it:'mangiare', type:'er', yo:'como'},
  {inf:'abrir', it:'aprire', type:'ir', yo:'abro'},
  {inf:'leer', it:'leggere', type:'er', yo:'leo'},
  {inf:'jugar', it:'giocare', type:'ue', yo:'juego'},
  // fondamentali
  {inf:'ser', it:'essere', type:'irreg', yo:'soy'},
  {inf:'estar', it:'stare/essere', type:'irreg', yo:'estoy'},
  {inf:'tener', it:'avere', type:'irreg', yo:'tengo'},
  {inf:'ir', it:'andare', type:'irreg', yo:'voy'},
  {inf:'hacer', it:'fare', type:'go', yo:'hago'},
  {inf:'haber', it:"c'è/ci sono", type:'hay', yo:'hay'},
  // irregolari prof (selezione)
  {inf:'poner', it:'mettere', type:'go', yo:'pongo'},
  {inf:'salir', it:'uscire', type:'go', yo:'salgo'},
  {inf:'traer', it:'portare', type:'go', yo:'traigo'},
  {inf:'conocer', it:'conoscere', type:'go', yo:'conozco'},
  {inf:'decir', it:'dire', type:'go', yo:'digo'},
  {inf:'pedir', it:'chiedere', type:'i', yo:'pido'},
  {inf:'venir', it:'venire', type:'go', yo:'vengo'},
  {inf:'poder', it:'potere', type:'ue', yo:'puedo'},
  {inf:'querer', it:'volere', type:'ie', yo:'quiero'},
  {inf:'dormir', it:'dormire', type:'ue', yo:'duermo'},
  {inf:'sentir', it:'sentire/provare', type:'ie', yo:'siento'},
  {inf:'saber', it:'sapere', type:'irreg', yo:'sé'},
  {inf:'dar', it:'dare', type:'irreg', yo:'doy'},
  {inf:'ver', it:'vedere', type:'irreg', yo:'veo'},
  // riflessivi routine
  {inf:'levantarse', it:'alzarsi', type:'refl', yo:'me levanto'},
  {inf:'despertarse', it:'svegliarsi', type:'refl', yo:'me despierto'},
  {inf:'ducharse', it:'fare la doccia', type:'refl', yo:'me ducho'},
  {inf:'acostarse', it:'andare a letto', type:'refl', yo:'me acuesto'},
  {inf:'vestirse', it:'vestirsi', type:'refl', yo:'me visto'}
];

/* -------------------- Progress model -------------------- */
function defaultProgress(){
  return {
    createdAt: nowISO(),
    totals: { attempts:0, correct:0, streakBest:0 },
    streak: 0,
    skills: {}, // {skill:{seen,correct}}
    verbs: {},  // {inf:{seen,correct}}
    last10: []  // [{ts,score,total}]
  };
}

function bump(progress, key, ok){
  progress.skills[key] ||= { seen:0, correct:0 };
  progress.skills[key].seen += 1;
  if(ok) progress.skills[key].correct += 1;
}

function bumpVerb(progress, inf, ok){
  progress.verbs[inf] ||= { seen:0, correct:0 };
  progress.verbs[inf].seen += 1;
  if(ok) progress.verbs[inf].correct += 1;
}

/* -------------------- Question builders -------------------- */
let qCounter = 0;
function qId(prefix){ qCounter += 1; return `${prefix}-${qCounter}`; }

function mcq({skill, prompt, choices, answerIndex, explain, meta, tts}){
  return { id:qId('m'), type:'mcq', skill, prompt, choices, answerIndex, explain, meta: meta||{}, tts: tts || (meta&&meta.tts)||'' };
}
function open({skill, prompt, hint, validate, meta, tts}){
  return { id:qId('o'), type:'open', skill, prompt, hint, validate, meta: meta||{}, tts: tts || (meta&&meta.tts)||'' };
}
function cloze({skill, prompt, answer, hint, meta, tts}){
  return { id:qId('c'), type:'cloze', skill, prompt, answer, hint, meta: meta||{}, tts: tts || (meta&&meta.tts)||'' };
}

function buildA_present(opts){
  opts ||= {};
  const prefer = opts.prefer;
  const pool = VERBS.filter(x => ['ar','er','ir','ue','ie','i','go','irreg','refl'].includes(x.type) && x.inf !== 'haber');
  const v = prefer ? (VERBS.find(x=>x.inf===prefer) || pick(pool)) : pick(pool);
  const subj = pick(['Yo','Tú','Nosotros','Ella','Él']);

  // simple conjugation for Yo only (teach gradually) - for others we use MCQ with provided correct form
  if(subj === 'Yo'){
    const correct = v.yo;
    return cloze({
      skill:'Presente (verbi)',
      prompt:`${subj} ___ (${v.inf}).`,
      answer: correct,
      hint:`Verbo: (${v.inf}) = ${v.it}. Forma Yo: ${correct}.`,
      meta:{ verb:v.inf },
      tts:`${subj} ... ${v.inf}.`
    });
  }

  // For non-Yo: keep safe with a small set (ser/estar/tener/ir) + regular patterns
  const safe = ['ser','estar','tener','ir','hacer','poner','salir','traer','conocer','decir','pedir','poder','querer','vivir','comer','trabajar','estudiar'];
  const safePool = VERBS.filter(x=>safe.includes(x.inf));
  const vv = (prefer && safe.includes(prefer) && VERBS.find(x=>x.inf===prefer)) ? VERBS.find(x=>x.inf===prefer) : pick(safePool);
  const forms = {
    ser: {"Tú":"eres","Nosotros":"somos","Ella":"es","Él":"es"},
    estar: {"Tú":"estás","Nosotros":"estamos","Ella":"está","Él":"está"},
    tener: {"Tú":"tienes","Nosotros":"tenemos","Ella":"tiene","Él":"tiene"},
    ir: {"Tú":"vas","Nosotros":"vamos","Ella":"va","Él":"va"},
    hacer: {"Tú":"haces","Nosotros":"hacemos","Ella":"hace","Él":"hace"},
    vivir: {"Tú":"vives","Nosotros":"vivimos","Ella":"vive","Él":"vive"},
    comer: {"Tú":"comes","Nosotros":"comemos","Ella":"come","Él":"come"},
    trabajar: {"Tú":"trabajas","Nosotros":"trabajamos","Ella":"trabaja","Él":"trabaja"},
    estudiar: {"Tú":"estudias","Nosotros":"estudiamos","Ella":"estudia","Él":"estudia"},
    pedir: {"Tú":"pides","Nosotros":"pedimos","Ella":"pide","Él":"pide"},
    decir: {"Tú":"dices","Nosotros":"decimos","Ella":"dice","Él":"dice"},
    querer: {"Tú":"quieres","Nosotros":"queremos","Ella":"quiere","Él":"quiere"},
    poder: {"Tú":"puedes","Nosotros":"podemos","Ella":"puede","Él":"puede"},
    poner: {"Tú":"pones","Nosotros":"ponemos","Ella":"pone","Él":"pone"},
    salir: {"Tú":"sales","Nosotros":"salimos","Ella":"sale","Él":"sale"},
    traer: {"Tú":"traes","Nosotros":"traemos","Ella":"trae","Él":"trae"},
    conocer: {"Tú":"conoces","Nosotros":"conocemos","Ella":"conoce","Él":"conoce"}
  };
  const correct = (forms[vv.inf] && forms[vv.inf][subj]) ? forms[vv.inf][subj] : vv.yo;
  const distractors = shuffle([vv.yo, 'es', 'está', 'tengo', 'voy', correct]).filter((x,i,a)=>a.indexOf(x)===i).slice(0,4);
  if(!distractors.includes(correct)) distractors[randInt(distractors.length)] = correct;
  const choices = shuffle(distractors);
  return mcq({
    skill:'Presente (verbi)',
    prompt:`Completa: ${subj} ___ (${vv.inf}).`,
    choices,
    answerIndex: choices.indexOf(correct),
    explain:`(${vv.inf}) = ${vv.it}. Forma corretta: ${subj} ${correct}.`,
    meta:{ verb: vv.inf },
    tts:`${subj} ... ${vv.inf}.`
  });
}

function buildB_serEstar(){
  const kind = randInt(3);
  if(kind === 0){
    const who = pick(FAMILY);
    const job = pick(JOBS);
    return cloze({
      skill:'Ser/Estar',
      prompt:`${capitalize(who)} ___ ${job}.`,
      answer:'es',
      hint:'SER = identità/professione. Esempio: Mi madre es profesora.',
      meta:{ verb:'ser' }
    });
  }
  if(kind === 1){
    const who = pick(FAMILY);
    const state = pick(['en casa','en el instituto','cansado','contento']);
    const correct = state.startsWith('en ') ? 'está' : 'está';
    return cloze({
      skill:'Ser/Estar',
      prompt:`${capitalize(who)} ___ ${state}.`,
      answer: correct,
      hint:'ESTAR = stato/posizione.',
      meta:{ verb:'estar' }
    });
  }
  // correction style
  const wrong = pick([
    {s:'Mi padre está médico.', c:'Mi padre es médico.'},
    {s:'Yo soy en casa.', c:'Yo estoy en casa.'},
    {s:'Mi madre es cansada.', c:'Mi madre está cansada.'}
  ]);
  return open({
    skill:'Ser/Estar',
    prompt:`Correggi: ❌ ${wrong.s}`,
    hint:`Scrivi la frase corretta. Suggerimento: SER=professione/identità; ESTAR=stato/luogo.`,
    validate:(u)=>{
      const ok = norm(u) === norm(wrong.c);
      return { ok, correct: wrong.c, msg: ok ? 'Perfetto.' : 'Controlla ser/estar.' };
    },
    meta:{ }
  });
}

function buildC_hayEsta(){
  const room = pick(ROOMS);
  const obj = pick(OBJECTS);
  const n = pick([1,2,3,4]);
  const plural = n > 1;

  const mode = randInt(3);
  if(mode === 0){
    // hay existence
    const answer = 'hay';
    return cloze({
      skill:'Hay/Está + Casa',
      prompt:`En ${room} ___ ${plural ? n : ''} ${plural ? obj.p : obj.es}.`.replace(/\s+/g,' ').trim(),
      answer,
      hint:`HAY = c'è/ci sono (esistenza). ${obj.es} = ${obj.it}.`,
      meta:{ verb:'haber' }
    });
  }
  if(mode === 1){
    // está position
    const answer = plural ? 'están' : 'está';
    const subj = plural ? `Las ${obj.p}` : capitalize(obj.es);
    return cloze({
      skill:'Hay/Está + Casa',
      prompt:`${subj} ___ en ${room}.`,
      answer,
      hint:`ESTAR = dove si trova. Singolare: está, plurale: están.`,
      meta:{ verb:'estar' }
    });
  }
  // open description (accept variants)
  const prompt = `Scrivi 1 frase sulla casa usando HAY (esistenza) con: ${obj.es} + ${room}.`;
  return open({
    skill:'Hay/Está + Casa',
    prompt,
    hint:`Esempio: En ${room} hay ${obj.es}. (${obj.es} = ${obj.it})`,
    tts:`Escribe una frase con "hay" y: ${obj.es} en ${room}.`,
    validate:(u)=>{
      const t = norm(u);
      const ok = (t.includes('hay') && t.includes(norm(room)) && t.includes(norm(obj.es).replace('un ','').replace('una ',''))) ||
                 (t.startsWith('hay') && t.includes('en') && t.includes(norm(room)));
      return {
        ok,
        correct:`En ${room} hay ${obj.es}.`,
        msg: ok ? 'Ottimo: hai usato HAY correttamente.' : 'Serve HAY + oggetto + (en + stanza).'
      };
    },
    meta:{ verb:'haber' }
  });
}

function buildGustar(){
  const likeThing = pick([
    {es:'mi habitación', it:'la mia camera', n:'s'},
    {es:'los deportes', it:'gli sport', n:'p'},
    {es:'el fútbol', it:'il calcio', n:'s'},
    {es:'los animales', it:'gli animali', n:'p'}
  ]);
  const pron = pick([
    {es:'me', it:'a me'},
    {es:'te', it:'a te'},
    {es:'le', it:'a lui/lei'},
    {es:'nos', it:'a noi'}
  ]);
  const verb = likeThing.n === 'p' ? 'gustan' : 'gusta';

  return cloze({
    skill:'Gustar + pronombre',
    prompt:`A ${pron.it} (${pron.es}) ___ ${likeThing.es}. (gusta/gustan)`,
    answer: verb,
    hint:`GUSTAR: ${pron.es} gusta (sing.) / ${pron.es} gustan (plur.). ${likeThing.es} = ${likeThing.it}.`,
    meta:{ verb:'gustar' },
    tts:`${pron.es} ... ${likeThing.es}. Gusta o gustan.`
  });
}

function buildMuyMucho(){
  const obj = pick(OBJECTS);
  const room = pick(ROOMS);
  const pickType = randInt(2);
  if(pickType === 0){
    // muy + adj
    const adj = pick(['grande','pequeña','bonita','moderna']);
    return cloze({
      skill:'Muy / Mucho',
      prompt:`Mi casa es ___ ${adj}. (muy/mucho)`,
      answer:'muy',
      hint:'MUY + aggettivo: muy grande.',
      meta:{ }
    });
  }
  // muchos/muchas
  const form = obj.g === 'f' ? 'muchas' : 'muchos';
  return cloze({
    skill:'Muy / Mucho',
    prompt:`En ${room} hay ___ ${obj.p}.`,
    answer: form,
    hint:`MUCHO concorda: ${form} ${obj.p}. (${obj.es} = ${obj.it})`,
    meta:{ }
  });
}

function buildRoutine(){
  const v = pick(VERBS.filter(x => x.type === 'refl'));
  const freq = pick(FREQ);
  return mcq({
    skill:'Routine + Riflessivi',
    prompt:`Completa: Yo ${freq} ___ temprano. (${v.inf})`,
    choices: shuffle([v.yo, 'me levanta', 'me levanto', 'me despierto']).filter((x,i,a)=>a.indexOf(x)===i).slice(0,4),
    answerIndex: undefined,
    explain:`Riflessivi: yo ${v.yo}. (${v.inf} = ${v.it}).`,
    meta:{ verb:v.inf }
  });
}

function capitalize(s){
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/* -------------------- Bank and adaptive selection -------------------- */
function buildQuestionBase(){
  const roll = randInt(100);
  if(roll < 28) return buildA_present();
  if(roll < 48) return buildB_serEstar();
  if(roll < 70) return buildC_hayEsta();
  if(roll < 80) return buildGustar();
  if(roll < 90) return buildMuyMucho();
  return buildRoutine();
}

let TARGET = { active:false, skills:[], verbs:[] };

function computeStudentProfile(){
  const skills = Object.entries(PROGRESS.skills||{})
    .map(([k,v])=>({k, seen:v.seen||0, correct:v.correct||0, pct: (v.seen? Math.round((v.correct/v.seen)*100) : 0)}))
    .filter(x=>x.seen >= 5)
    .sort((a,b)=>a.pct - b.pct);

  const verbs = Object.entries(PROGRESS.verbs||{})
    .map(([inf,v])=>({inf, seen:v.seen||0, correct:v.correct||0, pct: (v.seen? Math.round((v.correct/v.seen)*100):0)}))
    .filter(x=>x.seen >= 3)
    .sort((a,b)=>a.pct - b.pct);

  const weakSkills = skills.filter(x=>x.pct < 70).slice(0,3).map(x=>x.k);
  const weakVerbs = verbs.filter(x=>x.pct < 70).slice(0,8).map(x=>x.inf);
  return { weakSkills, weakVerbs, skills, verbs };
}

function pickVerbPreferWeak(){
  if(!TARGET.active || !TARGET.verbs?.length) return null;
  // 65%: prendi un verbo "debole"
  if(randInt(100) < 65) return pick(TARGET.verbs);
  return null;
}

function buildQuestion(){
  if(!TARGET.active) return buildQuestionBase();
  // Se abbiamo competenze deboli, spingiamo lì (ma non solo)
  const pool = TARGET.skills && TARGET.skills.length ? TARGET.skills : [];
  const roll = randInt(100);
  if(pool.length && roll < 70){
    const s = pick(pool);
    if(s === 'Presente (verbi)') return buildA_present({prefer: pickVerbPreferWeak()});
    if(s === 'Ser/Estar') return buildB_serEstar();
    if(s === 'Hay/Está + Casa') return buildC_hayEsta();
    if(s === 'Gustar + pronombre') return buildGustar();
    if(s === 'Muy / Mucho') return buildMuyMucho();
    if(s === 'Routine + Riflessivi') return buildRoutine();
  }
  // fallback
  return buildQuestionBase();
}

function buildQuiz(count){
  const qs = [];
  while(qs.length < count){
    const q = buildQuestion();
    qs.push(q);
  }
  return qs;
}

/* -------------------- App state -------------------- */
let PROGRESS = loadJSON(STORAGE.progress, defaultProgress());
let HISTORY = loadJSON(STORAGE.history, []);
// STEP 9 realtime: non usiamo più import/export codici (niente TEACHER roster)

let MODE = 'train';
let STUDENT = '';
let quiz = [];
let idx = 0;
let score = 0;
let locked = false;
let answers = []; // {id, ok, skill, verb?, user?, correct?}

/* -------------------- UI switching -------------------- */
function show(viewId){
  ['home','quiz','result','dashboard','teacher'].forEach(id => $(id).classList.add('hidden'));
  $(viewId).classList.remove('hidden');
  window.scrollTo({top:0, behavior:'smooth'});
}

// Session (per "Riprendi")
const SESSION_KEY = 'espanol_session_v1';

function setToast(text){
  const t = $('toast');
  if(!t) return;
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(setToast._t);
  setToast._t = setTimeout(()=>t.classList.add('hidden'), 2200);
}

function saveSession(){
  try{
    saveJSON(SESSION_KEY, { MODE, STUDENT, quiz, idx, score, answers });
  }catch{}
}

function loadSession(){
  return loadJSON(SESSION_KEY, null);
}

function clearSession(){
  try{ localStorage.removeItem(SESSION_KEY); }catch{}
}

function skillNote(skill){
  const map = {
    'Presente (verbi)': 'Presente indicativo: soggetto + verbo coniugato. Qui alleniamo soprattutto la forma (Yo) e le irregolarità più comuni. ✅ Ricorda: mostra sempre l’infinito e la traduzione.',
    'Ser/Estar': 'SER: identità, professione, caratteristiche (permanenti). ESTAR: luogo e stato momentaneo. Esempi: “Mi madre es profesora” / “Mi madre está en casa”.',
    'Hay/Está + Casa': "HAY = c’è/ci sono (esistenza). ESTÁ/ESTÁN = dove si trova qualcosa (posizione). Esempi: “Hay una mesa en la cocina” / “La mesa está en la cocina”.",
    'Gustar + pronombre': 'GUSTAR: me/te/le/nos/os/les + gusta (singolare) / gustan (plurale). Esempi: “Me gusta el fútbol” / “Me gustan los deportes”.',
    'Muy / Mucho': 'MUY + aggettivo: “muy grande”. MUCHO concorda: mucho/mucha/muchos/muchas + nome. Con verbo: “estudio mucho”.',
    'Routine + Riflessivi': 'Riflessivi: me/te/se + verbo (me levanto, me ducho). Avverbi di frequenza: siempre, a veces, nunca…'
  };
  return map[skill] || '—';
}

function setProgressUI(){
  $('scorePill').textContent = `${idx+1}/${quiz.length} • ${score} pt`;
  const pct = (idx / quiz.length) * 100;
  $('progressBar').style.width = `${pct}%`;
}

function setNote(skill){
  if(MODE === 'test'){
    $('noteBox').classList.add('hidden');
    return;
  }
  $('noteBox').classList.remove('hidden');
  $('noteText').textContent = skillNote(skill);
}

function renderIndex(){
  const wrap = $('qIndex');
  wrap.innerHTML = '';
  for(let i=0;i<quiz.length;i++){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'qDot' + (i===idx ? ' active' : '');
    b.textContent = String(i+1);
    b.disabled = (MODE === 'test');
    b.addEventListener('click', ()=>{ idx=i; renderQuestion(); });
    wrap.appendChild(b);
  }
}

function setFeedback(html){
  $('fb').innerHTML = html || '';
}

function renderQuestion(){
  locked = false;
  $('nextBtn').disabled = true;
  $('openHint').textContent = '';
  setFeedback('');
  $('mcq').innerHTML = '';
  $('openInput').value = '';

  const q = quiz[idx];
  $('qMeta').textContent = `${MODE === 'test' ? 'Verifica' : 'Allenamento'} • ${q.skill}`;
  $('qTitle').textContent = `Domanda ${idx+1}`;
  $('qText').textContent = q.prompt;

  // Audio domanda (pronuncia)
  const speakBtn = $('qSpeak');
  if(speakBtn){
    const st = questionSpeakText(q);
    speakBtn.setAttribute('data-speak', st || '');
    speakBtn.disabled = !st;
    speakBtn.style.opacity = st ? '1' : '.45';
  }

  // Verbo + traduzione (solo allenamento)
  const vc = $('verbChip');
  if(vc){
    if(MODE === 'train' && q.meta && q.meta.verb){
      const v = verbInfo(q.meta.verb);
      if(v){
        vc.innerHTML = `<span class="vEs">(${escapeHtml(v.inf)})</span><span class="vIt">${escapeHtml(v.it)}</span>`;
        vc.classList.remove('hidden');
      } else {
        vc.classList.add('hidden');
      }
    } else {
      vc.classList.add('hidden');
    }
  }
  setNote(q.skill);
  setProgressUI();
  renderIndex();

  // UI mode
  $('open').classList.add('hidden');
  $('mcq').classList.add('hidden');

  if(q.type === 'mcq'){
    $('mcq').classList.remove('hidden');
    q.choices.forEach((c, i)=>{
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      b.textContent = c;
      b.addEventListener('click', ()=>chooseMCQ(i));
      $('mcq').appendChild(b);
    });
  } else {
    $('open').classList.remove('hidden');
    // hint only in train
    if(MODE === 'train') $('openHint').textContent = q.hint || '';
    setTimeout(()=>$('openInput').focus(), 0);
  }

  // buttons
  $('prevBtn').disabled = (idx===0) || (MODE==='test');
}

function escapeHtml(s){
  return (s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

function verbInfo(inf){
  if(!inf) return null;
  return VERBS.find(v=>v.inf===inf) || null;
}

function questionSpeakText(q){
  let s = (q && q.tts) ? String(q.tts) : '';
  if(s) return s;
  const p = String(q?.prompt || '');
  // correzioni: prendi la frase in spagnolo dopo ❌
  if(/Correggi:/i.test(p)){
    const m = p.match(/❌\s*(.*)$/);
    if(m) return m[1].trim();
  }
  // fallback: ripulisci un po'
  let t = p.replace(/^Completa:\s*/i,'')
    .replace(/___/g,'...')
    .replace(/\(([^)]+)\)/g,'$1');
  return t.trim();
}

function recordAnswer(ok, q, userText, correctText){
  answers.push({
    id: q.id,
    ok,
    skill: q.skill,
    verb: q.meta?.verb || null,
    user: userText || null,
    correct: correctText || null
  });

  // progress
  PROGRESS.totals.attempts += 1;
  if(ok) PROGRESS.totals.correct += 1;
  bump(PROGRESS, q.skill, ok);
  if(q.meta?.verb) bumpVerb(PROGRESS, q.meta.verb, ok);

  // streak
  if(ok){
    PROGRESS.streak += 1;
    PROGRESS.totals.streakBest = Math.max(PROGRESS.totals.streakBest, PROGRESS.streak);
    if(PROGRESS.streak === 15) setToast('🏅 15 risposte corrette di fila!');
  } else {
    PROGRESS.streak = 0;
  }

  saveJSON(STORAGE.progress, PROGRESS);
}

function chooseMCQ(i){
  if(locked) return;
  locked = true;

  const q = quiz[idx];
  const correctIdx = q.answerIndex;
  const ok = i === correctIdx;
  if(ok) score += 1;

  const buttons = Array.from($('mcq').querySelectorAll('.choice'));
  buttons.forEach(b=>b.disabled = true);
  if(buttons[correctIdx]) buttons[correctIdx].classList.add('correct');
  if(!ok && buttons[i]) buttons[i].classList.add('wrong');

  recordAnswer(ok, q, q.choices[i], q.choices[correctIdx]);
  if(MODE === 'train'){
    const msg = ok
      ? `✅ <strong>Ben fatto</strong> — ${escapeHtml(q.explain || 'Corretto.')}`
      : `❌ <strong>Quasi</strong> — ${escapeHtml(q.explain || 'Riprova con la regola.')}<div class="muted" style="margin-top:6px">Corretto: <strong>${escapeHtml(q.choices[correctIdx])}</strong></div>`;
    setFeedback(msg);
  }

  // salva sessione per "Riprendi"
  saveSession();

  $('nextBtn').disabled = false;
}

function checkInput(){
  if(locked) return;
  locked = true;

  const q = quiz[idx];
  const user = $('openInput').value;

  // cloze: confronto esatto; open: validatore
  let ok = false;
  let correct = '';
  let msg = '';

  if(q.type === 'cloze'){
    ok = norm(user) === norm(q.answer);
    correct = q.answer;
    msg = ok ? 'Risposta corretta.' : (q.hint || 'Controlla la regola nel post-it.');
  } else {
    const res = q.validate(user);
    ok = !!res.ok;
    correct = res.correct || '';
    msg = res.msg || (ok ? 'Corretto.' : 'Riprova con la regola.');
  }

  if(ok) score += 1;
  recordAnswer(ok, q, user, correct);

  if(MODE === 'train'){
    const speakText = ok ? (user || correct) : '';
    const speakLine = (ok && speakText)
      ? `<div class="speak" data-speak="${escapeHtml(speakText)}">🔊 Tocca per ascoltare: <strong>${escapeHtml(speakText)}</strong></div>`
      : '';
    const fb = ok
      ? `✅ <strong>Ben fatto</strong> — ${escapeHtml(msg)}${speakLine}`
      : `❌ <strong>Quasi</strong> — ${escapeHtml(msg)}${correct ? `<div class="muted" style="margin-top:6px">Corretto: <strong>${escapeHtml(correct)}</strong></div>` : ''}`;
    setFeedback(fb);
  }

  $('nextBtn').disabled = false;
  saveSession();
}

function next(){
  idx += 1;
  if(idx >= quiz.length){
    finish();
  } else {
    renderQuestion();
  }
}

function finish(){
  const total = quiz.length;
  const pct = Math.round((score/total)*100);
  const ts = nowISO();

  // usage / sblocco profilo
  const wasReady = !!USAGE.profileReady;
  USAGE.sessions += 1;
  USAGE.answered += total;
  if(!USAGE.profileReady && (USAGE.sessions >= 3 || USAGE.answered >= 50)){
    USAGE.profileReady = true;
  }
  saveUsage(USAGE);

  // breakdown
  const skillBreakdown = {};
  answers.forEach(a=>{
    skillBreakdown[a.skill] ||= {seen:0, correct:0};
    skillBreakdown[a.skill].seen += 1;
    if(a.ok) skillBreakdown[a.skill].correct += 1;
  });

  // voto in decimi (semplice)
  const voto = Math.round((pct/10)*10)/10; // 0.0-10.0

  const result = {
    student: STUDENT || 'Studente',
    mode: MODE,
    score,
    total,
    pct,
    grade: voto,
    skillBreakdown,
    timestamp: ts
  };

  HISTORY.unshift(result);
  HISTORY = HISTORY.slice(0, 80);
  saveJSON(STORAGE.history, HISTORY);

  PROGRESS.last10.unshift({ts, score, total});
  PROGRESS.last10 = PROGRESS.last10.slice(0,10);
  saveJSON(STORAGE.progress, PROGRESS);

  // render result
  $('gradePill').textContent = `Voto: ${voto}/10`;
  $('resultSummary').textContent = `${score}/${total} (${pct}%) — ${MODE === 'test' ? 'Verifica' : 'Allenamento'}`;

  // skills bars in result
  $('resultSkills').innerHTML = renderSkillBars(skillBreakdown);

  // share code
  $('shareCode').value = encodeCode(result);

  clearSession();
  show('result');

  updateTargetUI();
  if(USAGE.profileReady && !wasReady){
    // prima volta: mostra analisi e proponi allenamento mirato
    setToast('📌 Profilo pronto: prova Allenamento mirato');
    openProfileModal();
  }
}

function renderSkillBars(skillsObj){
  const entries = Object.entries(skillsObj || {}).map(([k,v])=>{
    const pr = v.seen ? Math.round((v.correct/v.seen)*100) : 0;
    return {k, pr, v};
  }).sort((a,b)=>b.pr - a.pr);
  if(!entries.length) return '<div class="muted">—</div>';
  return entries.map(e=>{
    return `
      <div class="skill">
        <div class="skill__name">${escapeHtml(e.k)}</div>
        <div class="skill__bar"><div class="skill__fill" style="width:${e.pr}%"></div></div>
        <div class="small">${e.pr}% • ${e.v.correct}/${e.v.seen}</div>
      </div>
    `;
  }).join('');
}

/* -------------------- Dashboard -------------------- */
function updateTargetUI(){
  const btn = $('targetBtn');
  if(btn) btn.classList.toggle('hidden', !USAGE.profileReady);
}

function profileHTML(p){
  const lines = [];
  if(p.weakSkills && p.weakSkills.length){
    lines.push(`<div><strong>Competenze da rinforzare</strong></div>`);
    p.weakSkills.forEach(s=>{
      const row = p.skills.find(x=>x.k===s);
      const pct = row ? row.pct : '—';
      lines.push(`<div>• ${escapeHtml(s)} <span class="muted">(${pct}%)</span></div>`);
    });
  } else {
    lines.push(`<div><strong>Competenze</strong></div><div class="muted">Per ora va bene: continua ad allenarti.</div>`);
  }
  if(p.weakVerbs && p.weakVerbs.length){
    lines.push(`<div style="margin-top:10px"><strong>Verbi da ripassare</strong></div>`);
    p.weakVerbs.slice(0,8).forEach(inf=>{
      const it = VERBS.find(v=>v.inf===inf)?.it || '';
      lines.push(`<div>• <span style="font-family:'Sans Forgetica',system-ui;letter-spacing:.04em">(${escapeHtml(inf)}) ${escapeHtml(it)}</span></div>`);
    });
  }
  lines.push(`<div class="muted" style="margin-top:10px">Consiglio: fai un <strong>Allenamento mirato</strong> per correggere gli errori più frequenti.</div>`);
  return lines.join('');
}

function openProfileModal(){
  const modal = document.getElementById('profileModal');
  const body = document.getElementById('profileBody');
  if(!modal || !body) return;
  const p = computeStudentProfile();
  body.innerHTML = profileHTML(p);
  modal.classList.remove('hidden');
}

function closeProfileModal(){
  const modal = document.getElementById('profileModal');
  if(modal) modal.classList.add('hidden');
}

function startTargetedQuiz(){
  // prepara profilo e abilita il targeting
  const p = computeStudentProfile();
  TARGET.active = true;
  TARGET.skills = (p.weakSkills && p.weakSkills.length) ? p.weakSkills : [];
  TARGET.verbs = (p.weakVerbs && p.weakVerbs.length) ? p.weakVerbs : [];
  MODE = 'train';
  STUDENT = (getSavedName() || '').trim();
  const count = clamp(parseInt($('count').value || '38', 10), 10, 60);
  quiz = buildQuiz(count);
  idx = 0;
  score = 0;
  answers = [];
  closeProfileModal();
  setToast('🎯 Allenamento mirato attivo');
  show('quiz');
  renderQuestion();
  saveSession();
}

function renderDashboard(){
  $('dashSkills').innerHTML = renderSkillBars(PROGRESS.skills);

  // verbi più difficili
  const verbRows = Object.entries(PROGRESS.verbs || {})
    .map(([inf,v])=>({inf, seen:v.seen, correct:v.correct, pct: v.seen ? Math.round((v.correct/v.seen)*100) : 0}))
    .sort((a,b)=> (a.pct - b.pct) || (b.seen - a.seen))
    .slice(0, 18)
    .map(v=>{
      const it = VERBS.find(x=>x.inf===v.inf)?.it || '';
      return `<div class="verb"><div><strong>${escapeHtml(v.inf)}</strong> <span class="small">(${escapeHtml(it)})</span></div><div class="small">${v.pct}% • ${v.correct}/${v.seen}</div></div>`;
    }).join('');
  $('dashVerbs').innerHTML = verbRows || '<div class="muted">Fai qualche verifica per vedere i verbi.</div>';

  // storico
  const hist = (HISTORY || []).slice(0, 20).map(r=>{
    const when = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';
    return `<div class="historyItem"><div><strong>${escapeHtml(r.student||'Studente')}</strong> <span class="small">${escapeHtml(when)}</span></div><div class="small">${r.mode==='test'?'Verifica':'Allenamento'} • ${r.score}/${r.total} • ${r.pct}% • voto ${r.grade}/10</div></div>`;
  }).join('');
  $('history').innerHTML = hist || '<div class="muted">Nessuna verifica salvata.</div>';

  show('dashboard');
}

function resetProgress(){
  if(!confirm('Vuoi azzerare i progressi salvati su questo dispositivo?')) return;
  PROGRESS = defaultProgress();
  HISTORY = [];
  saveJSON(STORAGE.progress, PROGRESS);
  saveJSON(STORAGE.history, HISTORY);
  setToast('Progressi azzerati.');
  renderDashboard();
}

/* -------------------- Teacher mode (STEP 9) -------------------- */
// STEP 9 (realtime): elenco partecipanti iscritti alla classe (online/offline + ultimo accesso)
let RT = {
  connected: false,
  members: {},
  classCode: '1GL1-GL2',
  deviceId: null
};

// Firebase (Realtime Database) - config pubblica
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC74fXbAz5R-fRv3WSQZeWQXQKN_ebaUMQ",
  authDomain: "gl1-1gl2.firebaseapp.com",
  databaseURL: "https://gl1-1gl2-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gl1-1gl2",
  storageBucket: "gl1-1gl2.firebasestorage.app",
  messagingSenderId: "704454170305",
  appId: "1:704454170305:web:097fe075e69ca436d62640",
  measurementId: "G-9MKBYT81BD"
};

let _fbInited = false;
let _db = null;

function initRealtime(){
  try{
    if(!_fbInited){
      if(!window.firebase || !firebase.initializeApp) return;
      firebase.initializeApp(FIREBASE_CONFIG);
      _db = firebase.database();
      _fbInited = true;
    }
  }catch(e){
    console.warn('Firebase init error', e);
    return;
  }

  const name = getSavedName();
  if(!name) return; // nome richiesto per registrare presenza

  RT.deviceId = getDeviceId();
  const base = _db.ref(`classes/${RT.classCode}/members/${RT.deviceId}`);
  const statusRef = _db.ref(`classes/${RT.classCode}/members/${RT.deviceId}/online`);
  const lastRef = _db.ref(`classes/${RT.classCode}/members/${RT.deviceId}/lastSeen`);

  // set presenza online
  base.update({
    name,
    online: true,
    lastSeen: firebase.database.ServerValue.TIMESTAMP,
    firstSeen: firebase.database.ServerValue.TIMESTAMP
  }).catch(()=>{});

  // onDisconnect -> offline + lastSeen
  statusRef.onDisconnect().set(false).catch(()=>{});
  lastRef.onDisconnect().set(firebase.database.ServerValue.TIMESTAMP).catch(()=>{});

  // ascolto membri classe
  _db.ref(`classes/${RT.classCode}/members`).on('value', (snap)=>{
    const val = snap.val() || {};
    RT.members = val;
    RT.connected = true;
    // se siamo nella pagina classe, aggiorna
    const teacher = document.getElementById('teacher');
    if(teacher && !teacher.classList.contains('hidden')){
      renderTeacher();
    }else{
      // aggiorna badge discreto se vuoi in futuro
    }
  });
}

function timeAgo(ts){
  if(!ts) return '—';
  const d = (ts instanceof Date) ? ts : new Date(ts);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff/1000);
  if(s < 10) return 'ora';
  if(s < 60) return `${s}s fa`;
  const m = Math.floor(s/60);
  if(m < 60) return `${m} min fa`;
  const h = Math.floor(m/60);
  if(h < 48) return `${h} h fa`;
  return d.toLocaleString();
}

function renderTeacher(){
  const list = Object.values(RT.members || {});
  const total = list.length;
  const online = list.filter(x=>x && x.online).length;
  $('classCount').textContent = `${online} online • ${total} iscritti`;

  const rows = list
    .sort((a,b)=>{
      const ao = a?.online ? 1 : 0;
      const bo = b?.online ? 1 : 0;
      if(ao !== bo) return bo - ao;
      return String(a?.name||'').localeCompare(String(b?.name||''));
    })
    .map((m)=>{
      const dot = m.online ? '🟢' : '🔴';
      const last = timeAgo(m.lastSeen);
      return `<div class="historyItem"><div><strong>${escapeHtml(m.name || 'Studente')}</strong> <span class="small">${dot} ${m.online?'online':'offline'}</span></div><div class="small">Ultimo accesso: ${escapeHtml(last)}</div></div>`;
    }).join('');

  $('classList').innerHTML = rows || '<div class="muted">Nessun partecipante ancora.</div>';
  show('teacher');
}

/* -------------------- App start / events -------------------- */
function startQuiz(){
  // avvio normale: niente targeting
  TARGET.active = false;
  TARGET.skills = [];
  TARGET.verbs = [];
  MODE = $('mode').value;
  STUDENT = (getSavedName() || ($('studentName').value || '')).trim();
  if(!STUDENT){
    setToast('Inserisci il tuo nome per continuare.');
    const modal = document.getElementById('nameModal');
    if(modal) modal.classList.remove('hidden');
    return;
  }
  const count = clamp(parseInt($('count').value || '38', 10), 10, 60);

  quiz = buildQuiz(count);
  idx = 0;
  score = 0;
  answers = [];
  show('quiz');
  renderQuestion();
  saveSession();
}

function copyExportCode(){
  const el = $('shareCode');
  el.focus();
  el.select();
  try{ document.execCommand('copy'); }catch{}
  setToast('Codice copiato.');
}

function exportProgressJSON(){
  const payload = { progress: PROGRESS, history: HISTORY, exportedAt: nowISO() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'progressi-espanol.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportReportHTML(){
  // semplice report stampabile (HTML) senza librerie
  const code = $('shareCode').value || '';
  const w = window.open('', '_blank');
  if(!w) return;
  const title = 'Report Verifica - Quiz Spagnolo';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;padding:18px}h1{margin:0 0 8px}small{color:#555}.box{border:1px solid #ddd;border-radius:12px;padding:12px;margin:12px 0}pre{white-space:pre-wrap;word-break:break-word}</style></head><body><h1>${title}</h1><small>${new Date().toLocaleString()}</small><div class="box"><strong>Riassunto</strong><div>${escapeHtml($('resultSummary').textContent||'')}</div><div>${escapeHtml($('gradePill').textContent||'')}</div></div><div class="box"><strong>Codice risultato</strong><pre>${escapeHtml(code)}</pre></div><div class="box"><strong>Competenze</strong>${$('resultSkills').innerHTML}</div><script>window.onload=()=>setTimeout(()=>window.print(),300);</script></body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function setupNav(){
  $('navHome').addEventListener('click', ()=>show('home'));
  $('navDashboard').addEventListener('click', ()=>renderDashboard());
  $('navTeacher').addEventListener('click', ()=>renderTeacher());
}

function registerSW(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
}

function bind(){
  setupNav();
  // click-to-speak (solo su gesto utente)
  document.addEventListener('click', (e)=>{
    const el = e.target?.closest ? e.target.closest('[data-speak]') : null;
    if(!el) return;
    e.preventDefault();
    e.stopPropagation();
    const t = el.getAttribute('data-speak');
    speakES(t);
  });
  // Nome: una sola volta (salvato su dispositivo)
  const modal = document.getElementById('nameModal');
  const nameInput = document.getElementById('nameInput');
  const saveBtn = document.getElementById('saveNameBtn');

  function applyNameUI(){
    const saved = getSavedName();
    const hello = document.getElementById('helloTitle');
    const sn = document.getElementById('studentName');
    if(hello){ hello.textContent = saved ? `Ciao ${saved} 👋` : 'Ciao 👋'; }
    if(sn){
      sn.value = saved;
      sn.disabled = true;
    }
    updateTargetUI();
  }

  function requireName(){
    const saved = getSavedName();
    if(saved) return;
    if(modal){
      modal.classList.remove('hidden');
      setTimeout(()=>{ try{ nameInput.focus(); }catch{} }, 0);
    }
  }

  if(saveBtn){
    saveBtn.addEventListener('click', ()=>{
      const v = (nameInput.value || '').trim();
      if(v.length < 2){ setToast('Inserisci un nome valido.'); return; }
      saveName(v);
      if(modal) modal.classList.add('hidden');
      applyNameUI();
      initRealtime();
    });
  }
  if(nameInput){
    nameInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){ e.preventDefault(); saveBtn?.click(); }
    });
  }
  $('startBtn').addEventListener('click', startQuiz);
  const tbtn = $('targetBtn');
  if(tbtn) tbtn.addEventListener('click', startTargetedQuiz);

  // profilo modal
  const closeP = document.getElementById('closeProfileBtn');
  if(closeP) closeP.addEventListener('click', closeProfileModal);
  const startP = document.getElementById('startTargetFromModal');
  if(startP) startP.addEventListener('click', startTargetedQuiz);
  $('resumeBtn').addEventListener('click', ()=>{
    const s = loadSession();
    if(!s || !s.quiz || !s.quiz.length){ setToast('Nessuna sessione da riprendere.'); return; }
    MODE = s.MODE || 'train';
    STUDENT = s.STUDENT || '';
    quiz = s.quiz;
    idx = clamp(s.idx || 0, 0, quiz.length-1);
    score = s.score || 0;
    answers = s.answers || [];
    show('quiz');
    renderQuestion();
  });

  $('nextBtn').addEventListener('click', next);
  $('prevBtn').addEventListener('click', ()=>{ if(idx>0 && MODE!=='test'){ idx-=1; renderQuestion(); saveSession(); } });
  $('skipBtn').addEventListener('click', ()=>{
    if(locked) return;
    // salto = risposta errata registrata (in verifica serve a completare)
    const q = quiz[idx];
    recordAnswer(false, q, null, q.type==='mcq' ? q.choices[q.answerIndex] : (q.type==='cloze'?q.answer:''));
    setToast('Saltata');
    $('nextBtn').disabled = false;
    locked = true;
    saveSession();
  });

  $('checkOpen').addEventListener('click', checkInput);
  $('openInput').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){ e.preventDefault(); checkInput(); }
  });

  $('showHint').addEventListener('click', ()=>{
    if(MODE==='test') return;
    const q = quiz[idx];
    $('openHint').textContent = q.hint || q.explain || '';
  });

  $('toggleIndex').addEventListener('click', ()=>{
    $('qIndex').classList.toggle('hidden');
  });

  $('copyCode').addEventListener('click', copyExportCode);
  $('exportPDF').addEventListener('click', exportReportHTML);
  $('backHome').addEventListener('click', ()=>show('home'));

  $('resetProgress').addEventListener('click', resetProgress);
  $('exportProgress').addEventListener('click', exportProgressJSON);

  // realtime class: nessun import/export da qui

  // install prompt (PWA)
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    $('installBtn').classList.remove('hidden');
  });
  $('installBtn').addEventListener('click', async ()=>{
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    try{ await deferredPrompt.userChoice; }catch{}
    deferredPrompt = null;
    $('installBtn').classList.add('hidden');
  });

  // initial render
  show('home');
  applyNameUI();
  requireName();
  initRealtime();

  // home widgets
  $('streakPill').textContent = `Streak: ${PROGRESS.streak || 0}`;
  $('skillsBars').innerHTML = renderSkillBars(PROGRESS.skills);
}

registerSW();
bind();

