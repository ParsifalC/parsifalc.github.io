import * as THREE from '../vendor/three.module.js';

const FLOOR = { minX: -8.8, maxX: 8.8, minZ: -39, maxZ: 25 };
const POSITIONS = [[-6.5, 4], [6.5, 4], [-6.5, -10], [6.5, -10], [-6.5, -24], [6.5, -24]];
const clamp = THREE.MathUtils.clamp;
const smooth = t => t * t * (3 - 2 * t);

export function createWorld({ canvas, projects, quality = 'balanced', reducedMotion = false, onReady, onUpdate, onSelect, onError }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x080e0b);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080e0b);
  scene.fog = new THREE.FogExp2(0x08110c, .022);
  const camera = new THREE.PerspectiveCamera(54, 1, .1, 140);
  camera.rotation.order = 'YXZ';
  camera.position.set(0, 3.25, 23);
  const state = { exploring: false, paused: false, reducedMotion, quality, disposed: false, yaw: 0, pitch: -.015, targetYaw: 0, targetPitch: -.015, traveling: null, hover: null };
  const keys = new Set();
  const velocity = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let previousTime = performance.now(); const clock = { elapsedTime: 0, getDelta(){ const now=performance.now(); const dt=(now-previousTime)/1000; previousTime=now; this.elapsedTime+=dt; return dt; }, getElapsedTime(){ return this.elapsedTime; } };
  const animated = [];
  const targets = [];
  const exhibits = [];
  const cleanups = [];
  const disposableTextures = [];
  let frameId, lastRender = 0, lastUpdate = 0, frames = 0, lost = false;

  function listen(target, type, fn, options) { target.addEventListener(type, fn, options); cleanups.push(() => target.removeEventListener(type, fn, options)); }
  function random(seed) { let x = seed; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
  function texture(draw, width = 512, height = width) { const c = document.createElement('canvas'); c.width = width; c.height = height; draw(c.getContext('2d'), width, height); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; disposableTextures.push(t); return t; }
  const concrete = texture((ctx, w, h) => { const r = random(53); const img = ctx.createImageData(w,h); for(let i=0;i<img.data.length;i+=4){const v=108+r()*38;img.data[i]=v*.94;img.data[i+1]=v;img.data[i+2]=v*.96;img.data[i+3]=255;}ctx.putImageData(img,0,0);for(let i=0;i<1600;i++){ctx.fillStyle=i%2?'#16271a17':'#aab9a512';ctx.fillRect(r()*w,r()*h,1+r()*4,1+r()*28);} });
  concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping;
  concrete.repeat.set(2, 5);
  const glowTexture = texture((ctx,w,h)=>{const g=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(188,255,162,1)');g.addColorStop(.15,'rgba(151,238,128,.35)');g.addColorStop(.55,'rgba(91,197,99,.08)');g.addColorStop(1,'rgba(50,140,70,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);},128);
  const mats = {
    stone: new THREE.MeshStandardMaterial({ color: 0x697466, map: concrete, roughness: .86, metalness: .05 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x151d17, roughness: .65, metalness: .35 }),
    plinth: new THREE.MeshStandardMaterial({ color: 0x222c23, roughness: .38, metalness: .55 }),
    green: new THREE.MeshBasicMaterial({ color: 0xa4ed90, toneMapped: false }),
    dimGreen: new THREE.MeshBasicMaterial({ color: 0x426b49 }),
    glass: new THREE.MeshBasicMaterial({ color: 0x8ac790, transparent: true, opacity: .035, depthWrite: false, side: THREE.DoubleSide }),
    wire: new THREE.LineBasicMaterial({ color: 0x99d48c, transparent: true, opacity: .48 }),
    white: new THREE.MeshBasicMaterial({ color: 0xe6f2db, toneMapped: false })
  };
  const cubeGeometry = new THREE.BoxGeometry(1,1,1);
  function box(w,h,d,x,y,z,material=mats.stone,parent=scene){const mesh=new THREE.Mesh(cubeGeometry,material);mesh.scale.set(w,h,d);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
  function line(points, color = 0x80bd85, opacity = .5, parent = scene){const geo=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const m=new THREE.LineBasicMaterial({color,transparent:true,opacity});const l=new THREE.Line(geo,m);parent.add(l);return l;}
  function glow(x,y,z,sx,sy,opacity=.2,floor=false,parent=scene){const m=new THREE.MeshBasicMaterial({map:glowTexture,color:0xb5ff9b,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});const p=new THREE.Mesh(new THREE.PlaneGeometry(sx,sy),m);p.position.set(x,y,z);if(floor)p.rotation.x=-Math.PI/2;parent.add(p);return p;}
  function label(text, sub, w, h){return texture((ctx,cw,ch)=>{ctx.clearRect(0,0,cw,ch);ctx.fillStyle='#bce2b4';ctx.font='500 46px monospace';ctx.textAlign='center';ctx.fillText(text,cw/2,ch*.46);ctx.fillStyle='#748d78';ctx.font='18px monospace';ctx.fillText(sub,cw/2,ch*.76);},w||1024,h||256);}
  function sign(text,sub,x,y,z,width=6){const t=label(text,sub);const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));mesh.position.set(x,y,z);scene.add(mesh);return mesh;}

  // A measured architectural shell. Lighting stays baked into simple surfaces.
  scene.add(new THREE.HemisphereLight(0xd7e5c5,0x142018,2.15));
  const ceilingLight=new THREE.DirectionalLight(0xdfebd7,3.1);ceilingLight.position.set(-5,17,12);scene.add(ceilingLight);
  const fillLight=new THREE.DirectionalLight(0x759d7a,.65);fillLight.position.set(8,6,-25);scene.add(fillLight);
  const floorMat=new THREE.MeshStandardMaterial({color:0x394239,roughness:.72,metalness:.12,map:concrete});
  box(34,.3,91,0,-.2,-13,floorMat);
  for(let z=-56;z<=30;z+=3){line([[-17,.015,z],[17,.015,z]],0x54715a,.16);}
  for(let x=-15;x<=15;x+=3){line([[x,.015,-56],[x,.015,30]],0x54715a,.16);}
  box(1,17,91,-16.5,8,-13);box(1,17,91,16.5,8,-13);box(34,17,1,0,8,-55);
  box(34,.5,91,0,16.5,-13,mats.dark);
  for(let z=16;z>=-44;z-=12){
    for(const side of [-1,1]){
      box(1.5,15,1.9,side*10.7,7.5,z);
      box(2.0,.28,2.4,side*10.7,.15,z,mats.dark);
      box(1.58,.08,1.98,side*10.7,.35,z,mats.dimGreen);
      box(.055,1.3,.09,side*9.91,.9,z+.96,mats.green);
      glow(side*10,.035,z+1.1,4,5,.2,true);
      box(2.4,13,2.6,side*15,6.5,z+1,mats.dark);
    }
    box(22,1,1.7,0,14.6,z,mats.stone);
    box(7,.04,.12,0,14.04,z+.5,mats.white);
    glow(0,14,z+.5,14,6,.07,false).rotation.x=Math.PI/2;
  }
  for(const side of [-1,1]){
    box(.045,.03,68,side*2.45,.025,-10,mats.green);
    glow(side*2.45,.027,-10,2.3,69,.16,true);
    box(.018,.02,68,side*2.64,.026,-10,mats.dimGreen);
    for(let z=15;z>-40;z-=6){box(.12,.018,.5,side*2.8,.02,z,mats.dimGreen);}
  }
  for(let z=10;z>=-32;z-=14){line([[-8,.03,z],[-2.5,.03,z]],0x88bd88,.4);line([[2.5,.03,z],[8,.03,z]],0x88bd88,.4);}

  // One glyph atlas, reused by the slow-moving architectural curtains.
  const atlas=texture((ctx,w,h)=>{const r=random(125);ctx.clearRect(0,0,w,h);ctx.textAlign='center';ctx.font='18px monospace';const chars='01アイウエオカキクケコサシスセソ{}<>:./';for(let x=0;x<w;x+=24){for(let y=0;y<h;y+=26){ctx.fillStyle='rgba(162,225,144,'+(.2+r()*.8)+')';ctx.fillText(chars[Math.floor(r()*chars.length)],x+12,y+20);}}},384,1024);
  atlas.wrapS=atlas.wrapT=THREE.RepeatWrapping;
  const codeMaterial=new THREE.ShaderMaterial({uniforms:{uMap:{value:atlas},uTime:{value:0},uOpacity:{value:.48}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D uMap; uniform float uTime; uniform float uOpacity; varying vec2 vUv; void main(){float column=floor(vUv.x*16.0);float speed=0.016+fract(sin(column*43.1)*412.3)*0.024; vec2 p=vec2(vUv.x,fract(vUv.y+uTime*speed));vec4 glyph=texture2D(uMap,p);float head=fract(vUv.y+uTime*speed+sin(column)*6.0);float trail=pow(head,2.8);float edge=smoothstep(0.0,0.08,vUv.y)*smoothstep(1.0,0.85,vUv.y);gl_FragColor=vec4(glyph.rgb*(0.5+trail*1.6),glyph.a*uOpacity*(0.14+trail)*edge);}',transparent:true,depthWrite:false,side:THREE.DoubleSide});
  for(let z=10;z>=-38;z-=12){for(const s of [-1,1]){const p=new THREE.Mesh(new THREE.PlaneGeometry(8.8,13),codeMaterial);p.position.set(s*12.8,8,z-4);p.rotation.y=s*Math.PI/2;scene.add(p);}}
  const backCode=new THREE.Mesh(new THREE.PlaneGeometry(22,14),codeMaterial);backCode.position.set(0,8,-52);scene.add(backCode);

  // The far portal becomes a destination, rather than a decorative dead end.
  box(5.9,9,.8,0,4.5,-44,mats.dark);
  box(4.2,7.9,.12,0,4,-43.51,new THREE.MeshBasicMaterial({color:0x80bc74,toneMapped:false}));
  for(const s of [-1,1]){box(.075,8,.09,s*2.13,4,-43.39,mats.green);}
  box(4.33,.075,.09,0,8,-43.39,mats.green);
  glow(0,4,-43.3,14,17,.32);glow(0,.04,-42,9,12,.4,true);
  sign('PARSIFAL','THE CONSTRUCT / INDEPENDENT EXPLORATIONS',0,10.5,-43.2,9);
  sign('ABOUT','THE PERSON BEHIND THE CODE',-7,4.8,-40,4.5);
  sign('ARCHIVE','CRAFT / EXPERIMENTS / COMMUNITY',7,4.8,-40,4.5);
  const portalHit=box(4.8,8,1,0,4,-43.2,new THREE.MeshBasicMaterial({visible:false}));portalHit.userData.id='about';targets.push(portalHit);
  const archiveHit=box(4,5,1,7,3,-40,new THREE.MeshBasicMaterial({visible:false}));archiveHit.userData.id='index';targets.push(archiveHit);
  const aboutHit=box(4,5,1,-7,3,-40,new THREE.MeshBasicMaterial({visible:false}));aboutHit.userData.id='about';targets.push(aboutHit);

  function addArt(type,group,index){
    const art=new THREE.Group();art.position.y=2.85;group.add(art);
    const bright=new THREE.MeshBasicMaterial({color:0xb7f29f,transparent:true,opacity:.82});
    const wireMat=new THREE.MeshBasicMaterial({color:0x9bd595,wireframe:true,transparent:true,opacity:.45});
    if(type==='orchestration'){
      const ico=new THREE.Mesh(new THREE.IcosahedronGeometry(.87,1),wireMat);art.add(ico);
      const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.28,1),bright);art.add(core);
      for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.12,.008,4,90),bright);ring.rotation.set(i*.8,Math.PI/3+i,0);art.add(ring);}
      const points=[];for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const p=[Math.cos(a)*1.1,Math.sin(a*3)*.4,Math.sin(a)*1.1];const n=new THREE.Mesh(new THREE.SphereGeometry(.045,6,6),bright);n.position.set(...p);art.add(n);points.push(p);line([[0,0,0],p],0x78a980,.24,art);}animated.push(t=>{art.rotation.y=t*.12;ico.rotation.z=t*.07;core.scale.setScalar(1+Math.sin(t*1.4)*.12);});
    } else if(type==='routing'){
      for(let i=0;i<5;i++){const x=(i-2)*.43;const bar=box(.12,.4+(i%3)*.5,.12,x,-.1,0,bright,art);const n=new THREE.Mesh(new THREE.OctahedronGeometry(.11),bright);n.position.set(x,.6,0);art.add(n);line([[x,.6,0],[x,.9,-.6],[0,.9,-.6]],0x8bc98b,.65,art);animated.push(t=>{bar.scale.y=(.7+Math.sin(t*1.5+i)*.3)*(i%3+1)*.5;});}
      const ring=new THREE.Mesh(new THREE.TorusGeometry(1.15,.01,4,80),bright);ring.rotation.x=Math.PI/2;ring.position.y=-.7;art.add(ring);
    } else if(type==='voice'){
      for(let i=0;i<23;i++){const x=(i-11)*.093;const h=.15+Math.pow(Math.cos((i-11)/12*Math.PI/2),2)*1.5;const b=box(.035,h,.05,x,0,0,bright,art);animated.push(t=>{b.scale.y=h*(.55+Math.sin(t*2.2+i*.56)*.35);});}const ring=new THREE.Mesh(new THREE.TorusGeometry(1.18,.008,4,90),wireMat);art.add(ring);
    } else if(type==='learning'){
      for(let i=0;i<5;i++){const page=box(1.55,.035,1.1,0,-.6+i*.25,0,new THREE.MeshStandardMaterial({color:i===4?0x81a97a:0x456548,roughness:.4,metalness:.2}),art);page.rotation.y=i*.12-.2;for(let j=0;j<3;j++){const l=box(.7-j*.12,.012,.015,-.2,.024,-.22+j*.16,mats.green,page);l.scale.set(.7-j*.12,.18,.02);}}
      const spark=new THREE.Mesh(new THREE.OctahedronGeometry(.18),bright);spark.position.y=.9;art.add(spark);animated.push(t=>{spark.rotation.y=t*.8;spark.position.y=.9+Math.sin(t)*.1;art.rotation.y=Math.sin(t*.25)*.12;});
    } else if(type==='fleet'){
      for(let i=0;i<3;i++){box(.47,1.5,.55,(i-1)*.66,-.05,0,mats.dark,art);for(let j=0;j<7;j++){box(.35,.02,.02,(i-1)*.66,-.62+j*.19,.29,mats.dimGreen,art);const led=box(.045,.025,.015,(i-1)*.66+.14,-.6+j*.19,.302,bright,art);animated.push(t=>{led.visible=Math.sin(t*.7+i*2+j)>.05;});}line([[(i-1)*.66,-.8,.4],[(i-1)*.66,-.8,.8],[0,-.8,.8]],0x92cf92,.7,art);}
    } else {
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.9,.014,6,80),bright);ring.rotation.x=Math.PI/2;art.add(ring);for(let i=0;i<6;i++){const a=i/6*Math.PI*2;const n=new THREE.Mesh(new THREE.IcosahedronGeometry(.18,0),bright);n.position.set(Math.cos(a)*.9,0,Math.sin(a)*.9);art.add(n);line([[0,.45,0],[n.position.x,0,n.position.z]],0x8acb8b,.4,art);}const core=new THREE.Mesh(new THREE.OctahedronGeometry(.25),wireMat);core.position.y=.45;art.add(core);animated.push(t=>{art.rotation.y=t*.14;core.rotation.y=-t*.6;});
    }
    const plate=new THREE.Mesh(new THREE.RingGeometry(.8,1.3,64),new THREE.MeshBasicMaterial({color:0x87cd7d,transparent:true,opacity:.12,side:THREE.DoubleSide}));plate.rotation.x=-Math.PI/2;plate.position.y=1.06;group.add(plate);
    glow(0,1.04,0,4.5,4.5,.2,true,group);
    return art;
  }
  projects.forEach((project,index)=>{
    const [x,z]=POSITIONS[index];const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
    box(3.3,.22,3.1,0,.11,0,mats.dark,group);box(2.9,.84,2.7,0,.64,0,mats.plinth,group);
    box(3,.025,2.8,0,1.075,0,mats.dimGreen,group);box(2.9,.035,.025,0,.18,1.57,mats.green,group);
    glow(x,.035,z+1.5,6,5,.2,true);
    const glassGeo=new THREE.BoxGeometry(2.8,2.8,2.6);const glass=new THREE.Mesh(glassGeo,mats.glass);glass.position.y=2.5;group.add(glass);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(glassGeo),mats.wire);edges.position.y=2.5;group.add(edges);
    const art=addArt(project.visual,group,index);
    const screenTexture=label(project.number+' / '+project.title.toUpperCase(),'SELECT TO EXPLORE',1024,256);
    const plaque=new THREE.Mesh(new THREE.PlaneGeometry(2.5,.625),new THREE.MeshBasicMaterial({map:screenTexture,transparent:true}));plaque.position.set(0,.64,1.357);group.add(plaque);
    const hit=box(3.4,4.1,3.3,x,2.05,z,new THREE.MeshBasicMaterial({visible:false}));hit.userData.id=project.id;targets.push(hit);
    exhibits.push({id:project.id,position:new THREE.Vector3(x,0,z),anchor:new THREE.Vector3(x,4.65,z),group,art,index});
    const spot=new THREE.PointLight(0x95d68d,3.2,8,2);spot.position.set(x,4.8,z);scene.add(spot);
    glow(x,4.7,z-1,5,7,.08);
  });
  // Suspended dust adds depth without textures, network requests, or a heavy post-process.
  const pr=random(83);const pPositions=new Float32Array(240*3);for(let i=0;i<240;i++){pPositions[i*3]=(pr()-.5)*27;pPositions[i*3+1]=pr()*13;pPositions[i*3+2]=pr()*76-50;}
  const particlesGeometry=new THREE.BufferGeometry();particlesGeometry.setAttribute('position',new THREE.BufferAttribute(pPositions,3));const dust=new THREE.Points(particlesGeometry,new THREE.PointsMaterial({color:0xa6cba0,size:.025,transparent:true,opacity:.5,sizeAttenuation:true,depthWrite:false}));scene.add(dust);

  function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;camera.aspect=w/h;camera.fov=w<760?66:54;camera.updateProjectionMatrix();const max=state.quality==='high'?1.75:state.quality==='low'?1:1.35;renderer.setPixelRatio(Math.min(devicePixelRatio||1,max));renderer.setSize(w,h,false);renderer.render(scene,camera);}
  function isBlocked(x,z){return exhibits.some(e=>Math.abs(x-e.position.x)<2.1&&Math.abs(z-e.position.z)<2.05);}
  function setPosition(x,z){x=clamp(x,FLOOR.minX,FLOOR.maxX);z=clamp(z,FLOOR.minZ,FLOOR.maxZ);if(!isBlocked(x,camera.position.z))camera.position.x=x;if(!isBlocked(camera.position.x,z))camera.position.z=z;}
  function travel(position,lookAt,duration=1.6){
    keys.clear();velocity.set(0,0,0);state.exploring=true;
    const dx=lookAt.x-position.x,dy=lookAt.y-position.y,dz=lookAt.z-position.z;
    let yaw=Math.atan2(-dx,-dz);while(yaw-state.yaw>Math.PI)yaw-=Math.PI*2;while(yaw-state.yaw<-Math.PI)yaw+=Math.PI*2;
    const pitch=Math.atan2(dy,Math.hypot(dx,dz));
    state.traveling={from:camera.position.clone(),to:position,fromYaw:state.yaw,toYaw:yaw,fromPitch:state.pitch,toPitch:pitch,start:clock.getElapsedTime(),duration:state.reducedMotion?0:duration};
  }
  function goTo(id){const e=exhibits.find(e=>e.id===id);if(!e)return;travel(new THREE.Vector3(Math.sign(e.position.x)*2.25,3.1,e.position.z+5.4),new THREE.Vector3(e.position.x,2.65,e.position.z),1.65);}
  function home(){state.exploring=false;keys.clear();velocity.set(0,0,0);state.traveling={from:camera.position.clone(),to:new THREE.Vector3(0,3.25,23),fromYaw:state.yaw,toYaw:0,fromPitch:state.pitch,toPitch:-.015,start:clock.getElapsedTime(),duration:state.reducedMotion?0:1.2};}
  function start(){if(!state.exploring){state.exploring=true;travel(new THREE.Vector3(0,3.1,17),new THREE.Vector3(0,3,-13),1.5);}}
  function projectState(){
    const visible=exhibits.map(e=>{const projected=e.anchor.clone().project(camera);const distance=camera.position.distanceTo(e.anchor);return{id:e.id,x:(projected.x*.5+.5)*canvas.clientWidth,y:(-.5*projected.y+.5)*canvas.clientHeight,distance,visible:projected.z<1&&projected.z>-1&&Math.abs(projected.x)<.94&&Math.abs(projected.y)<.84&&distance<43};});
    let nearest=null,best=Infinity;exhibits.forEach(e=>{const distance=camera.position.distanceTo(e.anchor);const p=e.anchor.clone().project(camera);if(distance<12&&Math.abs(p.x)<.75&&p.z<1&&distance<best){nearest=e.id;best=distance;}});
    onUpdate?.({x:camera.position.x,z:camera.position.z,yaw:state.yaw,nearest,exhibits:visible,traveling:!!state.traveling,exploring:state.exploring,frames});
  }
  function hitAt(event){const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(targets,false)[0];}
  let drag=null;
  listen(canvas,'pointerdown',e=>{if(e.button!==0||state.paused)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:0};canvas.setPointerCapture(e.pointerId);});
  listen(canvas,'pointermove',e=>{if(state.paused)return;if(drag&&drag.id===e.pointerId){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved+=Math.abs(dx)+Math.abs(dy);drag.x=e.clientX;drag.y=e.clientY;if(state.exploring){state.traveling=null;state.targetYaw-=dx*.003;state.targetPitch=clamp(state.targetPitch-dy*.0025,-.48,.62);}}else{const hit=hitAt(e);canvas.style.cursor=hit?'pointer':'grab';}});
  listen(canvas,'pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const wasClick=drag.moved<7;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(state.paused||!wasClick)return;const hit=hitAt(e);if(hit){onSelect?.(hit.object.userData.id);return;}if(!state.exploring)return;const point=new THREE.Vector3();const intersection=raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),point);if(intersection&&Number.isFinite(point.x)&&point.z<FLOOR.maxZ&&point.z>FLOOR.minZ&&Math.abs(point.x)<8.5&&!isBlocked(point.x,point.z)&&point.distanceTo(camera.position)<25){const target=new THREE.Vector3(point.x,3.1,point.z);travel(target,new THREE.Vector3(target.x-Math.sin(state.yaw)*8,3.1+Math.sin(state.pitch)*8,target.z-Math.cos(state.yaw)*8),1);}});
  listen(canvas,'pointercancel',()=>{drag=null;keys.clear();});
  listen(window,'keydown',e=>{if(state.paused||!state.exploring||document.activeElement!==canvas||e.ctrlKey||e.metaKey||e.altKey)return;if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const map={KeyW:'forward',ArrowUp:'forward',KeyS:'backward',ArrowDown:'backward',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};if(map[e.code]){e.preventDefault();keys.add(map[e.code]);state.traveling=null;}});
  listen(window,'keyup',e=>{const map={KeyW:'forward',ArrowUp:'forward',KeyS:'backward',ArrowDown:'backward',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};if(map[e.code])keys.delete(map[e.code]);});
  listen(window,'blur',()=>{keys.clear();drag=null;velocity.set(0,0,0);});
  listen(document,'visibilitychange',()=>{if(document.hidden){keys.clear();velocity.set(0,0,0);}});
  listen(window,'resize',resize);
  listen(canvas,'webglcontextlost',e=>{e.preventDefault();lost=true;onError?.(new Error('WebGL context lost'));});
  listen(canvas,'webglcontextrestored',()=>{lost=false;resize();});

  function animate(now){
    if(state.disposed)return;frameId=requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),.06),time=clock.elapsedTime;
    if(document.hidden||lost)return;
    if(state.paused)return;
    if(state.traveling){const move=state.traveling;const t=move.duration===0?1:clamp((time-move.start)/move.duration,0,1);const s=smooth(t);camera.position.lerpVectors(move.from,move.to,s);state.yaw=THREE.MathUtils.lerp(move.fromYaw,move.toYaw,s);state.pitch=THREE.MathUtils.lerp(move.fromPitch,move.toPitch,s);state.targetYaw=state.yaw;state.targetPitch=state.pitch;if(t===1)state.traveling=null;}
    else if(state.exploring){
      const f=(keys.has('forward')?1:0)-(keys.has('backward')?1:0),r=(keys.has('right')?1:0)-(keys.has('left')?1:0);const norm=Math.hypot(f,r)||1;
      const tx=(-Math.sin(state.yaw)*f+Math.cos(state.yaw)*r)/norm*5,tz=(-Math.cos(state.yaw)*f-Math.sin(state.yaw)*r)/norm*5;
      velocity.x=THREE.MathUtils.damp(velocity.x,tx,12,dt);velocity.z=THREE.MathUtils.damp(velocity.z,tz,12,dt);setPosition(camera.position.x+velocity.x*dt,camera.position.z+velocity.z*dt);
      state.yaw=THREE.MathUtils.damp(state.yaw,state.targetYaw,14,dt);state.pitch=THREE.MathUtils.damp(state.pitch,state.targetPitch,14,dt);
    }
    camera.rotation.set(state.pitch,state.yaw,0,'YXZ');
    const rate=state.quality==='low'?30:60;if(now-lastRender<1000/rate-1)return;lastRender=now;
    if(!state.reducedMotion){codeMaterial.uniforms.uTime.value=time;animated.forEach(fn=>fn(time));dust.position.y=Math.sin(time*.09)*.12;}
    renderer.render(scene,camera);frames++;
    if(now-lastUpdate>70){projectState();lastUpdate=now;}
  }
  resize();renderer.render(scene,camera);frameId=requestAnimationFrame(animate);onReady?.();
  return {start,goTo,home,setPaused(value){state.paused=value;keys.clear();velocity.set(0,0,0);},setReducedMotion(value){state.reducedMotion=value;},setQuality(value){state.quality=value;resize();},move(direction,pressed){if(pressed){state.traveling=null;keys.add(direction);}else keys.delete(direction);},getState(){return{x:camera.position.x,z:camera.position.z,yaw:state.yaw,exploring:state.exploring,frames};},dispose(){state.disposed=true;cancelAnimationFrame(frameId);cleanups.forEach(fn=>fn());const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());disposableTextures.forEach(t=>t.dispose());renderer.dispose();}};
}
