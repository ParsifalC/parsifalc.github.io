import { profile, categories, projects, featuredProjects, getProject } from './content.js';
import { projectArt } from './art.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const panel = $('#panel');
const content = $('#panel-content');
const canvas = $('#world');
const mediaMotion = matchMedia('(prefers-reduced-motion: reduce)');
const coarsePointer = matchMedia('(pointer: coarse)');
const settings = (() => { try { const saved=JSON.parse(localStorage.getItem('construct-settings')||'{}'); return {quality:['low','balanced','high'].includes(saved.quality)?saved.quality:'balanced',motion:['auto','reduced'].includes(saved.motion)?saved.motion:'auto'}; } catch { return {quality:'balanced',motion:'auto'}; } })();
let world = null, explored = false, failed = false, nearest = null, filter = 'all', query = '', toastTimer;
let lastFocus = null, sound = null, soundOn = false;
const accessLabels = {open:'开源作品',private:'独立项目 · 源码未公开',community:'社区贡献'};
const category = id => categories.find(c=>c.id===id);
const reduced = () => settings.motion==='reduced'||mediaMotion.matches;
const saveSettings = () => { try { localStorage.setItem('construct-settings',JSON.stringify(settings)); } catch { /* Browsing remains available when storage is disabled. */ } };

function toast(message){const t=$('#toast');t.textContent=message;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true;},3200);}
function announce(message){$('#announcer').textContent=message;}
function externalLink(link){const url=new URL(link.url);if(url.protocol!=='https:')return '';return '<a class="outline-button" href="'+escape(url.href)+'" target="_blank" rel="noopener noreferrer">'+escape(link.label)+'<span aria-hidden="true">↗</span></a>';}
function applyMotion(){document.body.classList.toggle('reduced-motion',reduced());world?.setReducedMotion(reduced());}
applyMotion();mediaMotion.addEventListener('change',applyMotion);

function navigate(hash){
  if(location.hash==='#'+hash){route();return;}
  if(!panel.open)lastFocus=document.activeElement;
  history.pushState({constructPanel:true},'', '#'+hash);route();
}
function clearPanel(replace=false){
  if(!panel.open&&!location.hash)return;
  history.replaceState(null,'',location.pathname+location.search);route();
}
function setExploring(value){
  explored=value;document.body.classList.toggle('exploring',value);
  $('#intro').inert=value;
  $('#crosshair').hidden=!value||failed;
  $('#touch-controls').hidden=!value||failed||!(coarsePointer.matches||innerWidth<=760);
  $('#explore-hint').hidden=!value||failed;
  if(!value){$('#focus-exhibit').hidden=true;$('#location-label').textContent='00 / ARRIVAL';}
}
function enter(){if(failed){navigate('index');return;}if(!world){toast('空间正在准备，也可以先浏览作品。');return;}setExploring(true);world.start();canvas.focus({preventScroll:true});announce('已进入展馆。拖动观察，使用方向键移动，或点击展台。');}
function travelTo(id){if(!getProject(id))return;if(failed){navigate('project/'+id);return;}clearPanel(true);if(!world){navigate('project/'+id);return;}setExploring(true);world.goTo(id);canvas.focus({preventScroll:true});announce('正在前往 '+getProject(id).title+' 展台。');}
function goHome(){clearPanel(true);setExploring(false);world?.home();$('#enter-button').focus({preventScroll:true});}

function renderProject(project){
  panel.className='project-panel';$('#panel-path').textContent='EXHIBIT / '+project.number;
  const featured=featuredProjects.findIndex(p=>p.id===project.id);
  const next=featured>=0?featuredProjects[(featured+1)%featuredProjects.length]:projects[(projects.indexOf(project)+1)%projects.length];
  const art=projectArt(project);
  content.innerHTML='<button class="back-text" data-action="index">← 全部作品</button>'+
    '<div class="panel-kicker">'+escape(category(project.category)?.en||'PROJECT')+' / '+project.number+'</div>'+
    '<h2 id="panel-title" tabindex="-1">'+escape(project.title)+'</h2><p class="panel-lead">'+escape(project.summary)+'</p>'+
    '<div class="project-category"><span>'+escape(project.kicker)+' / '+escape(project.year)+'</span><span class="status-tag '+project.access+'">'+accessLabels[project.access]+'</span></div>'+art+
    '<p class="project-description">'+escape(project.description)+'</p><div class="tech-list">'+project.tech.map(t=>'<span>'+escape(t)+'</span>').join('')+'</div>'+
    '<div class="detail-highlights">'+project.highlights.map((h,i)=>'<div class="detail-highlight"><span class="highlight-num">0'+(i+1)+'</span><div><h3>'+escape(h.title)+'</h3><p>'+escape(h.text)+'</p></div></div>').join('')+'</div>'+
    '<p class="project-role">'+escape(project.role)+'</p><div class="project-links">'+project.links.map(externalLink).join('')+(featured>=0&&!failed?'<button class="outline-button" data-action="travel" data-id="'+project.id+'">前往展台 <span>↗</span></button>':'')+'</div>'+
    '<div class="project-paging"><span>CONTINUE EXPLORING</span><button data-action="project" data-id="'+next.id+'">'+escape(next.title)+' →</button></div>';
}

