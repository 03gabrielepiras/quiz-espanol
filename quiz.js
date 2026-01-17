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

function mcq({skill, prompt, choices, answerIndex, explain, meta}){
  return { id:qId('m'), type:'mcq', skill, prompt, choices, answerIndex, explain, meta: meta||{} };
}
function open({skill, prompt, hint, validate, meta}){
  return { id:qId('o'), type:'open', skill, prompt, hint, validate, meta: meta||{} };
}
function cloze({skill, prompt, answer, hint, meta}){
  return { id:qId('c'), type:'cloze', skill, prompt, answer, hint, meta: meta||{} };
}

function buildA_present(){
  const v = pick(VERBS.filter(x => ['ar','er','ir','ue','ie','i','go','irreg','refl'].includes(x.type) && x.inf !== 'haber'));
  const subj = pick(['Yo','Tú','Nosotros','Ella','Él']);

  // simple conjugation for Yo only (teach gradually) - for others we use MCQ with provided correct form
  if(subj === 'Yo'){
    const correct = v.yo;
    return cloze({
      skill:'Presente (verbi)',
      prompt:`${subj} ___ (${v.inf}).`,
      answer: correct,
      hint:`Verbo: (${v.inf}) = ${v.it}. Forma Yo: ${correct}.`,
      meta:{ verb:v.inf }
    });
  }

  // For non-Yo: keep safe with a small set (ser/estar/tener/ir) + regular patterns
  const safe = ['ser','estar','tener','ir','hacer','poner','salir','traer','conocer','decir','pedir','poder','querer','vivir','comer','trabajar','estudiar'];
  const vv = pick(VERBS.filter(x=>safe.includes(x.inf)));
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
    meta:{ verb: vv.inf }
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
    meta:{ verb:'gustar' }
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
function buildQuestion(){
  const roll = randInt(100);
  if(roll < 28) return buildA_present();
  if(roll < 48) return buildB_serEstar();
  if(roll < 70) return buildC_hayEsta();
  if(roll < 80) return buildGustar();
  if(roll < 90) return buildMuyMucho();
  return buildRoutine();
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
let TEACHER = loadJSON(STORAGE.teacher, { roster: [] });

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

function setToast(text){
  const t = $('toast');
  if(!t) return;
  t.innerHTML = text;
  t.classList.remove('hidden');
  clearTimeout(setToast._t);
  setToast._t = setTimeout(()=>t.classList.add('hidden'), 2400);
}

function setProgressBar(){
  const pct = (idx / quiz.length) * 100;
  $('bar').style.width = `${pct}%`;
  $('qCounter').textContent = `${idx+1}/${quiz.length}`;
  $('scorePill').textContent = `Punti: ${score}`;
}

function showHint(text){
  const el = $('hintBox');
  if(MODE === 'test'){
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.classList.remove('hidden');
  el.textContent = text || '';
}

function setPostit(q){
  if(MODE === 'test'){
    $('postit').classList.add('hidden');
    return;
  }
  $('postit').classList.remove('hidden');
  const map = {
    'Presente (verbi)': 'Presente: soggetto + verbo coniugato. Qui alleniamo soprattutto la forma (Yo) e le irregolarità principali.',
    'Ser/Estar': 'SER: identità, professione, caratteristiche. ESTAR: luogo e stato momentaneo.',
    'Hay/Está + Casa': "HAY = c'è/ci sono (esistenza). ESTÁ/ESTÁN = dove si trova qualcosa.",
    'Gustar + pronombre': 'GUSTAR: me/te/le/nos… + gusta (singolare) / gustan (plurale).',
    'Muy / Mucho': 'MUY + aggettivo (muy grande). MUCHO concorda: mucho/mucha/muchos/muchas.',
    'Routine + Riflessivi': 'Riflessivi: me/te/se + verbo (me levanto, me ducho). Avverbi: siempre, a veces, nunca…'
  };
  $('postitText').textContent = map[q.skill] || '';
}

function renderQuestion(){
  locked = false;
  $('nextBtn').disabled = true;
  $('feedback').innerHTML = '';
  $('answerBox').value = '';

  const q = quiz[idx];
  $('qText').textContent = q.prompt;
  $('skillTag').textContent = q.skill;
  setPostit(q);
  setProgressBar();

  // clear areas
  $('mcq').innerHTML = '';
  $('mcqWrap').classList.add('hidden');
  $('openWrap').classList.add('hidden');
  $('clozeWrap').classList.add('hidden');

  if(q.type === 'mcq'){
    $('mcqWrap').classList.remove('hidden');
    const choices = q.choices;
    // determine answer index if not set (for routine mcq we included a list with correct form present)
    let ansIndex = q.answerIndex;
    if(ansIndex === undefined){
      const correct = q.meta?.verb ? (VERBS.find(v=>v.inf===q.meta.verb)?.yo || '') : '';
      ansIndex = choices.map(norm).indexOf(norm(correct));
      if(ansIndex < 0) ansIndex = 0;
      q.answerIndex = ansIndex;
    }
    choices.forEach((c, i)=>{
      const b = document.createElement('button');
      b.className = 'choice';
      b.type = 'button';
      b.textContent = c;
      b.addEventListener('click', ()=>chooseMCQ(i));
      $('mcq').appendChild(b);
    });
    showHint(q.explain);
  } else if(q.type === 'cloze'){
    $('clozeWrap').classList.remove('hidden');
    $('clozePrompt').textContent = q.prompt;
    showHint(q.hint);
  } else {
    $('openWrap').classList.remove('hidden');
    $('openPrompt').textContent = q.prompt;
    showHint(q.hint);
  }
}

function setFeedback(ok, msg, correct){
  if(ok){
    $('feedback').innerHTML = `✅ <strong>Ben fatto</strong> — ${escapeHtml(msg || 'Corretto.')}`;
  } else {
    const extra = correct ? `<div class="muted" style="margin-top:6px">Corretto: <strong>${escapeHtml(correct)}</strong></div>` : '';
    $('feedback').innerHTML = `❌ <strong>Quasi</strong> — ${escapeHtml(msg || 'Riprova con la regola.')}${extra}`;
  }
}

function escapeHtml(s){
  return (s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
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
  if(MODE === 'train') setFeedback(ok, q.explain, q.choices[correctIdx]);

  $('nextBtn').disabled = false;
}

function checkCloze(){
  if(locked) return;
  locked = true;

  const q = quiz[idx];
  const user = $('answerBox').value;
  const ok = norm(user) === norm(q.answer);
  if(ok) score += 1;

  recordAnswer(ok, q, user, q.answer);
  if(MODE === 'train') setFeedback(ok, ok ? 'Risposta corretta.' : q.hint, q.answer);

  $('nextBtn').disabled = false;
}

function checkOpen(){
  if(locked) return;
  locked = true;

  const q = quiz[idx];
  const user = $('answerBox').value;
  const res = q.validate(user);
  if(res.ok) score += 1;

  recordAnswer(res.ok, q, user, res.correct);
  if(MODE === 'train') setFeedback(res.ok, res.msg, res.correct);

  $('nextBtn').disabled = false;
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
  // save history
  const total = quiz.length;
  const pct = Math.round((score/total)*100);
  const ts = nowISO();

  const skillBreakdown = {};
  answers.forEach(a=>{
    skillBreakdown[a.skill] ||= {seen:0, correct:0};
    skillBreakdown[a.skill].seen += 1;
    if(a.ok) skillBreakdown[a.skill].correct += 1;
  });

  const result = {
    student: STUDENT || 'Studente',
    mode: MODE,
    score,
    total,
    pct,
    skillBreakdown,
    timestamp: ts
  };

  HISTORY.unshift(result);
  HISTORY = HISTORY.slice(0, 60);
  saveJSON(STORAGE.history, HISTORY);

  // update progress last10
  PROGRESS.last10.unshift({ts, score, total});
  PROGRESS.last10 = PROGRESS.last10.slice(0,10);
  saveJSON(STORAGE.progress, PROGRESS);

  // render
  $('resultTitle').textContent = MODE === 'test' ? 'Risultato (Verifica)' : 'Risultato (Allenamento)';
  $('resultScore').textContent = `${score}/${total} (${pct}%)`;
  $('resultNote').textContent = pct >= 90 ? 'Ottimo!' : pct >= 75 ? 'Molto bene.' : pct >= 60 ? 'Bene, continua.' : 'Da ripassare: fai un’altra verifica.';

  // build export code
  $('exportCode').value = encodeCode(result);

  // breakdown list
  const items = Object.entries(skillBreakdown)
    .map(([k,v])=>{
      const p = Math.round((v.correct/v.seen)*100);
      return `<div class="row"><div class="muted">${escapeHtml(k)}</div><div><strong>${p}%</strong> <span class="small">(${v.correct}/${v.seen})</span></div></div>`;
    }).join('');
  $('breakdown').innerHTML = items || '<div class="muted">—</div>';

  show('result');
}

/* -------------------- Dashboard -------------------- */
function renderDashboard(){
  const p = PROGRESS;
  $('dashAttempts').textContent = String(p.totals.attempts);
  $('dashCorrect').textContent = String(p.totals.correct);
  const acc = p.totals.attempts ? Math.round((p.totals.correct/p.totals.attempts)*100) : 0;
  $('dashAcc').textContent = `${acc}%`;
  $('dashBest').textContent = String(p.totals.streakBest);

  // skills
  const skills = Object.entries(p.skills)
    .sort((a,b)=> (b[1].correct/b[1].seen) - (a[1].correct/a[1].seen))
    .slice(0, 12)
    .map(([k,v])=>{
      const pr = v.seen ? Math.round((v.correct/v.seen)*100) : 0;
      return `<div class="skill"><div class="skill__name">${escapeHtml(k)}</div><div class="skill__bar"><div class="skill__fill" style="width:${pr}%"></div></div><div class="small">${pr}% • ${v.correct}/${v.seen}</div></div>`;
    }).join('');
  $('skillsGrid').innerHTML = skills || '<div class="muted">Fai una verifica per vedere i progressi.</div>';

  // verbs
  const verbs = Object.entries(p.verbs)
    .map(([inf,v])=>({inf,...v, pct: v.seen ? (v.correct/v.seen) : 0}))
    .sort((a,b)=>b.seen - a.seen)
    .slice(0, 14)
    .map(v=>{
      const pct2 = Math.round(v.pct*100);
      const it = (VERBS.find(x=>x.inf===v.inf)?.it) || '';
      return `<div class="verb"><div><strong>${escapeHtml(v.inf)}</strong> <span class="small">(${escapeHtml(it)})</span></div><div class="small">${pct2}% • ${v.correct}/${v.seen}</div></div>`;
    }).join('');
  $('verbsGrid').innerHTML = verbs || '<div class="muted">—</div>';

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
function renderTeacher(){
  const list = TEACHER.roster || [];
  const rows = list
    .sort((a,b)=> (b.pct - a.pct) || (b.timestamp.localeCompare(a.timestamp)))
    .map((r,i)=>{
      const when = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';
      return `<tr><td>${i+1}</td><td>${escapeHtml(r.student||'Studente')}</td><td>${escapeHtml(r.mode||'')}</td><td><strong>${r.score}/${r.total}</strong> (${r.pct}%)</td><td class="small">${escapeHtml(when)}</td></tr>`;
    }).join('');
  $('teacherTableBody').innerHTML = rows || `<tr><td colspan="5" class="muted">Nessun risultato importato. Incolla un codice e premi Importa.</td></tr>`;
  show('teacher');
}

function importTeacherCode(){
  const raw = $('teacherInput').value.trim();
  if(!raw) return;
  try{
    const obj = decodeCode(raw);
    if(!obj || typeof obj !== 'object' || obj.total == null) throw new Error('Formato non valido');
    TEACHER.roster ||= [];
    TEACHER.roster.unshift(obj);
    TEACHER.roster = TEACHER.roster.slice(0, 200);
    saveJSON(STORAGE.teacher, TEACHER);
    $('teacherInput').value = '';
    setToast('Risultato importato.');
    renderTeacher();
  }catch(e){
    alert('Codice non valido. Assicurati di copiare tutto il codice (senza spazi).');
  }
}

function exportTeacherCSV(){
  const list = TEACHER.roster || [];
  if(!list.length){
    alert('Non ci sono risultati da esportare.');
    return;
  }
  const header = ['student','mode','score','total','pct','timestamp'];
  const rows = [header.join(',')].concat(list.map(r=>[
    safeCSV(r.student), safeCSV(r.mode), r.score, r.total, r.pct, safeCSV(r.timestamp)
  ].join(',')));

  const blob = new Blob([rows.join('\n')], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'risultati-classe.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeCSV(v){
  const s = String(v ?? '');
  if(/[\n\r,"]/.test(s)) return '"' + s.replaceAll('"','""') + '"';
  return s;
}

function clearTeacher(){
  if(!confirm('Vuoi cancellare tutti i risultati importati (solo su questo dispositivo)?')) return;
  TEACHER = { roster: [] };
  saveJSON(STORAGE.teacher, TEACHER);
  setToast('Risultati classe cancellati.');
  renderTeacher();
}

/* -------------------- App start / events -------------------- */
function startQuiz(){
  MODE = $('mode').value;
  STUDENT = ($('studentName').value || '').trim();
  const count = clamp(parseInt($('count').value || '38', 10), 10, 60);

  quiz = buildQuiz(count);
  idx = 0;
  score = 0;
  answers = [];

  $('quizModePill').textContent = MODE === 'test' ? 'Verifica' : 'Allenamento';
  show('quiz');
  renderQuestion();
}

function copyExportCode(){
  const el = $('exportCode');
  el.select();
  el.setSelectionRange(0, 999999);
  document.execCommand('copy');
  setToast('Codice copiato.');
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
  $('startBtn').addEventListener('click', startQuiz);
  $('nextBtn').addEventListener('click', next);
  $('quitBtn').addEventListener('click', ()=>show('home'));

  $('checkBtn').addEventListener('click', ()=>{
    const q = quiz[idx];
    if(q.type === 'cloze') checkCloze();
    else checkOpen();
  });

  $('answerBox').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      const q = quiz[idx];
      if(q.type === 'cloze') checkCloze();
      else if(q.type === 'open') checkOpen();
    }
  });

  $('backHomeBtn').addEventListener('click', ()=>show('home'));
  $('copyCodeBtn').addEventListener('click', copyExportCode);

  $('dashResetBtn').addEventListener('click', resetProgress);

  $('teacherImportBtn').addEventListener('click', importTeacherCode);
  $('teacherCSVBtn').addEventListener('click', exportTeacherCSV);
  $('teacherClearBtn').addEventListener('click', clearTeacher);

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
  $('count').value = 38;
  $('mode').value = 'train';
  show('home');

  // quick stats on home
  const acc = PROGRESS.totals.attempts ? Math.round((PROGRESS.totals.correct/PROGRESS.totals.attempts)*100) : 0;
  $('homeMini').textContent = `Progressi su questo dispositivo: ${acc}% • tentativi: ${PROGRESS.totals.attempts} • streak best: ${PROGRESS.totals.streakBest}`;
}

registerSW();
bind();

