import { STORAGE_KEY, MAX_BACKUP_BYTES, emptyState, createSession, setKey, sessionKey, sessionProgress, loadState, saveState, exportBackup, parseBackup, replaceFromBackup, summarize, validateState } from './state.js';

let response;
try { response = await fetch(new URL('./workout.json', import.meta.url)); }
catch (error) {
  document.getElementById('day-content').textContent = 'Não foi possível abrir a ficha. Recarregue a página quando estiver conectado.';
  throw error;
}
if (!response.ok) {
  document.getElementById('day-content').textContent = 'Não foi possível abrir a ficha. Recarregue a página quando estiver conectado.';
  throw new Error('Workout plan could not be loaded.');
}

const icon=(name,cls='')=>`<svg aria-hidden="true" class="${cls}"><use href="#i-${name}"/></svg>`;
const escapeHTML=(value)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const days=await response.json();
const mobility={
 wrist:{title:'Dobrar e estender o punho',area:'Punhos',dose:'5–8 repetições confortáveis',description:'Apoie o antebraço na coxa ou numa mesa e deixe a mão livre. Mova a mão devagar para cima e para baixo. Sem peso, sem puxar com a outra mão e sem forçar a amplitude. Pare se a dor aumentar.',video:'1Vpl8GkDjYY',source:'Medbridge',lang:'EN'},
 palm:{title:'Virar a palma da mão',area:'Punhos e antebraços',dose:'5–8 repetições por lado',description:'Mantenha o cotovelo junto ao corpo e dobrado a 90°. Vire a palma para cima e para baixo, sem inclinar o punho. Use apenas a amplitude confortável.',video:'ZY-OIuj8qOE',source:'Medbridge',lang:'EN'},
 thoracic:{title:'Rotação torácica sentada',area:'Costas',dose:'5 repetições por lado',description:'Sente num banco com os pés no chão e os braços cruzados no peito. Gire suavemente o peito para um lado e volte. Quadril e joelhos continuam apontados para a frente. Sem procurar estalos.',video:'Rh58FvMz5pY',source:'Rodrigo Marcondes · Fisioterapeuta',lang:'PT'},
 wall:{title:'Braços deslizando na parede',area:'Ombros',dose:'6–8 repetições lentas',description:'De frente para a parede, apoie levemente os antebraços sobre uma toalha. Deslize os braços para cima e volte, sem arquear a lombar. Se o apoio incomodar o punho, faça o movimento sem contato com a parede.',video:'LqWvJ_11zEs',source:'Foundations',lang:'EN'},
 ankle:{title:'Joelho à parede',area:'Tornozelos',dose:'6 repetições por lado',description:'Com um pé perto da parede, leve o joelho em direção a ela acompanhando os dedos do pé. O calcanhar permanece no chão. Vá e volte devagar, ajustando a distância para não sentir dor ou pinçamento.',video:'6RHy0sB-6Y0',source:'Treinador Rafael Alexandre',lang:'PT'},
 squat:{title:'Agachamento sem peso',area:'Quadris e joelhos',dose:'8 repetições controladas',description:'Agache numa amplitude confortável, mantendo os pés apoiados e os joelhos acompanhando sua direção. Suba com controle. É uma preparação leve, sem rebotes nem esforço alto.',video:'nVsWUtN7NXI',source:'Bodyweight Squat Tutorial',lang:'EN'},
 hinge:{title:'Dobrar o quadril, sem carga',area:'Quadris e posteriores',dose:'8 repetições controladas',description:'Em pé, deixe os joelhos levemente dobrados e leve o bumbum para trás enquanto inclina o tronco. Volte controladamente. O movimento vem do quadril; não tente alcançar o chão arredondando as costas.',video:'XNVp6nWH2m8',source:'Elevate Chiropractic and Rehab',lang:'EN'},
 lateral:{title:'Deslocamento lateral do quadril',area:'Parte interna das coxas',dose:'4 repetições por lado',description:'Afaste os pés e transfira o quadril lentamente para um lado, dobrando esse joelho e mantendo a outra perna mais estendida. Volte ao centro e alterne. Use amplitude pequena, sem buscar abertura máxima; apoie-se somente se confortável para o punho.',video:'TEG3EdvvZoU',source:'The Human Movement Institute',lang:'EN'},
 rotation:{title:'Rotação externa leve do ombro',area:'Ombros · antes do vôlei',dose:'8 repetições leves por lado',description:'Deixe o cotovelo junto ao corpo, dobrado a 90°, e gire o antebraço para fora. Pode usar um elástico bem leve se a pegada for indolor. Sem elástico, apenas ensaie o movimento; não é uma série de força.',video:'nUqMD_41gw8',source:'Medbridge',lang:'EN'}
};
const storage = { getItem: key => localStorage.getItem(key), setItem: (key,value) => localStorage.setItem(key,value), removeItem: key => localStorage.removeItem(key) };
const loaded = loadState(storage,days);
let saved = loaded.state;
let storageOK = loaded.available;
let automaticSaveBlocked = !loaded.available;
let drafts = {};
let activeDay=0; let activeStep='warm'; let theme=saved.preferences.theme; let toastHandle;
const dateKey=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const weekday=()=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',weekday:'short'}).format(new Date());
const todayIndex=['Mon','Tue','Wed','Thu','Fri'].indexOf(weekday());activeDay=todayIndex<0?0:todayIndex;
let visibleDate=dateKey();
const dateText=()=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'numeric',month:'long'}).format(new Date());
const hashDay=location.hash.match(/^#dia-([1-5])$/);if(hashDay)activeDay=Number(hashDay[1])-1;
function persist(){
  saved.updatedAt=new Date().toISOString();
  if(automaticSaveBlocked){storageOK=false;document.getElementById('storage-notice').hidden=false;notify('Dados apenas nesta página. Exporte um backup antes de sair.');return false;}
  try{saved=saveState(storage,saved);storageOK=true;document.getElementById('storage-notice').hidden=true;return true;}catch{storageOK=false;document.getElementById('storage-notice').hidden=false;notify('Não foi possível salvar no navegador. Baixe um backup para preservar as alterações.');return false;}
}
function marks(){const day=days[activeDay];const key=sessionKey(dateKey(),day.id);if(saved.sessions[key])return saved.sessions[key];if(!drafts[key])drafts[key]=createSession(dateKey(),day);return drafts[key];}
function currentDay(){const base=days[activeDay];const snapshot=marks();return {...base,title:snapshot.title,exercises:snapshot.exercises.map(exercise=>({...base.exercises.find(item=>item.id===exercise.id),rest:base.exercises.find(item=>item.id===exercise.id)?.rest||75,restLabel:base.exercises.find(item=>item.id===exercise.id)?.restLabel||'60–90 s',...exercise}))};}
function saveMarks(){const session=marks();session.updatedAt=new Date().toISOString();saved.sessions[sessionKey(session.date,session.dayId)]=session;persist();}
function applyTheme(){const dark=theme==='system'?matchMedia('(prefers-color-scheme: dark)').matches:theme!=='light';document.documentElement.dataset.theme=dark?'dark':'light';document.querySelector('meta[name="theme-color"]').content=dark?'#111413':'#f5f6f1';document.querySelectorAll('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===theme)));}
applyTheme();matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(theme==='system')applyTheme();});
function notify(message){const el=document.getElementById('toast');el.textContent=message;el.hidden=false;clearTimeout(toastHandle);toastHandle=setTimeout(()=>el.hidden=true,4000);}
function warmCard(id,index){const m=mobility[id];return `<details class="warm-card"><summary><span class="warm-index">${String(index+1).padStart(2,'0')}</span><span><span class="warm-title">${m.title}</span><span class="warm-dose">${m.dose}</span></span>${icon('chevron','warm-arrow')}</summary><div class="warm-body"><p>${m.description}</p><a class="video-link" href="https://www.youtube.com/watch?v=${m.video}" target="_blank" rel="noopener noreferrer" aria-label="Ver ${m.title} no YouTube, nova aba"><span class="play">${icon('play')}</span><span><strong>Ver demonstração</strong><small>YouTube · ${m.source} · ${m.lang}</small></span>${icon('external')}</a></div></details>`;}
function renderNav(){document.getElementById('weeknav').innerHTML=days.map((d,i)=>`<button class="day-button" data-day="${i}" aria-current="${activeDay===i}" aria-label="${d.day}, ${d.title}"><span class="day-short">${d.short}</span><span class="day-details"><span class="day-name">${d.day}</span><span class="day-area">${d.title}</span></span>${todayIndex===i?'<span class="today-dot" aria-hidden="true"></span>':''}</button>`).join('');}
function render(){renderNav();const d=currentDay();const s=marks();const total=d.exercises.reduce((n,e)=>n+e.sets,0);document.getElementById('topdate').textContent=dateText();document.getElementById('day-content').innerHTML=`
<header class="heading"><div><p class="eyebrow accent">${d.day}-feira · ${d.focus}</p><h1 id="day-heading" tabindex="-1">${escapeHTML(d.title)}</h1><p class="hero-note">${d.note}</p><div class="stats"><div class="stat"><strong>${d.time}</strong><span>minutos</span></div><div class="stat"><strong>${d.exercises.length}</strong><span>exercícios</span></div><div class="stat"><strong>${total}</strong><span>séries</span></div></div></div>${d.volley?'<span class="daybadge">Vôlei depois</span>':''}</header>
<div class="progress-box"><div class="progress-top"><span class="progress-text" id="progress-text"></span><span class="percent" id="percent">0%</span></div><div class="track" role="progressbar" aria-label="Séries concluídas" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="0"><div class="track-fill" id="track-fill"></div></div></div>
<div class="step-tabs" role="tablist" aria-label="Etapa do treino"><button class="step-tab" id="tab-warm" role="tab" aria-controls="warm-section" data-step="warm"><span>01</span>Aquecer</button><button class="step-tab" id="tab-train" role="tab" aria-controls="train-section" data-step="train"><span>02</span>Treinar</button></div>
<div class="sections"><section id="warm-section" aria-labelledby="warm-title"><div class="section-head"><div class="section-title"><span class="section-number">01</span><h2 id="warm-title">Aquecimento</h2></div><span class="small muted">${d.warmTime} min</span></div><p class="section-sub">Mobilidade leve, depois as séries com peso.</p><div class="preparation">${icon('clock')}<div><strong>Comece com 2 minutos</strong><p>Bicicleta ou caminhada leve. Depois, uma rodada dos movimentos abaixo.</p></div></div><div class="warm-list">${d.warm.map(warmCard).join('')}</div><p class="warm-footer">${d.prep} As séries preparatórias não contam no volume do treino.</p><button class="wide-button warm-done" id="go-train">${s.warm?'Voltar ao treino':'Aquecimento feito · ir treinar'}${icon('arrow')}</button>
${d.volley?`<details class="extra"><summary>Antes do vôlei${icon('chevron')}</summary><div class="extra-body"><p>Na quadra, reserve 8–10 minutos para uma progressão específica.</p><ol><li>Trote leve e deslocamentos laterais, aumentando a velocidade.</li><li>Agachamentos e panturrilhas sem carga; depois saltos baixos com aterrissagens controladas.</li><li>Movimentos confortáveis dos braços e rotações externas leves.</li><li>Contatos com bola, saques e ataques leves, avançando gradualmente.</li></ol>${warmCard('rotation',0)}<p class="warm-footer">Se os contatos provocarem dor no punho, ajuste ou interrompa. A academia não substitui essa preparação.</p></div></details>`:''}
<div class="notice">Punhos: movimente sem forçar. Dor que aumenta pede ajuste ou interrupção. <button class="text-button" data-settings>Ver cuidados</button></div></section>
<section id="train-section" aria-labelledby="train-title"><div class="section-head"><div class="section-title"><span class="section-number">02</span><h2 id="train-title">Seu treino</h2></div><span class="small muted" id="exercise-count"></span></div><p class="section-sub">Toque em cada série quando terminar.</p><div class="exercise-list">${d.exercises.map((e,i)=>`<article class="exercise" id="exercise-${i}"><div class="exercise-top"><span class="exercise-num">${String(i+1).padStart(2,'0')}</span><h3>${escapeHTML(e.name)}</h3><span class="done-tag">Concluído</span></div><div class="exercise-metrics"><span><strong>${e.sets}</strong> séries</span><span class="metric-divider">/</span><span><strong>${escapeHTML(e.reps.split(" por ")[0])}</strong> reps${e.reps.includes(" por ")?" por "+escapeHTML(e.reps.split(" por ")[1]):""}</span><span class="metric-divider">/</span><button class="rest-link" data-rest="${e.rest}" aria-label="Iniciar descanso de ${e.restLabel}, ${escapeHTML(e.name)}">${icon('clock')}${e.restLabel}</button></div><div class="sets" role="group" aria-label="Séries de ${escapeHTML(e.name)}">${Array.from({length:e.sets},(_,j)=>`<button class="set-button" data-ex="${i}" data-set="${j}" aria-pressed="${!!s.sets?.[setKey(e,j)]}" aria-label="${escapeHTML(e.name)}, série ${j+1}"><span class="set-box">${icon('check')}</span>Série ${j+1}</button>`).join('')}</div>${e.note?`<p class="exercise-note">${escapeHTML(e.note)}</p>`:''}</article>`).join('')}</div><button class="wide-button finish" id="finish">Finalizar treino${icon('check')}</button><p class="finish-help" id="finish-help"></p><div class="notice">${d.effort}</div></section></div>`;updateProgress();showStep(activeStep,false);}
function updateProgress(){const d=currentDay();const s=marks();let done=0,completeExercises=0,total=0;d.exercises.forEach((e,i)=>{let count=0;for(let j=0;j<e.sets;j++){total++;const checked=!!s.sets?.[setKey(e,j)];if(checked){count++;done++;}const b=document.querySelector(`[data-ex="${i}"][data-set="${j}"]`);if(b)b.setAttribute('aria-pressed',String(checked));}const complete=count===e.sets;if(complete)completeExercises++;document.getElementById('exercise-'+i)?.classList.toggle('is-done',complete);});const pct=Math.round(done/total*100);document.getElementById('progress-text').innerHTML=`<strong>${done} de ${total} séries</strong> · ${completeExercises} de ${d.exercises.length} exercícios`;document.getElementById('percent').textContent=pct+'%';document.getElementById('track-fill').style.width=pct+'%';document.querySelector('[role=progressbar]').setAttribute('aria-valuenow',done);document.getElementById('exercise-count').textContent=completeExercises+'/'+d.exercises.length;const f=document.getElementById('finish');f.disabled=done<total||s.finished;f.innerHTML=(s.finished?'Treino concluído':done===total?'Finalizar treino':'Marque as séries para finalizar')+icon('check');document.getElementById('finish-help').textContent=s.finished?'Concluído em '+dateText()+'. Bom descanso!':(storageOK?'Sessão salva neste navegador. Histórico preservado.':'Alterações apenas nesta página. Baixe um backup antes de sair.');}
function showStep(step,scroll){activeStep=step;document.getElementById('warm-section').classList.toggle('mobile-hidden',step!=='warm');document.getElementById('train-section').classList.toggle('mobile-hidden',step!=='train');document.querySelectorAll('[data-step]').forEach(b=>{const selected=b.dataset.step===step;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});if(scroll&&matchMedia('(max-width: 900px)').matches)document.querySelector('.step-tabs').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
let timerEnd=0,timerRemaining=0,timerRunning=false;const timerBar=document.getElementById('timer-bar');
function paintTimer(){const seconds=timerRunning?Math.max(0,Math.ceil((timerEnd-Date.now())/1000)):timerRemaining;document.getElementById('timer-time').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');if(timerRunning&&seconds===0){timerRunning=false;timerRemaining=0;document.getElementById('timer-label').textContent='Descanso concluído';document.getElementById('timer-toggle').textContent='Repetir';notify('Descanso concluído. Próxima série quando estiver pronto.');}}
let timerPreset=120;
function startTimer(seconds){timerPreset=seconds;timerRemaining=seconds;timerRunning=true;timerEnd=Date.now()+seconds*1000;timerBar.hidden=false;document.getElementById('timer-label').textContent='Descanso';document.getElementById('timer-toggle').textContent='Pausar';paintTimer();}
setInterval(paintTimer,250);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){paintTimer();if(dateKey()!==visibleDate){visibleDate=dateKey();drafts={};render();}}});
document.addEventListener('click',event=>{const target=event.target.closest('button');if(!target)return;if(target.dataset.day!==undefined){activeDay=Number(target.dataset.day);activeStep=marks().warm?'train':'warm';history.replaceState(null,'','#dia-'+(activeDay+1));render();window.scrollTo({top:0,behavior:'instant'});}else if(target.dataset.step){showStep(target.dataset.step,true);}else if(target.dataset.ex!==undefined){const s=marks();if(!s.sets)s.sets={};const key=setKey(currentDay().exercises[Number(target.dataset.ex)],Number(target.dataset.set));s.sets[key]=!s.sets[key];s.finished=false;saveMarks();updateProgress();}else if(target.dataset.rest){startTimer(Number(target.dataset.rest));}else if(target.hasAttribute('data-settings')){refreshSettings();document.getElementById('settings').showModal();}else if(target.dataset.closeDialog){document.getElementById(target.dataset.closeDialog).close();}else if(target.dataset.themeChoice){theme=target.dataset.themeChoice;saved.preferences.theme=theme;persist();applyTheme();}});
document.addEventListener('keydown',event=>{const tab=event.target.closest('[data-step]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const step=event.key==='Home'?'warm':event.key==='End'?'train':activeStep==='warm'?'train':'warm';showStep(step,false);document.getElementById('tab-'+step).focus();});
document.getElementById('day-content').addEventListener('click',event=>{if(event.target.closest('#go-train')){marks().warm=true;saveMarks();showStep('train',true);}if(event.target.closest('#finish')&&!document.getElementById('finish').disabled){marks().finished=true;saveMarks();updateProgress();notify('Treino concluído. Bom descanso!');}});
document.getElementById('reset-day').addEventListener('click',()=>document.getElementById('reset-dialog').showModal());document.getElementById('confirm-reset').addEventListener('click',()=>{delete saved.sessions[sessionKey(dateKey(),days[activeDay].id)];delete drafts[sessionKey(dateKey(),days[activeDay].id)];persist();document.getElementById('reset-dialog').close();render();notify('Marcações deste treino reiniciadas.');});
document.getElementById('timer-toggle').addEventListener('click',()=>{if(timerRunning){timerRemaining=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));timerRunning=false;document.getElementById('timer-toggle').textContent='Continuar';}else if(timerRemaining>0){timerEnd=Date.now()+timerRemaining*1000;timerRunning=true;document.getElementById('timer-toggle').textContent='Pausar';}else startTimer(timerPreset);paintTimer();});document.getElementById('timer-add').addEventListener('click',()=>{if(timerRunning)timerEnd+=30000;else{timerRemaining+=30;document.getElementById('timer-label').textContent='Descanso';document.getElementById('timer-toggle').textContent='Continuar';}paintTimer();});document.getElementById('timer-close').addEventListener('click',()=>{timerRunning=false;timerRemaining=0;timerBar.hidden=true;});
window.addEventListener('hashchange',()=>{const m=location.hash.match(/^#dia-([1-5])$/);if(m){activeDay=Number(m[1])-1;activeStep='warm';render();}});
activeStep=marks().warm?'train':'warm';
render();


function shortDate(value){return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));}
function summaryText(state){const info=summarize(state);return `${info.sessions} sessões · ${info.finished} finalizadas · ${info.completedSets} séries marcadas${info.firstDate?' · '+shortDate(info.firstDate)+' a '+shortDate(info.lastDate):''}`;}
function refreshSettings(){
  const info=summarize(saved);
  document.getElementById('data-summary').textContent=summaryText(saved);
  document.getElementById('storage-summary').textContent=(storageOK?'Salvamento local ativo':'Salvamento local indisponível')+' · '+Math.ceil(info.bytes/1024)+' KB de dados';
  const history=document.getElementById('session-history');
  const sessions=Object.values(saved.sessions).sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt));
  history.innerHTML=sessions.length?sessions.slice(0,20).map(session=>{const progress=sessionProgress(session);return `<li><span><strong>${escapeHTML(session.title)}</strong><small>${shortDate(session.date)}</small></span><span>${session.finished?'Finalizado':progress.completed+'/'+progress.total+' séries'}</span></li>`;}).join(''):'<li>Nenhuma sessão registrada ainda.</li>';
  document.getElementById('history-count').textContent=sessions.length>20?'20 sessões mais recentes de '+sessions.length:'Sessões registradas';
}
function downloadState(){
  try{
    const blob=new Blob([exportBackup(saved)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='workout-backup-'+dateKey()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    notify('Backup JSON preparado para download.');
  }catch(error){notify('Falha ao exportar: '+error.message);}
}
let pendingImport=null;
let pendingBase=null;
const input=document.getElementById('import-file');
for(const button of document.querySelectorAll('[data-export]'))button.addEventListener('click',downloadState);
document.getElementById('choose-import').addEventListener('click',()=>input.click());
input.addEventListener('change',async()=>{
  const file=input.files?.[0];input.value='';if(!file)return;
  const errorBox=document.getElementById('import-error');errorBox.hidden=true;
  try{
    if(file.size>MAX_BACKUP_BYTES)throw new Error('O arquivo excede o limite de 5 MB.');
    const text=await file.text();const parsed=parseBackup(text);
    pendingImport=text;pendingBase=JSON.stringify(saved);
    document.getElementById('import-name').textContent=file.name;
    document.getElementById('import-summary').textContent=summaryText(parsed.state);
    document.getElementById('current-summary').textContent=summaryText(saved);
    document.getElementById('confirm-import').disabled=false;
    document.getElementById('import-preview').showModal();
  }catch(error){pendingImport=null;errorBox.textContent=error.message;errorBox.hidden=false;}
});
document.getElementById('confirm-import').addEventListener('click',()=>{
  if(!pendingImport)return;
  const errorBox=document.getElementById('preview-error');errorBox.hidden=true;
  try{
    if(JSON.stringify(saved)!==pendingBase)throw new Error('Os dados locais mudaram durante a revisão. Cancele e selecione o backup novamente.');
    const next=replaceFromBackup(storage,pendingImport);
    saved=next;drafts={};theme=saved.preferences.theme;storageOK=true;automaticSaveBlocked=false;document.getElementById('storage-notice').hidden=true;
    document.getElementById('import-preview').close();pendingImport=null;document.getElementById('settings').close();applyTheme();activeStep=marks().warm?'train':'warm';render();notify('Backup importado. Dados locais substituídos.');
  }catch(error){errorBox.textContent='Importação não aplicada: '+error.message;errorBox.hidden=false;}
});
document.getElementById('import-preview').addEventListener('close',()=>{pendingImport=null;pendingBase=null;document.getElementById('preview-error').hidden=true;});
document.getElementById('clear-data').addEventListener('click',()=>document.getElementById('clear-preview').showModal());
document.getElementById('confirm-clear').addEventListener('click',()=>{
  try{
    const next=emptyState();next.preferences.theme=theme;saveState(storage,next);
    saved=next;drafts={};storageOK=true;automaticSaveBlocked=false;document.getElementById('storage-notice').hidden=true;
    try{storage.removeItem('marco-workout-v1');}catch{}
    document.getElementById('clear-preview').close();refreshSettings();render();notify('Sessões locais apagadas. Tema preservado.');
  }catch(error){document.getElementById('clear-error').textContent='Não foi possível apagar: '+error.message;document.getElementById('clear-error').hidden=false;}
});
document.getElementById('protect-storage').addEventListener('click',async()=>{
  const status=document.getElementById('persistence-status');
  if(!navigator.storage?.persist){status.textContent='Este navegador não oferece solicitação de armazenamento persistente. Mantenha seus backups.';return;}
  try{const granted=await navigator.storage.persist();status.textContent=granted?'Armazenamento persistente concedido. A limpeza manual dos dados ainda os apaga; mantenha seus backups.':'O navegador não concedeu armazenamento persistente. Seus dados continuam locais; mantenha seus backups.';}catch{status.textContent='Não foi possível solicitar persistência. Mantenha seus backups.';}
});
window.addEventListener('storage',event=>{
  if(event.key!==STORAGE_KEY)return;
  try{saved=event.newValue===null?emptyState():validateState(JSON.parse(event.newValue));drafts={};theme=saved.preferences.theme;storageOK=true;automaticSaveBlocked=false;applyTheme();render();if(document.getElementById('settings').open)refreshSettings();notify('Dados atualizados por outra aba deste navegador.');}catch{notify('Outra aba gravou dados incompatíveis. Exporte seu estado atual antes de recarregar.');}
});
let refreshing=false;
let waitingWorker=null;
const pwaStatus=document.getElementById('pwa-status');
if('serviceWorker' in navigator && ['https:','http:'].includes(location.protocol)){
  navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(registration=>{
    pwaStatus.textContent=registration.active?'Offline disponível após o primeiro carregamento. Vídeos precisam de internet.':'Preparando a ficha para uso offline…';
    function offerUpdate(){waitingWorker=registration.waiting;document.getElementById('update-app').hidden=!waitingWorker;}
    offerUpdate();registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){if(navigator.serviceWorker.controller)offerUpdate();else pwaStatus.textContent='Ficha disponível offline. Vídeos precisam de internet.';}});});
  }).catch(()=>{pwaStatus.textContent='Não foi possível ativar o modo offline. Reabra quando estiver conectado.';});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshing)location.reload();});
}else pwaStatus.textContent='Abra por HTTPS ou localhost para ativar a PWA e o modo offline.';
document.getElementById('update-app').addEventListener('click',()=>{if(!waitingWorker)return;if(!persist())return;refreshing=true;waitingWorker.postMessage({type:'SKIP_WAITING'});});
if(!storageOK){document.getElementById('storage-notice').hidden=false;notify('Armazenamento indisponível ou dados inválidos. Exporte as alterações antes de fechar.');}
if(loaded.migrated)notify('Marcações da versão anterior recuperadas neste navegador.');