function projectRows(){
  const term=query.trim().toLocaleLowerCase();
  const visible=projects.filter(p=>(filter==='all'||p.category===filter)&&(!term||[p.title,p.kicker,p.summary,...p.tech].join(' ').toLocaleLowerCase().includes(term)));
  $('#result-count').textContent=String(visible.length).padStart(2,'0')+' / '+String(projects.length).padStart(2,'0');
  const list=$('#project-list');
  list.innerHTML=visible.length?visible.map(p=>'<button class="project-row" data-action="project" data-id="'+p.id+'"><span class="row-number">'+p.number+'</span><span class="row-main"><strong>'+escape(p.title)+'</strong><p>'+escape(p.summary)+'</p></span><span class="row-category">'+escape(category(p.category)?.label||'')+'</span><span class="row-arrow" aria-hidden="true">↗</span></button>').join(''):'<div class="empty-state"><strong>没有找到相关作品</strong><span>换一个关键词，或查看全部项目。</span><br><button data-action="reset-search">清除筛选 →</button></div>';
}
function renderIndex(){
  panel.className='wide';$('#panel-path').textContent='DIRECTORY / ALL WORKS';
  content.innerHTML='<div class="panel-kicker">A COLLECTION OF EXPLORATIONS</div><div class="index-topline"><h2 id="panel-title" tabindex="-1">作品索引<span class="green-period">.</span></h2><span class="index-count" id="result-count"></span></div><p class="panel-lead">从一个想法，到可以使用的作品。选择你感兴趣的方向。</p>'+
    '<div class="search-wrap"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="m12 12 5 5"/></svg><input id="project-search" type="search" placeholder="搜索项目、方向或技术…" aria-label="搜索作品" autocomplete="off" value="'+escape(query)+'"></div>'+
    '<div class="filter-list" aria-label="作品分类">'+[{id:'all',label:'全部作品'},...categories].map(c=>'<button class="filter-button '+(filter===c.id?'active':'')+'" data-action="filter" data-filter="'+c.id+'" aria-pressed="'+(filter===c.id)+'">'+escape(c.label)+'</button>').join('')+'</div><div class="project-list" id="project-list" aria-live="polite"></div>';
  projectRows();$('#project-search').addEventListener('input',e=>{query=e.target.value;projectRows();});
  content.insertAdjacentHTML('beforeend','<div class="index-footer"><span>每个作品，都是一次持续的探索。</span><button class="text-button" data-action="about">关于 Parsifal ↗</button></div>');
}
function renderMap(){
  panel.className='wide';$('#panel-path').textContent='SPATIAL INDEX / FLOOR 01';
  const pairs=[[4,5],[2,3],[0,1]];
  content.innerHTML='<div class="panel-kicker">FIND YOUR WAY</div><h2 id="panel-title" tabindex="-1">选择一个目的地。</h2><p class="panel-lead">六个展台，三条探索线索。点击展台，镜头会带你前往。</p><div class="map-layout"><div class="floor-map" aria-label="展馆平面图">'+pairs.map(pair=>'<div class="floor-map-pair">'+pair.map(i=>{const p=featuredProjects[i];return '<button class="floor-node '+(nearest===p.id?'active':'')+'" data-action="travel" data-id="'+p.id+'" aria-label="前往 '+escape(p.title)+' 展台">'+p.number+'<small>'+escape(p.id==='teacher'?'TEACHER':p.title.toUpperCase())+'</small></button>';}).join('')+'</div>').join('')+'<span class="floor-map-entry">↑ ENTRANCE / 入口</span></div><div class="map-legend">'+featuredProjects.map(p=>'<button data-action="travel" data-id="'+p.id+'"><span>'+p.number+'</span><div><strong>'+escape(p.title)+'</strong><small>'+escape(p.kicker)+'</small></div><span class="legend-arrow">↗</span></button>').join('')+'</div></div><p class="map-note">随时可以使用作品索引直接阅读。移动端：拖动观察，使用左下角方向按钮移动。</p>';
}
function renderAbout(contactOnly=false){
  panel.className='about-panel';$('#panel-path').textContent=contactOnly?'CONNECTION / SAY HELLO':'IDENTITY / THE MAKER';
  content.innerHTML='<div class="panel-kicker">'+(contactOnly?'LET’S MAKE SOMETHING':'THE PERSON BEHIND THE CODE')+'</div><h2 class="about-title" id="panel-title" tabindex="-1">'+(contactOnly?'Say hello<span>.</span>':'Hi, I’m<br>Parsifal<span>.</span>')+'</h2>'+
    (contactOnly?'': '<div class="about-meta"><span>'+escape(profile.title)+'</span><span>↗ '+escape(profile.location)+'</span></div><p class="about-copy">'+escape(profile.bio)+'</p><div class="section-label">AN ONGOING JOURNEY</div>'+profile.timeline.map(t=>'<div class="timeline-item"><span>'+escape(t.year)+'</span><div><h3>'+escape(t.title)+'</h3><p>'+escape(t.text)+'</p></div></div>').join('')+'<div class="section-label">HOW I LIKE TO BUILD</div><div class="principles">'+profile.principles.map(p=>'<span>'+escape(p)+'</span>').join('')+'</div>')+
    '<div class="contact-block"><div class="section-label">OPEN TO GOOD CONVERSATIONS</div><p>聊聊技术、作品，或者下一个值得尝试的想法。</p><a class="contact-link" href="mailto:'+escape(profile.email)+'">'+escape(profile.email)+' <span>↗</span></a><div class="contact-small-links"><a href="'+escape(profile.github)+'" target="_blank" rel="noopener noreferrer">GitHub '+escape(profile.handle)+' ↗</a><button data-action="copy-email">复制邮箱</button><button data-action="index">看看我的作品 →</button></div></div>';
}
function renderSettings(){
  panel.className='compact';$('#panel-path').textContent='PREFERENCES';
  content.innerHTML='<div class="panel-kicker">MAKE YOURSELF AT HOME</div><h2 id="panel-title" tabindex="-1">以舒服的方式探索。</h2><div class="setting-row"><div><label for="quality-setting">画面精细度</label><p>如果移动不够流畅，可以选择轻量模式。</p></div><select id="quality-setting"><option value="low">轻量</option><option value="balanced">均衡</option><option value="high">精细</option></select></div><div class="setting-row"><div><label for="motion-setting">减少动态效果</label><p>静止装置动画，并直接到达目的地。</p></div><input type="checkbox" id="motion-setting" '+(reduced()?'checked':'')+' '+(mediaMotion.matches?'disabled':'')+'></div><div class="setting-row"><div><label for="sound-setting">环境声音</label><p>低声的空间氛围，默认关闭。</p></div><input type="checkbox" id="sound-setting" '+(soundOn?'checked':'')+'></div><div class="control-reference"><span><kbd>W A S D</kbd> 或方向键移动</span><span><kbd>M</kbd> 展区地图</span><span><kbd>I</kbd> 作品索引</span><span><kbd>E</kbd> 查看附近展台</span><span><kbd>Esc</kbd> 关闭面板</span><span>拖动画面 · 调整视角</span></div><p class="setting-footnote">'+(mediaMotion.matches?'已遵循系统的减少动态效果设置。':'显示偏好会保存在当前浏览器。')+' 也可以完全通过地图和作品索引参观。</p>';
  $('#quality-setting').value=settings.quality;
  $('#quality-setting').addEventListener('change',e=>{settings.quality=e.target.value;saveSettings();world?.setQuality(settings.quality);});
  $('#motion-setting').addEventListener('change',e=>{settings.motion=e.target.checked?'reduced':'auto';saveSettings();applyMotion();});
  $('#sound-setting').addEventListener('change',()=>toggleSound());
  content.insertAdjacentHTML('beforeend','<a class="text-button" href="'+(failed?'./':'?mode=lite#index')+'">'+(failed?'尝试空间模式':'切换至轻量浏览')+' →</a>');
}
function route(){
  let hash;try{hash=decodeURIComponent(location.hash.slice(1));}catch{hash='index';}
  if(!hash){if(panel.open)panel.close();world?.setPaused(false);document.body.classList.remove('panel-open');if(lastFocus instanceof HTMLElement&&lastFocus.isConnected){lastFocus.focus({preventScroll:true});lastFocus=null;}return;}
  if(hash==='map')renderMap();else if(hash==='index')renderIndex();else if(hash==='about')renderAbout();else if(hash==='contact')renderAbout(true);else if(hash==='settings')renderSettings();else if(hash.startsWith('project/')&&getProject(hash.slice(8)))renderProject(getProject(hash.slice(8)));else{renderIndex();announce('未找到这个展项，已打开作品索引。');}
  if(!panel.open){lastFocus=lastFocus||document.activeElement;panel.showModal();}
  document.body.classList.add('panel-open');world?.setPaused(true);content.scrollTop=0;$('#panel-title')?.focus({preventScroll:true});
}
window.addEventListener('popstate',route);window.addEventListener('hashchange',route);
panel.addEventListener('cancel',event=>{event.preventDefault();clearPanel();});
panel.addEventListener('click',event=>{if(event.target!==panel)return;const r=panel.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)clearPanel();});

function createSound(){
  const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return null;
  const context=new AudioContext();const master=context.createGain();master.gain.value=0;master.connect(context.destination);
  const oscillators=[55,82.41,110.12].map((frequency,i)=>{const o=context.createOscillator();const gain=context.createGain();o.type='sine';o.frequency.value=frequency;gain.gain.value=[.1,.035,.025][i];o.connect(gain);gain.connect(master);o.start();return o;});
  return {context,master,oscillators};
}
async function toggleSound(){
  try{if(!sound)sound=createSound();if(!sound){toast('当前浏览器暂不支持环境声音。');return;}await sound.context.resume();soundOn=!soundOn;sound.master.gain.setTargetAtTime(soundOn ? 0.2 : 0,sound.context.currentTime,.35);const b=$('#sound-button');b.setAttribute('aria-pressed',String(soundOn));b.setAttribute('aria-label',soundOn?'关闭环境声音':'开启环境声音');b.querySelector('span').textContent=soundOn?'SOUND ON':'SOUND OFF';if($('#sound-setting'))$('#sound-setting').checked=soundOn;}catch{toast('环境声音暂时不可用，其他功能不受影响。');}
}
function clickSound(){if(!soundOn||!sound)return;const c=sound.context;const o=c.createOscillator();const g=c.createGain();o.frequency.setValueAtTime(540,c.currentTime);o.frequency.exponentialRampToValueAtTime(320,c.currentTime+.06);g.gain.setValueAtTime(.012,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.065);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.07);}
document.addEventListener('visibilitychange',()=>{if(sound)sound.master.gain.setTargetAtTime(document.hidden?0:soundOn ? 0.2 : 0,sound.context.currentTime,.15);});

document.addEventListener('click',event=>{
  const target=event.target.closest('[data-action]');if(!target)return;const action=target.dataset.action;event.preventDefault();clickSound();
  if(action==='enter')enter();else if(action==='home')goHome();else if(['map','index','about','contact','settings'].includes(action))navigate(action);else if(action==='close')clearPanel();else if(action==='project')navigate('project/'+target.dataset.id);else if(action==='travel')travelTo(target.dataset.id);else if(action==='sound')toggleSound();
  else if(action==='filter'){filter=target.dataset.filter;document.querySelectorAll('.filter-button').forEach(b=>{const active=b.dataset.filter===filter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});projectRows();}
  else if(action==='reset-search'){filter='all';query='';renderIndex();$('#project-search').focus();}
  else if(action==='demo'){const figure=target.closest('.project-art');const running=figure.classList.toggle('running');target.textContent=running?'暂停示意':'播放示意';target.setAttribute('aria-pressed',String(running));if(reduced()&&running)toast('减少动态效果已开启，当前展示静态示意。');}
  else if(action==='copy-email'){navigator.clipboard?.writeText(profile.email).then(()=>toast('邮箱已复制')).catch(()=>toast('可以直接选择邮箱地址复制。'));if(!navigator.clipboard)toast('可以直接选择邮箱地址复制。');}
});
window.addEventListener('keydown',event=>{
  if(event.metaKey||event.ctrlKey||event.altKey||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||event.repeat)return;
  if(panel.open||document.activeElement!==canvas)return;
  if(event.code==='KeyM'){event.preventDefault();navigate('map');}if(event.code==='KeyI'){event.preventDefault();navigate('index');}if(event.code==='KeyE'&&explored&&nearest){event.preventDefault();navigate('project/'+nearest);}
});
$('#focus-exhibit').addEventListener('click',()=>{if(nearest)navigate('project/'+nearest);});
document.querySelectorAll('[data-move]').forEach(button=>{
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);world?.move(button.dataset.move,true);});
  const stop=()=>world?.move(button.dataset.move,false);button.addEventListener('pointerup',stop);button.addEventListener('pointercancel',stop);button.addEventListener('lostpointercapture',stop);
});

const hotspots=new Map(featuredProjects.map(p=>{const b=document.createElement('button');b.className='hotspot';b.dataset.action='project';b.dataset.id=p.id;b.dataset.visible='false';b.setAttribute('aria-label','查看 '+p.title);b.innerHTML='<span class="hotspot-number">'+p.number+'</span><span>'+escape(p.id==='teacher'?'TEACHER':p.title.toUpperCase())+'</span><span class="hotspot-arrow" aria-hidden="true">↗</span>';$('#hotspots').appendChild(b);return[p.id,b];}));
function updateWorld(data){
  canvas.dataset.frames=String(data.frames);canvas.dataset.x=data.x.toFixed(3);canvas.dataset.z=data.z.toFixed(3);
  $('#coordinates').textContent='X '+data.x.toFixed(1).padStart(4,'0')+' · Z '+data.z.toFixed(1).padStart(4,'0');
  const x=70+data.x*4.5,y=133-(23-data.z)*1.86;$('#mini-player').setAttribute('transform','translate('+x+' '+Math.max(12,Math.min(140,y))+') rotate('+(-data.yaw*180/Math.PI)+')');
  for(const e of data.exhibits){const b=hotspots.get(e.id);if(!b)continue;const width=b.offsetWidth||140;const obscured=!explored&&e.x<innerWidth*.56&&e.y>innerHeight*.26;const visible=e.visible&&!obscured&&e.y<innerHeight-95&&e.y>108&&e.x>width/2+12&&e.x<innerWidth-width/2-12;b.dataset.visible=String(visible);b.tabIndex=visible?0:-1;b.style.transform='translate('+Math.round(e.x-width/2)+'px, '+Math.round(e.y)+'px)';b.classList.toggle('active',nearest===e.id);}
  nearest=data.nearest;
  const current=nearest?getProject(nearest):null;
  $('#focus-exhibit').hidden=!explored||!current||data.traveling;
  $('#explore-hint').hidden=!explored||!!current||failed;
  if(current&&explored){$('#focus-title').textContent=current.title;$('#focus-category').textContent=category(current.category)?.en+' / '+current.number;$('#location-label').textContent=current.number+' / '+(current.id==='teacher'?'TEACHER':current.title.toUpperCase());}else if(explored){$('#location-label').textContent=data.traveling?'→ / IN TRANSIT':'01 / THE CONSTRUCT';}
}
function fallback(error){
  if(failed)return;failed=true;world?.dispose();world=null;document.body.classList.add('no-webgl');setExploring(false);$('#fallback-notice').hidden=false;$('#world-state').textContent='CONSTRUCT / LIGHT MODE';$('#load-status').textContent='轻量浏览已就绪';$('#enter-button').querySelector('span').textContent='浏览作品';$('#crosshair').hidden=true;canvas.dataset.ready='fallback';console.warn('The Construct: using the accessible gallery fallback.',error?.message||'');
}

route();
async function boot(){
  if(new URLSearchParams(location.search).get('mode')==='lite'){fallback();return;}
  try{const {createWorld}=await import('./world.js');world=createWorld({canvas,projects:featuredProjects,quality:settings.quality,reducedMotion:reduced(),onReady(){canvas.dataset.ready='true';$('#world-state').textContent='CONSTRUCT / READY';$('#load-status').textContent='空间已就绪';},onUpdate:updateWorld,onSelect:id=>{if(['about','index'].includes(id))navigate(id);else navigate('project/'+id);},onError:fallback});if(panel.open)world.setPaused(true);}
  catch(error){fallback(error);}
}
boot();
window.addEventListener('resize',()=>{$('#touch-controls').hidden=!explored||failed||!(coarsePointer.matches||innerWidth<=760);});
window.addEventListener('pagehide',()=>{if(sound)sound.context.suspend();});
window.addEventListener('pageshow',()=>{
  if(!sound||!soundOn)return;
  sound.context.resume().catch(()=>{
    soundOn=false;
    const button=$('#sound-button');
    button.setAttribute('aria-pressed','false');
    button.setAttribute('aria-label','开启环境声音');
    button.querySelector('span').textContent='SOUND OFF';
    if($('#sound-setting'))$('#sound-setting').checked=false;
  });
});
