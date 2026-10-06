
(() => {
if(window.cadBoot) return; window.cadBoot=true;
const defaults={module:'Vistas Ortogonales',piece:'Escalonada',view:'Isométrica',projection:'Ortogonal',camera:'Ortográfica',render_mode:'Sólido + aristas',color:'#718e96',light:'2.5',flags:{Visibles:true,Ocultas:true,Ejes:false,Centros:false,Cotas:true,Superficies:true,Proyectantes:false,'Aristas 3D':true},cut:'0',cut_type:'Completa',hatch_angle:'45',hatch_gap:'8',hatch_style:'Simple',perspective:'Dos puntos',distance:'260',height:'40',orientation:'30',body:'Prisma',unfold:0,explaining:false,step:0};
let T, Orbit, scene, renderer, camera, controls, root, selected=-1, model, cfg=defaults, last='', selectedFace=-1, host, raycaster, pointer, selection, resize;
const vec=p=>new T.Vector3(...p), svgNS='http://www.w3.org/2000/svg';
const isTwin=()=>cfg.module==='Gemelo Geométrico 2D–3D';
let modelKey='', projectionRoot;
const PALETTE={Frontal:{name:'ALZADO',plane:'XY',color:'#D7654D',dark:'#853D2E',tint:'#FAEFEC',axis:2},Superior:{name:'PLANTA',plane:'XZ',color:'#3478B8',dark:'#224F79',tint:'#ECF2F8',axis:1},Lateral:{name:'PERFIL',plane:'ZY',color:'#3A8B68',dark:'#265C45',tint:'#EDF5F0',axis:0}};
const hasPlanes=()=>['Vistas Ortogonales','Proyecciones','Gemelo Geométrico 2D–3D'].includes(cfg.module);
function faceOrientation(face){const n=twinNormal(face),a=n.toArray().map(Math.abs),axis=a.indexOf(Math.max(...a));return a[axis]>.999?Object.values(PALETTE).find(p=>p.axis===axis):{name:'OBLICUA',plane:'oblicua',color:'#8066A8'};}
function planeSpecs(){return Object.values(PALETTE).map(p=>({...p,offset:Math.min(...model.v.map(v=>v[p.axis]))-22}));}
function onPlane(v,p){const q=[...v];q[p.axis]=p.offset;return q;}
function teachingLine(group,a,b,color,opacity=1,order=2){const l=line3(a,b,color);l.material.transparent=true;l.material.opacity=opacity;l.material.depthWrite=false;l.renderOrder=order;l.raycast=()=>{};group.add(l);return l;}
function buildProjectionPlanes(){
 if(projectionRoot){scene.remove(projectionRoot);disposeGroup(projectionRoot);}projectionRoot=new T.Group();scene.add(projectionRoot);if(!hasPlanes())return;
 planeSpecs().forEach(p=>{
  const axes=[0,1,2].filter(a=>a!==p.axis),lo=axes.map(a=>Math.min(...model.v.map(v=>v[a]))-10),hi=axes.map(a=>Math.max(...model.v.map(v=>v[a]))+10);
  const corner=(x,y)=>{const q=[0,0,0];q[p.axis]=p.offset;q[axes[0]]=x;q[axes[1]]=y;return q;},corners=[corner(lo[0],lo[1]),corner(hi[0],lo[1]),corner(hi[0],hi[1]),corner(lo[0],hi[1])];
  const mesh=new T.Mesh(geom([corners[0],corners[1],corners[2],corners[0],corners[2],corners[3]]),new T.MeshBasicMaterial({color:p.color,side:T.DoubleSide,transparent:true,opacity:.075,depthWrite:false}));mesh.renderOrder=-2;mesh.raycast=()=>{};projectionRoot.add(mesh);
  corners.forEach((a,i)=>teachingLine(projectionRoot,a,corners[(i+1)%4],p.color,.35,-1));
  teachingLine(projectionRoot,corner(lo[0]+3,lo[1]+3),corner(lo[0]+12,lo[1]+3),p.color,1);
  model.e.forEach(e=>teachingLine(projectionRoot,onPlane(model.v[e.a],p),onPlane(model.v[e.b],p),p.color,.55));
 });
}
function highlightProjections(){
 if(!hasPlanes()||(selected<0&&selectedFace<0))return;
 const indices=selectedFace>=0?model.f[selectedFace]:[model.e[selected].a,model.e[selected].b];
 planeSpecs().forEach(p=>{
  if(selectedFace>=0){const points=triangles(indices).flatMap(t=>t.map(i=>onPlane(model.v[i],p))),mesh=new T.Mesh(geom(points),new T.MeshBasicMaterial({color:p.color,side:T.DoubleSide,transparent:true,opacity:.32,depthWrite:false}));mesh.renderOrder=5;mesh.raycast=()=>{};selection.add(mesh);}
  const pairs=selectedFace>=0?facePairs(indices):[[indices[0],indices[1]]];
  pairs.forEach(([a,b])=>{const start=onPlane(model.v[a],p),end=onPlane(model.v[b],p),distance=vec(start).distanceTo(vec(end));if(distance<.001)return;[ [1.0,'#ffffff',6],[.48,p.color,7] ].forEach(([radius,color,order])=>{const mesh=new T.Mesh(new T.CylinderGeometry(radius,radius,distance,8),new T.MeshBasicMaterial({color,transparent:true,depthWrite:false}));mesh.position.copy(vec(start).add(vec(end)).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vec(end).sub(vec(start)).normalize());mesh.renderOrder=order;mesh.raycast=()=>{};selection.add(mesh);});});
  [...new Set(indices)].forEach(i=>teachingLine(selection,model.v[i],onPlane(model.v[i],p),p.color,.35,3));
 });
}
function selectEntity(kind,index){
 if(!Number.isInteger(index)||!(kind==='edge'?model.e:model.f)[index])return;
 selected=kind==='edge'?index:-1;selectedFace=kind==='face'?index:-1;
 const active=document.activeElement,container=active?.closest('[id]')?.id,token=active?.getAttribute('data-entity');
 highlight();drawAll();
 if(token&&container)document.getElementById(container)?.querySelector(`[data-entity="${token}"]`)?.focus({preventScroll:true});
}
function bindEntity(node,kind,index){
 const token=`${kind==='edge'?'E':'F'}${index+1}`;
 node.setAttribute('data-entity',token);node.setAttribute('tabindex','0');node.setAttribute('role','button');
 node.setAttribute('aria-label',`Seleccionar ${kind==='edge'?'arista':'cara'} ${token}`);
 node.setAttribute('aria-pressed',String(kind==='edge'?selected===index:selectedFace===index));
 node.setAttribute('class','cursor-pointer focus-visible:outline-2 focus-visible:outline-[#216272]');
 node.addEventListener('click',e=>{e.stopPropagation();selectEntity(kind,index);});
 node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();selectEntity(kind,index);}});
 node.addEventListener('focus',()=>{if(node.namespaceURI===svgNS){node.setAttribute('stroke','#216272');node.setAttribute('stroke-opacity','1');node.setAttribute('stroke-dasharray','2 2');}});
 node.addEventListener('blur',()=>{if(node.namespaceURI===svgNS){node.setAttribute('stroke','transparent');node.removeAttribute('stroke-dasharray');}});
}
function entityPanel(){
 const list=document.getElementById('cad-entity-list'),detail=document.getElementById('cad-entity-detail');if(!isTwin()||!list)return;
 const key=JSON.stringify([model.v,model.f.map(faceLoops)]);
 if(list.dataset.model!==key){
  list.replaceChildren();list.dataset.model=key;
  [['ARISTAS','edge',model.e],['CARAS','face',model.f]].forEach(([title,kind,items])=>{
   const heading=document.createElement('h4');heading.className='mb-2 mt-2 font-semibold tracking-widest text-[#52666f]';heading.textContent=`${title} · ${items.length}`;list.append(heading);
   const group=document.createElement('div');group.className='flex flex-wrap gap-1.5 pb-3';group.setAttribute('role','group');group.setAttribute('aria-label',title);
   items.forEach((_,i)=>{const b=document.createElement('button');b.type='button';b.textContent=`${kind==='edge'?'E':'F'}${i+1}`;bindEntity(b,kind,i);group.append(b);});
   group.addEventListener('keydown',e=>{const buttons=[...group.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(i<0)return;let next=i;if(['ArrowRight','ArrowDown'].includes(e.key))next=(i+1)%buttons.length;else if(['ArrowLeft','ArrowUp'].includes(e.key))next=(i-1+buttons.length)%buttons.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;else return;e.preventDefault();buttons[next].focus();});list.append(group);
  });
 }
 list.querySelectorAll('button').forEach(b=>{const token=b.dataset.entity,edge=token[0]==='E',on=Number(token.slice(1))-1===(edge?selected:selectedFace);b.setAttribute('aria-pressed',String(on));b.className=on?(edge?'min-h-8 min-w-10 rounded border-2 border-[#a66d18] bg-[#fff3cf] px-2 font-mono font-bold text-[#714807] focus-visible:outline-2 focus-visible:outline-[#216272]':'min-h-8 min-w-10 rounded border-4 border-double border-[#216272] bg-[#e2eef0] px-2 font-mono font-bold text-[#164854] focus-visible:outline-2 focus-visible:outline-[#216272]'):'min-h-8 min-w-10 rounded border border-[#cedce0] bg-white px-2 font-mono text-[#52666f] hover:bg-[#edf3f4] focus-visible:outline-2 focus-visible:outline-[#216272]';});
 if(!detail)return;
 let text='Sin selección. Elige una arista o cara para consultar sus datos reales.',vertices=[];
 if(selected>=0){const e=model.e[selected];vertices=[e.a,e.b];text=`ARISTA E${selected+1}\nExtremos: V${e.a+1} ↔ V${e.b+1}\nLongitud: ${vec(model.v[e.a]).distanceTo(vec(model.v[e.b])).toFixed(2)} mm\nCaras adyacentes: ${e.faces.map(i=>`F${i+1}`).join(', ')}`;}
 else if(selectedFace>=0){const face=model.f[selectedFace],normal=twinNormal(face),edges=model.e.flatMap((e,i)=>e.faces.includes(selectedFace)?[`E${i+1}`]:[]);vertices=faceLoops(face).flat();const area=triangles(face).reduce((sum,[a,b,c])=>sum+vec(model.v[b]).sub(vec(model.v[a])).cross(vec(model.v[c]).sub(vec(model.v[a]))).length()/2,0);text=`CARA F${selectedFace+1}\nOrientación: ${faceOrientation(face).name} · ${faceOrientation(face).plane}\nVértices: ${face.map(i=>`V${i+1}`).join(', ')}\nAristas: ${edges.join(', ')}\nNormal: (${normal.toArray().map(x=>x.toFixed(3)).join(', ')})\nÁrea triangulada ≈ ${area.toFixed(2)} mm²`;}
 if(vertices.length)text+=`\n\nCOORDENADAS (X, Y, Z) · mm\n${vertices.map(i=>`V${i+1} (${model.v[i].map(x=>x.toFixed(2)).join(', ')})`).join('\n')}`;
 if(detail.textContent!==text)detail.textContent=text;
}
function twinNormal(face){
 const n=new T.Vector3();face.forEach((a,i)=>{const p=model.v[a],q=model.v[face[(i+1)%face.length]];n.x+=(p[1]-q[1])*(p[2]+q[2]);n.y+=(p[2]-q[2])*(p[0]+q[0]);n.z+=(p[0]-q[0])*(p[1]+q[1]);});return n.normalize();
}
function twinStatus(){
 const label=document.getElementById('cad-selection');if(!label)return;
 const kind=selected>=0?'Arista':selectedFace>=0?'Cara':'',id=selected>=0?`E${selected+1}`:`F${selectedFace+1}`;
 const states=[['ALZADO','Frontal'],['PLANTA','Superior'],['PERFIL','Lateral']].map(([name,type])=>{const n=basis(type)[2],dots=(selected>=0?model.e[selected].faces:selectedFace>=0?[selectedFace]:[]).map(i=>twinNormal(model.f[i]).dot(n));return `${name}: ${dots.some(d=>d>.001)?'visible':selectedFace>=0&&dots.every(d=>Math.abs(d)<=.001)?'de canto (no visible)':'oculta'}`;});
 label.textContent=kind?`${kind} ${id}${selectedFace>=0?' · '+faceOrientation(model.f[selectedFace]).name+' · '+faceOrientation(model.f[selectedFace]).plane:''} · ${states.join(' · ')} · estimación por normales`:'Toca una cara para seguirla del sólido a los tres planos. Arrastra para orbitar.';
}
function twinHighlight(){
 const tube=(a,b,r,color)=>{const p=vec(a),q=vec(b),length=p.distanceTo(q);if(length<1e-8)return;const mesh=new T.Mesh(new T.CylinderGeometry(r,r,length,8),new T.MeshBasicMaterial({color,depthTest:false,transparent:true,opacity:1}));mesh.position.copy(p.add(q).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vec(b).sub(vec(a)).normalize());mesh.renderOrder=100;selection.add(mesh);};
 if(selected>=0){const e=model.e[selected],a=model.v[e.a],b=model.v[e.b];tube(a,b,.85,'#fff8df');tube(a,b,.4,'#b47a21');[a,b].forEach(p=>{const dot=new T.Mesh(new T.SphereGeometry(1.3,12,8),new T.MeshBasicMaterial({color:'#b47a21',depthTest:false}));dot.position.copy(vec(p));dot.renderOrder=101;selection.add(dot);});}
 if(selectedFace>=0){const face=model.f[selectedFace],color=faceOrientation(face).color,pts=triangles(face).flatMap(t=>t.map(i=>model.v[i])),surface=new T.Mesh(geom(pts),new T.MeshBasicMaterial({color,side:T.DoubleSide,transparent:true,opacity:.78,depthTest:false,depthWrite:false}));surface.renderOrder=98;selection.add(surface);
  const normal=twinNormal(face),origin=vec(model.v[face[0]]),u=vec(model.v[face[1]]).sub(origin).normalize(),v=normal.clone().cross(u).normalize();
  const projected=faceLoops(face).map(loop=>loop.map(i=>{const p=vec(model.v[i]).sub(origin);return [p.dot(u),p.dot(v)];})),heights=projected.flat().map(p=>p[1]);
  for(let y=Math.min(...heights)+3;y<Math.max(...heights);y+=6){const hits=[];projected.forEach(loop=>loop.forEach((p,i)=>{const q=loop[(i+1)%loop.length];if((p[1]<=y&&q[1]>y)||(q[1]<=y&&p[1]>y))hits.push(p[0]+(y-p[1])*(q[0]-p[0])/(q[1]-p[1]));}));hits.sort((a,b)=>a-b);for(let i=0;i+1<hits.length;i+=2){const p=origin.clone().addScaledVector(u,hits[i]).addScaledVector(v,y),q=origin.clone().addScaledVector(u,hits[i+1]).addScaledVector(v,y);tube(p.toArray(),q.toArray(),.13,'#25343D');}}
  facePairs(face).forEach(([a,b])=>{tube(model.v[a],model.v[b],.9,'#25343D');tube(model.v[a],model.v[b],.38,'#ffffff');});
 }
 entityPanel();if(selected>=0||selectedFace>=0)twinStatus();else{const label=document.getElementById('cad-selection');if(label)label.textContent='Sin selección. Elige una entidad en el modelo, las vistas o la lista.';}
}
function twinProjection(id,type){
 const s=svgStart(id);if(!s)return;s.setAttribute('role','group');s.setAttribute('aria-label',`${type}: aristas y caras seleccionables. Tab y Enter o Espacio.`);
 const palette=PALETTE[type], [u,v,n]=basis(type),points=model.v.map(p=>[200+2*vec(p).dot(u),150-2*vec(p).dot(v)]),visible=model.f.map(f=>twinNormal(f).dot(n)>.001),defs=element('defs'),pattern=element('pattern',{id:`${id}-face-hatch`,width:7,height:7,patternUnits:'userSpaceOnUse',patternTransform:'rotate(45)'});pattern.append(element('rect',{width:7,height:7,fill:palette.tint}));pattern.append(element('line',{x1:0,y1:0,x2:0,y2:7,stroke:palette.color,'stroke-width':2}));defs.append(pattern);s.append(defs);
 const polygon=i=>facePath(model.f[i],points);
 const faces=model.f.map((f,i)=>({i,z:f.reduce((sum,j)=>sum+vec(model.v[j]).dot(n),0)/f.length})).sort((a,b)=>a.z-b.z);
 faces.forEach(({i})=>{if(visible[i]&&cfg.flags.Superficies)s.append(element('path',{d:polygon(i),'fill-rule':'evenodd',fill:palette.tint,stroke:'none'}));});
 faces.forEach(({i})=>{const hit=element('path',{d:polygon(i),'fill-rule':'evenodd',fill:'transparent',stroke:'transparent','stroke-width':8,'pointer-events':'all'});bindEntity(hit,'face',i);s.append(hit);});
 model.e.forEach((e,i)=>{const a=points[e.a],b=points[e.b],show=e.faces.some(f=>visible[f]);if((show&&cfg.flags.Visibles)||(!show&&cfg.flags.Ocultas))ln(s,...a,...b,{stroke:show?palette.dark:palette.color,'stroke-width':show?1.6:1,'stroke-dasharray':show?'none':'5 4','pointer-events':'none'});});
 if(selectedFace>=0){const i=selectedFace,p=polygon(i),dash=visible[i]?'none':'5 4';s.append(element('path',{d:p,'fill-rule':'evenodd',fill:`url(#${id}-face-hatch)`,stroke:palette.color,'stroke-width':5,'stroke-dasharray':dash,'pointer-events':'none'}));s.append(element('path',{d:p,'fill-rule':'evenodd',fill:'none',stroke:'#effafb','stroke-width':1.5,'stroke-dasharray':dash,'pointer-events':'none'}));const face=model.f[i],center=face.reduce((a,j)=>[a[0]+points[j][0]/face.length,a[1]+points[j][1]/face.length],[0,0]);label(s,center[0]+5,center[1]-8,`▧ F${i+1} · ${visible[i]?'visible':'oculta / de canto'}`,{'font-weight':700,fill:palette.dark,stroke:'#fff','stroke-width':3,'paint-order':'stroke','pointer-events':'none'});}
 if(selected>=0){const e=model.e[selected],a=points[e.a],b=points[e.b],show=e.faces.some(f=>visible[f]);ln(s,...a,...b,{stroke:'#fff9e6','stroke-width':8,'pointer-events':'none'});ln(s,...a,...b,{stroke:palette.color,'stroke-width':3.5,'stroke-dasharray':show?'none':'5 4','pointer-events':'none'});[a,b].forEach(p=>s.append(element('circle',{cx:p[0],cy:p[1],r:3.5,fill:palette.color,stroke:'#fff','stroke-width':1,'pointer-events':'none'})));label(s,(a[0]+b[0])/2+7,(a[1]+b[1])/2-9,`● E${selected+1} · ${show?'visible':'oculta'}`,{'font-weight':700,fill:palette.dark,stroke:'#fff','stroke-width':3,'paint-order':'stroke','pointer-events':'none'});}
 model.e.forEach((e,i)=>{const a=points[e.a],b=points[e.b],show=e.faces.some(f=>visible[f]);if(i!==selected&&((show&&!cfg.flags.Visibles)||(!show&&!cfg.flags.Ocultas)))return;const hit=Math.hypot(a[0]-b[0],a[1]-b[1])<.1?element('circle',{cx:a[0],cy:a[1],r:5,fill:'transparent',stroke:'transparent'}):element('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'transparent','stroke-width':9});bindEntity(hit,'edge',i);s.append(hit);});
 s.append(element('rect',{x:17,y:15,width:9,height:9,fill:palette.color}));label(s,33,25,`${palette.name} · ${palette.plane}`,{'font-size':11,'font-weight':600,'letter-spacing':1.4,fill:palette.dark});label(s,17,294,'ESC. ESQUEMÁTICA · mm · TAB PARA EXPLORAR',{'font-size':8});
 if(cfg.flags.Ejes){ln(s,50,150,350,150,{stroke:palette.color,'stroke-dasharray':'12 4 2 4'});ln(s,200,30,200,270,{stroke:palette.color,'stroke-dasharray':'12 4 2 4'});}
 if(cfg.flags.Centros)s.append(element('circle',{cx:200,cy:150,r:7,fill:'none',stroke:palette.dark}));
 if(cfg.flags.Cotas){const xs=points.map(p=>p[0]),a=Math.min(...xs),b=Math.max(...xs);ln(s,a,265,b,265,{stroke:palette.dark});[a,b].forEach(x=>ln(s,x,255,x,273,{stroke:palette.dark}));label(s,200,258,`${((b-a)/2).toFixed(0)} mm`,{'text-anchor':'middle',fill:palette.dark});}
 if(cfg.flags.Proyectantes)points.forEach(p=>ln(s,...p,p[0],270,{stroke:palette.color,'stroke-width':.6,'stroke-dasharray':'3 4'}));
}
function extrusion(profile,depth=50){
 const n=profile.length,v=[...profile.map(([x,y])=>[x,y,-depth/2]),...profile.map(([x,y])=>[x,y,depth/2])];
 const f=[Array.from({length:n},(_,i)=>n-1-i),Array.from({length:n},(_,i)=>n+i)];
 for(let i=0;i<n;i++) f.push([i,(i+1)%n,(i+1)%n+n,i+n]); return topology(v,f);
}
function faceLoops(face){return [face,...(face.holes||[])];}
function facePairs(face){return faceLoops(face).flatMap(loop=>loop.map((a,i)=>[a,loop[(i+1)%loop.length]]));}
function normalOf(vertices,face){const n=new T.Vector3();face.forEach((a,i)=>{const p=vertices[a],q=vertices[face[(i+1)%face.length]];n.x+=(p[1]-q[1])*(p[2]+q[2]);n.y+=(p[2]-q[2])*(p[0]+q[0]);n.z+=(p[0]-q[0])*(p[1]+q[1]);});return n.normalize();}
function topology(v,f,clean=false){
 const edges=new Map();f.forEach((face,fi)=>facePairs(face).forEach(([a,b])=>{const k=[a,b].sort((a,b)=>a-b).join(':');if(!edges.has(k))edges.set(k,{a,b,faces:[]});edges.get(k).faces.push(fi);}));
 const e=[...edges.values()].filter(edge=>{if(!clean||edge.faces.length!==2)return true;const [a,b]=edge.faces;return !(f[a].smooth&&f[a].smooth===f[b].smooth)&&normalOf(v,f[a]).dot(normalOf(v,f[b]))<.999999;});
 return {v,f,e,mechanical:clean};
}
// Weld boundary patches, cancel matching internal interfaces, and split T-junctions.
function combineSolids(parts){
 const v=[],f=[],lookup=new Map();parts.forEach((part,pi)=>{const ids=part.v.map(p=>{const key=p.map(x=>x.toFixed(6)).join(':');if(!lookup.has(key)){lookup.set(key,v.length);v.push(p);}return lookup.get(key);});part.f.forEach(face=>{const mapped=face.map(i=>ids[i]);mapped.holes=(face.holes||[]).map(loop=>loop.map(i=>ids[i]));mapped.smooth=face.smooth?`${pi}:${face.smooth}`:'';f.push(mapped);});});
 const interfaces=new Map();f.forEach((face,i)=>{const key=faceLoops(face).flat().slice().sort((a,b)=>a-b).join(':');if(!interfaces.has(key))interfaces.set(key,[]);interfaces.get(key).push(i);});
 const removed=new Set();interfaces.forEach(ids=>{if(ids.length===2&&normalOf(v,f[ids[0]]).dot(normalOf(v,f[ids[1]]))<-.999)ids.forEach(i=>removed.add(i));});
 const split=loop=>loop.flatMap((a,i)=>{const b=loop[(i+1)%loop.length],p=vec(v[a]),d=vec(v[b]).sub(p),length=d.lengthSq();return [{id:a,t:0},...v.flatMap((q,id)=>{if(id===a||id===b||length<1e-12)return [];const t=vec(q).sub(p).dot(d)/length;return t>1e-7&&t<1-1e-7&&p.clone().addScaledVector(d,t).distanceTo(vec(q))<1e-6?[{id,t}]:[];})].sort((x,y)=>x.t-y.t).map(x=>x.id);});
 return topology(v,f.filter((_,i)=>!removed.has(i)).map(face=>{const out=split(face);out.holes=(face.holes||[]).map(split);out.smooth=face.smooth;return out;}),true);
}
function plate2D(outline,holes,low,high,transform=p=>p){
 const area=loop=>loop.reduce((s,p,i)=>{const q=loop[(i+1)%loop.length];return s+p[0]*q[1]-q[0]*p[1];},0);
 const outer=area(outline)>0?outline.slice():outline.slice().reverse();
 const loops=[outer,...holes.map(({x,y,r})=>Array.from({length:48},(_,i)=>{const a=-i*2*Math.PI/48;return [x+r*Math.cos(a),y+r*Math.sin(a)];}))],flat=loops.flat(),n=flat.length;
 const v=[...flat.map(([x,y])=>transform([x,y,low])),...flat.map(([x,y])=>transform([x,y,high]))];let offset=0;
 const rings=loops.map(loop=>{const ids=loop.map((_,i)=>offset+i);offset+=loop.length;return ids;});
 const back=rings[0].slice().reverse(),front=rings[0].map(i=>i+n);back.holes=rings.slice(1).map(r=>r.slice().reverse());front.holes=rings.slice(1).map(r=>r.map(i=>i+n));const f=[back,front];
 rings.forEach((ring,ri)=>ring.forEach((a,i)=>{const b=ring[(i+1)%ring.length],face=[a,b,b+n,a+n];if(ri)face.smooth=`bore-${ri}`;f.push(face);}));return topology(v,f,true);
}
function replaceCap(part,index,outline,transform){const old=part.f[index],face=outline.map(p=>{part.v.push(transform(p));return part.v.length-1;});face.holes=old.holes;part.f[index]=face;}
function steppedBlock(name){
 if(name!=='Cavidades'){
  const profile=name==='Inclinada'?[[-30,-30],[30,-30],[30,32],[6,32],[-16,-22],[-30,-22]]:[[-30,-30],[30,-30],[30,32],[6,32],[6,-22],[-30,-22]];
  const part=extrusion(profile,80);part.v=part.v.map(([u,y,x])=>[x,y,-u]);return combineSolids([part]);
 }
 const xs=[-40,-16,16,40],zs=[-30,-24,-4,4,30],ys=[-30,-22,4,32],parts=[];
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++)for(let k=0;k<ys.length-1;k++){
  const top=j===3?-22:i===1&&j===1?4:32;if(ys[k+1]>top)continue;
  const part=plate2D([[xs[i],ys[k]],[xs[i+1],ys[k]],[xs[i+1],ys[k+1]],[xs[i],ys[k+1]]],[],zs[j],zs[j+1]);parts.push(part);
 }return combineSolids(parts);
}
function bracket(name){
 const gussets=name==='Combinada',centers=name==='Perforaciones múltiples'?[-24,0,24]:[-18,18];
 const vertical=plate2D([[-40,-30],[40,-30],[40,36],[-40,36]],centers.map(x=>({x,y:16,r:6})),-30,-22);
 const base=plate2D([[-40,-30],[40,-30],[40,22],[-40,22]],[-17,17].map(x=>({x,y:-10,r:6})),-30,-22,([x,v,t])=>[x,t,-v]);
 // Only exposed boundary patches remain at the plate joint and gusset roots.
 const lower=gussets?[[-40,-22],[-36,-22],[-36,12],[-30,12],[-30,-22],[30,-22],[30,12],[36,12],[36,-22],[40,-22]]:[[-40,-22],[40,-22]];
 replaceCap(vertical,1,[...lower,[40,36],[-40,36]],([x,y])=>[x,y,-22]);
 base.f.splice(4,1);
 if(gussets){
  const top=[[-40,-30],[40,-30],[40,22],[36,22],[36,-12],[30,-12],[30,22],[-30,22],[-30,-12],[-36,-12],[-36,22],[-40,22]];
  replaceCap(base,1,top,([x,v])=>[x,-22,-v]);
 }
 const parts=[vertical,base];if(gussets)for(const x of [-36,30]){
  const rib=plate2D([[-12,-22],[22,-22],[22,12]],[],x,x+6,([u,y,t])=>[t,y,-u]);
  rib.f=rib.f.filter((_,i)=>i!==2&&i!==3);parts.push(rib);
 }
 return combineSolids(parts);
}
function facePath(face,points){return faceLoops(face).map(loop=>loop.map((i,j)=>`${j?'L':'M'}${points[i].join(',')}`).join(' ')+' Z').join(' ');}
function radial(kind){
 const n=40,v=[],f=[];
 if(kind==='Esfera'){
  for(let j=0;j<=16;j++)for(let i=0;i<n;i++){const a=i*2*Math.PI/n,b=j*Math.PI/16;v.push([32*Math.sin(b)*Math.cos(a),32*Math.cos(b),32*Math.sin(b)*Math.sin(a)]);}
  for(let j=0;j<16;j++)for(let i=0;i<n;i++)f.push([j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i]);
 }else{
  for(let i=0;i<n;i++){let a=i*2*Math.PI/n;v.push([30*Math.cos(a),-30,30*Math.sin(a)]);}
  if(kind==='Cono') {v.push([0,40,0]);for(let i=0;i<n;i++)f.push([i,n,(i+1)%n]);}
  else {for(let i=0;i<n;i++){let a=i*2*Math.PI/n;v.push([30*Math.cos(a),30,30*Math.sin(a)]);}for(let i=0;i<n;i++)f.push([i,i+n,(i+1)%n+n,(i+1)%n]);f.push(Array.from({length:n},(_,i)=>n+i));}
  f.push(Array.from({length:n},(_,i)=>n-1-i));
 }return topology(v,f);
}
function hollow(advanced=false){
 // Explicit rectangular ring topology: no simulated hole image.
 const outer=[[-40,-30],[40,-30],[40,30],[-40,30]],inner=[[-16,-12],[16,-12],[16,12],[-16,12]],v=[];
 for(const z of [-25,25])for(const p of [...outer,...inner])v.push([p[0],p[1],z]);
 const f=[]; for(let i=0;i<4;i++){let j=(i+1)%4;f.push([i,j,j+8,i+8],[i+4,i+12,j+12,j+4],[i,i+4,j+4,j],[i+8,j+8,j+12,i+12]);}
 if(advanced){v[2][1]=45;v[3][1]=45;v[10][1]=45;v[11][1]=45;}
 return topology(v,f);
}
function makeModel(name){
 if(['Cilindro','Esfera','Cono','Eje'].includes(name))return radial(name==='Eje'?'Cilindro':name);
 if(['Carcasa','Cavidades','Inclinada'].includes(name))return steppedBlock(name);
  if(['Soporte mecánico','Perforaciones múltiples','Combinada'].includes(name))return bracket(name);
  if(['Bloque perforado','Brida'].includes(name))return hollow();
 if(name==='Pirámide')return topology([[-30,-30,-30],[30,-30,-30],[30,-30,30],[-30,-30,30],[0,40,0]],[[3,2,1,0],[0,1,4],[1,2,4],[2,3,4],[3,0,4]]);
 if(name==='Escalonada')return extrusion([[-40,-30],[40,-30],[40,0],[0,0],[0,30],[-40,30]],60);
 if(['Soporte','Angular'].includes(name))return extrusion([[-40,-30],[40,-30],[40,-12],[-20,-12],[-20,30],[-40,30]],50);
 let w=name==='Cubo'?30:40;return extrusion([[-w,-30],[w,-30],[w,30],[-w,30]],60);
}
function faceNormal(face){return normalOf(model.v,face);}
function triangles(face){
 const normal=faceNormal(face),axis=normal.toArray().map(Math.abs).indexOf(Math.max(...normal.toArray().map(Math.abs))),loops=faceLoops(face),ids=loops.flat();
 const flat=loops.map(loop=>loop.map(i=>new T.Vector2(...model.v[i].filter((_,j)=>j!==axis))));
 return T.ShapeUtils.triangulateShape(flat[0],flat.slice(1)).map(tri=>{const out=tri.map(i=>ids[i]),[a,b,c]=out.map(i=>vec(model.v[i]));if(b.sub(a).cross(c.sub(a)).dot(normal)<0)out.reverse();return out;});
}
function geom(points){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.computeVertexNormals();return g;}
function line3(a,b,color=0x263c40,width=1){const line=new T.Line(geom([a,b]),new T.LineBasicMaterial({color,linewidth:width}));return line;}
function disposeGroup(group){while(group.children.length){const obj=group.children[0];obj.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});group.remove(obj);}}
function build(){
 disposeGroup(root); model=makeModel(cfg.module==='Desarrollo de Cuerpos'?cfg.body:cfg.piece);
 const nextModelKey=JSON.stringify([cfg.piece,model.v,model.f.map(faceLoops)]);
 if(modelKey!==nextModelKey||selected>=model.e.length||selectedFace>=model.f.length){selected=-1;selectedFace=-1;}
 modelKey=nextModelKey;
 const cut=cfg.module==='Secciones y Cortes',plane=new T.Plane(new T.Vector3(0,-1,0),Number(cfg.cut));
 model.f.forEach((face,fi)=>{const pts=triangles(face).flatMap(tri=>tri.map(i=>model.v[i]));if(!pts.length)return;
  const mat=new T.MeshStandardMaterial({color:cfg.explaining&&cfg.step>=1?(fi===1?'#bc8640':cfg.color):cfg.color,roughness:0.72,metalness:0.08,side:T.DoubleSide,wireframe:!model.mechanical&&cfg.render_mode==='Wireframe',transparent:true,opacity:model.mechanical&&cfg.render_mode==='Wireframe'?0:cfg.flags.Superficies?1:0.18,clippingPlanes:cut?[plane]:[]});
  const mesh=new T.Mesh(geom(pts),mat);mesh.userData.face=fi;root.add(mesh);
 });
 if((cfg.flags['Aristas 3D']||cfg.render_mode==='Wireframe')&&cfg.render_mode!=='Sólido')model.e.forEach((e,i)=>{const line=line3(model.v[e.a],model.v[e.b]);line.material.clippingPlanes=cut?[plane]:[];line.userData.edge=i;root.add(line);});
 if(cfg.flags.Ejes)root.add(new T.AxesHelper(65));
 if(cfg.flags.Cotas){const xs=model.v.map(v=>v[0]),a=Math.min(...xs),b=Math.max(...xs);root.add(line3([a,-43,35],[b,-43,35],0x6d7d80));for(const x of [a,b])root.add(line3([x,-39,35],[x,-47,35],0x6d7d80));}
 if(cut){
  const section=sectionLoops(Number(cfg.cut));
  sectionShapes(section).forEach(shape=>{const g=new T.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(0,Number(cfg.cut)+.02,0);root.add(new T.Mesh(g,new T.MeshStandardMaterial({color:'#a85d47',side:T.DoubleSide})));});
  const p=new T.Mesh(new T.PlaneGeometry(115,100),new T.MeshBasicMaterial({color:'#aa5843',transparent:true,opacity:.12,side:T.DoubleSide,depthWrite:false}));p.rotation.x=-Math.PI/2;p.position.y=Number(cfg.cut);root.add(p);
 }
 if(cfg.explaining&&cfg.step>=2){const p=new T.Mesh(new T.PlaneGeometry(125,100),new T.MeshBasicMaterial({color:'#cda557',transparent:true,opacity:.13,side:T.DoubleSide}));p.position.z=-50;root.add(p);
 if(cfg.step>=3)model.v.forEach(v=>root.add(line3(v,[v[0],v[1],-50],0xba8a38)));}
 if(cfg.module==='Desarrollo de Cuerpos')unfold3D();
 buildProjectionPlanes();fitMechanical();highlight();drawAll();
}
function sectionLoops(y){
 const segments=[];model.f.forEach(face=>{const hits=[];facePairs(face).forEach(([a,b])=>{const p=model.v[a],q=model.v[b];if((p[1]<=y&&q[1]>y)||(q[1]<=y&&p[1]>y)){const t=(y-p[1])/(q[1]-p[1]);hits.push([p[0]+t*(q[0]-p[0]),y,p[2]+t*(q[2]-p[2])]);}});const normal=faceNormal(face),axis=Math.abs(normal.z)>Math.abs(normal.x)?0:2;hits.sort((a,b)=>a[axis]-b[axis]);for(let i=0;i+1<hits.length;i+=2)if(vec(hits[i]).distanceTo(vec(hits[i+1]))>1e-7)segments.push([hits[i],hits[i+1]]);});
 const near=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2])<.01,loops=[];
 while(segments.length){let [a,b]=segments.pop(),loop=[a,b],guard=0;while(!near(loop.at(-1),a)&&guard++<1000){let index=segments.findIndex(s=>s.some(p=>near(p,loop.at(-1))));if(index<0)break;let s=segments.splice(index,1)[0];loop.push(near(s[0],loop.at(-1))?s[1]:s[0]);}if(loop.length>2)loops.push(loop);}
 return loops;
}
function sectionShapes(loops){
 const rings=loops.map(loop=>loop.map(p=>new T.Vector2(p[0],-p[2])));
 const inside=(p,ring)=>{let hit=false;ring.forEach((a,i)=>{const b=ring[(i+1)%ring.length];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;});return hit;};
 const depth=rings.map((r,i)=>rings.filter((other,j)=>i!==j&&inside(r[0],other)).length),shapes=[];
 rings.forEach((ring,i)=>{if(depth[i]%2)return;const shape=new T.Shape(ring);rings.forEach((hole,j)=>{if(depth[j]===depth[i]+1&&inside(hole[0],ring))shape.holes.push(new T.Path(hole));});shapes.push(shape);});return shapes;
}
function fitMechanical(){
 if(!model?.mechanical||!camera||!host)return;
 camera.updateMatrixWorld();const points=model.v.map(p=>vec(p).project(camera)),extent=Math.max(...points.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]));
 if(extent<=.84)return;
 if(camera.isOrthographicCamera)camera.zoom*=.84/extent;else camera.position.copy(controls.target.clone().add(camera.position.clone().sub(controls.target).multiplyScalar(extent/.84)));
 camera.updateProjectionMatrix();controls.update();
}
function unfold3D(){
 disposeGroup(root);const t=cfg.unfold/100,material=new T.MeshStandardMaterial({color:cfg.color,side:T.DoubleSide,roughness:.8});
 function face(points){const g=geom(points);root.add(new T.Mesh(g,material.clone()));root.add(new T.LineSegments(new T.EdgesGeometry(g),new T.LineBasicMaterial({color:0x263c40})));}
 if(cfg.body==='Cilindro'||cfg.body==='Cono'){
  const r=30,h=60,l=Math.hypot(r,h),n=48;
  const point=(i,top)=>{const a=i/n*2*Math.PI;
   if(cfg.body==='Cilindro'){const bend=Math.max(.00001,1-t),radius=r/bend,theta=(a-Math.PI)*bend;return [radius*Math.sin(theta),top?h/2:-h/2,radius*(Math.cos(theta)-1)];}
   const cone=top?[0,h/2,0]:[r*Math.cos(a),-h/2,r*Math.sin(a)];const theta=(a-Math.PI)*r/l,flat=top?[0,h/2,0]:[l*Math.sin(theta),h/2-l*Math.cos(theta),0];return cone.map((x,j)=>x*(1-t)+flat[j]*t);
  };
  for(let i=0;i<n;i++)face([point(i,false),point(i+1,false),point(i,true),point(i+1,false),point(i+1,true),point(i,true)]);
  const disk=new T.Mesh(new T.CircleGeometry(r,48),material.clone());disk.rotation.x=-Math.PI/2*(1-t);disk.position.set(0,-30-35*t,0);root.add(disk);
  if(cfg.body==='Cilindro'){const upper=disk.clone();upper.position.y=30+35*t;root.add(upper);}
 }else{
  const a=30,angle=t*Math.PI/2;
  face([[-a,-a,-a],[a,-a,-a],[a,-a,a],[-a,-a,-a],[a,-a,a],[-a,-a,a]]);
  for(let i=0;i<4;i++){
   const rotation=new T.Matrix4().makeRotationY(i*Math.PI/2),pivot=new T.Vector3(0,-a,a);
   let points=cfg.body==='Pirámide'?[[-a,-a,a],[a,-a,a],[0,40,0]]:[[-a,-a,a],[a,-a,a],[a,a,a],[-a,-a,a],[a,a,a],[-a,a,a]];
   points=points.map(p=>{const v=vec(p).sub(pivot).applyAxisAngle(new T.Vector3(1,0,0),angle).add(pivot).applyMatrix4(rotation);return v.toArray();});face(points);
   if(i===2&&cfg.body==='Prisma'){const pts=[[-a,a,a],[a,a,a],[a,a,-a],[-a,a,a],[a,a,-a],[-a,a,-a]].map(p=>{const v=vec(p).sub(new T.Vector3(0,a,a)).applyAxisAngle(new T.Vector3(1,0,0),angle).add(new T.Vector3(0,a,a)).sub(pivot).applyAxisAngle(new T.Vector3(1,0,0),angle).add(pivot).applyMatrix4(rotation);return v.toArray();});face(pts);}
  }
 }
 root.scale.setScalar(.8);
 root.updateMatrixWorld(true);
 const vertices=[],faces=[],vertexMap=new Map();
 root.children.filter(o=>o.isMesh).forEach(mesh=>{const geometry=mesh.geometry,index=geometry.index,positions=geometry.attributes.position,map=[];for(let i=0;i<(index?index.count:positions.count);i+=3){const face=[];for(let j=0;j<3;j++){const point=new T.Vector3().fromBufferAttribute(positions,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld).toArray(),key=point.map(x=>x.toFixed(5)).join(':');if(!vertexMap.has(key)){vertexMap.set(key,vertices.length);vertices.push(point);}face.push(vertexMap.get(key));}map.push(faces.length);faces.push(face);}mesh.userData.faceMap=map;});
 model=topology(vertices,faces);
 if(selected>=model.e.length||selectedFace>=model.f.length){selected=-1;selectedFace=-1;}
}
function setCamera(){
 const w=host.clientWidth||500,h=host.clientHeight||400;
 camera=cfg.camera==='Perspectiva'?new T.PerspectiveCamera(35,w/h,.1,3000):new T.OrthographicCamera(-105*w/h,105*w/h,105,-105,.1,3000);
 const views={'Frontal':[0,0,250],'Superior':[0,250,.001],'Lateral':[250,0,0],'Posterior':[0,0,-250],'Inferior':[0,-250,.001],'Isométrica':[180,145,180],'Axonométrica':[200,100,160]};
 camera.position.set(...(views[cfg.view]||views.Isométrica));camera.lookAt(0,0,0);controls?.dispose();controls=new Orbit(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=80;controls.maxDistance=900;controls.target.set(0,0,0);controls.update();
}
function highlight(){
 if(selection){scene.remove(selection);disposeGroup(selection);}selection=new T.Group();scene.add(selection);
 twinHighlight();highlightProjections();
}
function basis(type){
 const d=Math.PI/180;
 const map={'Frontal':[[1,0,0],[0,1,0],[0,0,1]],'Superior':[[1,0,0],[0,0,-1],[0,1,0]],'Lateral':[[0,0,-1],[0,1,0],[1,0,0]],'Posterior':[[-1,0,0],[0,1,0],[0,0,-1]],'Inferior':[[1,0,0],[0,0,1],[0,-1,0]]};
 if(map[type])return map[type].map(vec);
 const a=type==='Dimétrica'?20:type==='Trimétrica'?38:30,b=type==='Trimétrica'?12:a;
 return [vec([Math.cos(a*d),0,-Math.cos(b*d)]),vec([Math.sin(a*d),1,Math.sin(b*d)]),vec([1,1,1]).normalize()];
}
function element(name,attrs={},text=''){const e=document.createElementNS(svgNS,name);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text)e.textContent=text;return e;}
function svgStart(container,viewbox='0 0 400 310'){
 const target=document.getElementById(container);if(!target)return null;target.replaceChildren();const s=element('svg',{viewBox:viewbox,width:'100%',height:'100%',role:'img','aria-label':'Dibujo técnico paramétrico','class':'text-[#36464a]'});target.append(s);return s;
}
function label(s,x,y,text,attrs={}){s.append(element('text',{x,y,fill:'#526268','font-size':10,'font-family':'Inter, sans-serif',...attrs},text));}
function ln(s,x1,y1,x2,y2,attrs={}){const l=element('line',{x1,y1,x2,y2,stroke:'#34474c','stroke-width':1.3,...attrs});s.append(l);return l;}
function projectSVG(id,type,small=false){
 if(PALETTE[type]){twinProjection(id,type);return;}
 const s=svgStart(id);if(!s)return;const [u,v,n]=basis(type),scale=small?2:2.4,project=p=>{let q=vec(p);if(type==='Oblicua')return [200+scale*(p[0]+.5*p[2]*.707),150-scale*(p[1]+.5*p[2]*.707)];return [200+scale*q.dot(u),150-scale*q.dot(v)];};
 const points=model.v.map(project),visibility=model.f.map(f=>faceNormal(f).dot(n)>0.001);
 if(cfg.flags.Superficies)model.f.map((f,i)=>({f,i,z:f.reduce((a,j)=>a+vec(model.v[j]).dot(n),0)/f.length})).sort((a,b)=>a.z-b.z).forEach(({f,i})=>{if(visibility[i])s.append(element('path',{d:facePath(f,points),'fill-rule':'evenodd',fill:cfg.explaining&&cfg.step>=1?'#d4dfe0':'#e8eef0','fill-opacity':.65,stroke:'none'}));});
 model.e.forEach((e,i)=>{const a=points[e.a],b=points[e.b],visible=e.faces.some(f=>visibility[f]);if((visible&&!cfg.flags.Visibles)||(!visible&&!cfg.flags.Ocultas))return;
 const attrs={stroke:i===selected?'#b47a21':visible?'#263a40':'#8b989d','stroke-width':i===selected?3:visible?1.6:1,'stroke-dasharray':visible?'none':'5 4'};ln(s,...a,...b,attrs);
 const hit=ln(s,...a,...b,{stroke:'transparent','stroke-width':12,tabindex:0,role:'button','aria-label':`Seleccionar arista E${i+1}`,'class':'cursor-pointer'});const select=()=>{selected=i;selectedFace=-1;highlight();drawAll();};hit.addEventListener('click',select);hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});});
 if(cfg.flags.Ejes){ln(s,50,150,350,150,{stroke:'#70918b','stroke-dasharray':'12 4 2 4'});ln(s,200,30,200,270,{stroke:'#70918b','stroke-dasharray':'12 4 2 4'});}
 if(cfg.flags.Centros){s.append(element('circle',{cx:200,cy:150,r:7,fill:'none',stroke:'#476f70'}));ln(s,188,150,212,150);ln(s,200,138,200,162);}
 if(cfg.flags.Proyectantes||(cfg.explaining&&cfg.step>=3)){points.forEach(p=>ln(s,...p,p[0],270,{stroke:'#bf8c33','stroke-dasharray':'3 4','stroke-width':.7}));}
 if(cfg.flags.Cotas){const xs=points.map(p=>p[0]),min=Math.min(...xs),max=Math.max(...xs),real=model.v.map(p=>vec(p).dot(u));ln(s,min,265,max,265,{stroke:'#617a80','stroke-width':.8});for(const x of[min,max]){ln(s,x,245,x,273,{stroke:'#617a80','stroke-width':.7});ln(s,x-3,269,x+3,261,{stroke:'#617a80'});}label(s,200,258,`${Math.round(Math.max(...real)-Math.min(...real))} mm`,{'text-anchor':'middle'});}
 label(s,17,25,type.toUpperCase(),{'font-size':11,'font-weight':600,'letter-spacing':1.4});label(s,17,294,'ESC. ESQUEMÁTICA · mm',{'font-size':8});
 if(cfg.explaining&&cfg.step<4){s.append(element('rect',{x:0,y:40,width:400,height:270,fill:'#f8fafb','fill-opacity':.84}));label(s,200,158,'Construyendo la proyección…',{'text-anchor':'middle'});}
}
function sectionSVG(){
 const s=svgStart('cad-special','0 0 640 340');if(!s)return;const y=Number(cfg.cut),loops=sectionLoops(y),gap=Number(cfg.hatch_gap),angle=Number(cfg.hatch_angle);
 const defs=element('defs'),pat=element('pattern',{id:'cad-hatch',width:gap,height:gap,patternUnits:'userSpaceOnUse',patternTransform:`rotate(${angle})`});pat.append(element('line',{x1:0,y1:0,x2:0,y2:gap,stroke:'#a4614b','stroke-width':1}));if(cfg.hatch_style==='Cruzado')pat.append(element('line',{x1:0,y1:0,x2:gap,y2:0,stroke:'#a4614b','stroke-width':1}));defs.append(pat);s.append(defs);
 const d=loops.map(loop=>loop.map((p,i)=>`${i?'L':'M'}${320+p[0]*3},${155+p[2]*3}`).join(' ')+' Z').join(' ');s.append(element('path',{d,fill:'url(#cad-hatch)','fill-rule':'evenodd',stroke:'#8c4b39','stroke-width':2}));
 label(s,20,28,`SECCIÓN A–A · Y = ${y} mm`,{'font-size':12,'font-weight':600});label(s,20,320,loops.length?'Material intersectado · contorno calculado a partir de aristas':'El plano no intersecta material en esta posición.');
}
function perspectiveSVG(){
 const s=svgStart('cad-special','0 0 640 340');if(!s)return;const d=Number(cfg.distance),a=Number(cfg.orientation)*Math.PI/180,h=Number(cfg.height),type=cfg.perspective;
 const center=[320,170],horizon=170-h;const ortho=['Caballera','Militar','Isométrica'].includes(type);
 const project=p=>{if(type==='Caballera')return[320+2*(p[0]+p[2]*.5*Math.cos(a)),180-2*(p[1]+p[2]*.5*Math.sin(a))];if(type==='Militar')return[320+2*(p[0]*Math.cos(a)-p[2]*Math.sin(a)),180+2*(p[0]*Math.sin(a)+p[2]*Math.cos(a)-p[1]*.5)];if(type==='Isométrica'){const[u,v]=basis(type);return[320+2*vec(p).dot(u),180-2*vec(p).dot(v)];}
 let theta=type==='Un punto'?0:a,x=p[0]*Math.cos(theta)+p[2]*Math.sin(theta),z=-p[0]*Math.sin(theta)+p[2]*Math.cos(theta),y=p[1]-h;if(type==='Tres puntos'){const tilt=.24,ny=y*Math.cos(tilt)-z*Math.sin(tilt);z=y*Math.sin(tilt)+z*Math.cos(tilt);y=ny;}const f=2*d/(d+z);return[center[0]+x*f,center[1]-y*f-h*2];};
 const p=model.v.map(project);if(!ortho){ln(s,0,horizon,640,horizon,{stroke:'#bb8a35','stroke-dasharray':'8 5'});label(s,12,horizon-9,'HORIZONTE');}
 model.e.forEach(e=>{ln(s,...p[e.a],...p[e.b],{'stroke-width':1.7});if(!ortho&&cfg.flags.Proyectantes){let a=p[e.a],b=p[e.b],dx=b[0]-a[0],dy=b[1]-a[1];ln(s,a[0]-dx*12,a[1]-dy*12,b[0]+dx*12,b[1]+dy*12,{stroke:'#c69d56','stroke-width':.5,'stroke-dasharray':'4 5'});}});
 if(!ortho){const angle=type==='Un punto'?0:a,tilt=type==='Tres puntos'?.24:0,vanish=axis=>{let [x,y,z]=axis;const xx=x*Math.cos(angle)+z*Math.sin(angle),zz=-x*Math.sin(angle)+z*Math.cos(angle),yy=y*Math.cos(tilt)-zz*Math.sin(tilt),zzz=y*Math.sin(tilt)+zz*Math.cos(tilt);if(Math.abs(zzz)<.0001)return null;return[320+2*d*xx/zzz,170-2*h-2*d*yy/zzz];};[[1,0,0],[0,0,1],[0,1,0]].forEach((axis,i)=>{let vp=vanish(axis);if(vp){const x=Math.max(14,Math.min(626,vp[0])),y=Math.max(14,Math.min(315,vp[1]));s.append(element('circle',{cx:x,cy:y,r:4,fill:'#bb8a35'}));label(s,x+7,y-7,`F${i+1}${vp[0]!==x||vp[1]!==y?' ↗ fuera del campo':''}`,{'font-size':9});}});}
 label(s,18,326,`${type} · distancia ${d} · altura ${h} · giro ${cfg.orientation}°`);
}
function netSVG(){
 const s=svgStart('cad-special','0 0 640 340');if(!s)return;const t=cfg.unfold/100,type=cfg.body;
 const poly=pts=>s.append(element('polygon',{points:pts.map(p=>p.join(',')).join(' '),fill:'#e6eeef',stroke:'#304b51','stroke-width':1.5}));
 if(type==='Cilindro'){const r=30,k=1.25,w=2*Math.PI*r*k,h=60*k,x=320-w/2;poly([[x,135],[x+w,135],[x+w,135+h],[x,135+h]]);for(const cy of[135-r*k*t,210+r*k*t])s.append(element('circle',{cx:320,cy,r:r*k,fill:'#e6eeef',stroke:'#304b51','stroke-width':1.5}));label(s,320,238,`2πr = ${(2*Math.PI*r).toFixed(1)} mm`,{'text-anchor':'middle'});label(s,20,315,'r = 30 mm · h = 60 mm · lateral = 2πr × h');}
 else if(type==='Cono'){const r=30,h=60,l=Math.hypot(r,h),theta=2*Math.PI*r/l,R=l*2,a=-Math.PI/2-theta/2,b=a+theta,x=300,y=185;const p=[x+R*Math.cos(a),y+R*Math.sin(a)],q=[x+R*Math.cos(b),y+R*Math.sin(b)];s.append(element('path',{d:`M ${x} ${y} L ${p} A ${R} ${R} 0 ${theta>Math.PI?1:0} 1 ${q} Z`,fill:'#e6eeef',stroke:'#304b51','stroke-width':1.5}));s.append(element('circle',{cx:300,cy:185+50*t,r:30,fill:'#e6eeef',stroke:'#304b51'}));label(s,20,315,`g = √(r²+h²) = ${l.toFixed(1)} mm · sector ${(theta*180/Math.PI).toFixed(1)}°`);}
 else {const x=290,y=145,a=60;poly([[x,y],[x+a,y],[x+a,y+a],[x,y+a]]);if(type==='Prisma'){poly([[x,y-a*t],[x+a,y-a*t],[x+a,y],[x,y]]);poly([[x,y+a],[x+a,y+a],[x+a,y+a+a*t],[x,y+a+a*t]]);poly([[x-a*t,y],[x,y],[x,y+a],[x-a*t,y+a]]);poly([[x+a,y],[x+a+a*t,y],[x+a+a*t,y+a],[x+a,y+a]]);poly([[x,y-2*a*t],[x+a,y-2*a*t],[x+a,y-a*t],[x,y-a*t]]);}else{const l=Math.hypot(70,30)*t;poly([[x,y],[x+a,y],[x+a/2,y-l]]);poly([[x+a,y],[x+a,y+a],[x+a+l,y+a/2]]);poly([[x,y+a],[x+a,y+a],[x+a/2,y+a+l]]);poly([[x,y],[x,y+a],[x-l,y+a/2]]);}label(s,20,315,type==='Prisma'?'Prisma base cuadrada · 6 caras de 60 × 60 mm':'Pirámide · base 60 × 60 mm · altura 70 mm');}
 label(s,20,26,`DESARROLLO · ${type.toUpperCase()} · ${cfg.unfold}%`,{'font-weight':600,'letter-spacing':1});
}
function fundamentals(){
 const s=svgStart('cad-special','0 0 800 350');if(!s)return;
 const rows=[['Contorno visible','Continua gruesa · 0,7 mm','visible'],['Arista oculta','Discontinua fina · 0,35 mm','hidden'],['Ejes y centros','Trazo y punto · 0,25 mm','axis'],['Cota y tolerancia','80 ± 0,1 mm · dimensión real','dim'],['Escala','1:2 · 80 mm reales → 40 mm en papel','scale'],['Formato / cajetín','A4 · 210 × 297 mm · identificación','format'],['Superficie / sección','Rayado fino · material cortado','surface'],['Símbolos','Ø diámetro · R radio · ⟂ perpendicular','symbol']];
 rows.forEach(([title,detail,kind],i)=>{const x=i<4?20:415,y=35+(i%4)*78;label(s,x,y,title,{'font-size':12,'font-weight':600});label(s,x,y+20,detail,{'font-size':10});
 if(['visible','hidden','axis'].includes(kind))ln(s,x+245,y+3,x+345,y+3,{'stroke-width':kind==='visible'?3:1.2,'stroke-dasharray':kind==='hidden'?'8 5':kind==='axis'?'16 4 2 4':'none',opacity:cfg.flags[kind==='visible'?'Visibles':kind==='hidden'?'Ocultas':'Ejes']?1:.15});
 if(kind==='dim'){ln(s,x+245,y+5,x+345,y+5);for(const a of[x+245,x+345])ln(s,a-4,y+10,a+4,y);label(s,x+263,y-4,'80 ± 0,1');}
 if(kind==='scale'){s.append(element('rect',{x:x+255,y:y-12,width:80,height:14,fill:'#708e96'}));s.append(element('rect',{x:x+255,y:y+8,width:40,height:7,fill:'#283e45'}));}
 if(kind==='format'){s.append(element('rect',{x:x+265,y:y-20,width:60,height:48,fill:'none',stroke:'#52666b'}));s.append(element('rect',{x:x+284,y:y+10,width:41,height:18,fill:'none',stroke:'#52666b'}));label(s,x+287,y+22,'A4');}
 if(kind==='surface'){for(let j=0;j<8;j++)ln(s,x+255+j*8,y+15,x+275+j*8,y-10,{stroke:'#a36b53'});}
 if(kind==='symbol'){s.append(element('circle',{cx:x+290,cy:y,r:16,fill:'none',stroke:'#52666b'}));ln(s,x+270,y+20,x+310,y-20);}
 });
}
function drawAll(){
 projectSVG('cad-front','Frontal',true);projectSVG('cad-top','Superior',true);projectSVG('cad-side','Lateral',true);
 projectSVG('cad-main-view',cfg.module==='Proyecciones'?(cfg.projection==='Ortogonal'?'Frontal':cfg.projection):cfg.view==='Axonométrica'?'Dimétrica':cfg.view);
 if(cfg.module==='Secciones y Cortes')sectionSVG();else if(cfg.module==='Perspectiva')perspectiveSVG();else if(cfg.module==='Desarrollo de Cuerpos')netSVG();else if(cfg.module==='Fundamentos')fundamentals();
}
async function init(){
 try{
  T=await import('https://esm.sh/three@0.164.1');({OrbitControls:Orbit}=await import('https://esm.sh/three@0.164.1/examples/jsm/controls/OrbitControls.js'));
  host=document.getElementById('cad-viewport');if(!host){setTimeout(init,150);return;}
  renderer=new T.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.localClippingEnabled=true;renderer.setClearColor(0xf4f7f8,0);host.replaceChildren(renderer.domElement);renderer.domElement.setAttribute('aria-label','Visor tridimensional. Arrastra para orbitar; rueda para zoom; botón derecho para desplazar.');renderer.domElement.tabIndex=0;
  scene=new T.Scene();scene.add(new T.HemisphereLight(0xffffff,0x667b81,2));const light=new T.DirectionalLight(0xffffff,2.5);light.position.set(80,150,100);scene.add(light);root=new T.Group();scene.add(root);
  const grid=new T.GridHelper(240,24,0xc6d1d4,0xe0e6e8);grid.position.y=-48;scene.add(grid);
  raycaster=new T.Raycaster();pointer=new T.Vector2();let down=null,moved=false;const touches=new Set();renderer.domElement.addEventListener('pointerdown',e=>{touches.add(e.pointerId);if(touches.size>1){moved=true;return;}down={x:e.clientX,y:e.clientY,time:performance.now(),id:e.pointerId,button:e.button};moved=false;});renderer.domElement.addEventListener('pointermove',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)moved=true;});renderer.domElement.addEventListener('pointercancel',e=>{touches.delete(e.pointerId);down=null;moved=true;});renderer.domElement.addEventListener('pointerup',e=>{touches.delete(e.pointerId);const start=down;down=null;if(!start||start.id!==e.pointerId||start.button!==0||moved||performance.now()-start.time>600||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);if(isTwin()){
 const worldPerPixel=camera.isPerspectiveCamera?2*camera.position.distanceTo(controls.target)*Math.tan(T.MathUtils.degToRad(camera.fov/2))/r.height:(camera.top-camera.bottom)/(camera.zoom*r.height);
 raycaster.params.Line.threshold=worldPerPixel*4;
 const hits=raycaster.intersectObjects(root.children),face=hits.find(h=>h.object.userData.face!==undefined),edge=hits.find(h=>h.object.userData.edge!==undefined&&(!face||h.distance<=face.distance+worldPerPixel*4));
 if(edge)selectEntity('edge',edge.object.userData.edge);else if(face)selectEntity('face',face.object.userData.face);return;
 }const hits=raycaster.intersectObjects(root.children).filter(h=>h.object.userData.face!==undefined||h.object.userData.faceMap);const hit=hits.find(h=>cfg.module!=='Secciones y Cortes'||h.point.y<=Number(cfg.cut)+.01);if(hit)selectEntity('face',hit.object.userData.faceMap?hit.object.userData.faceMap[hit.faceIndex]:hit.object.userData.face);});
  resize=new ResizeObserver(()=>{if(!camera)return;const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h);if(camera.isPerspectiveCamera)camera.aspect=w/h;else{camera.left=-105*w/h;camera.right=105*w/h;}camera.updateProjectionMatrix();fitMechanical();});resize.observe(host);
  cfg=window.cadConfig||defaults;setCamera();build();renderer.setSize(host.clientWidth,host.clientHeight);window.cadReset=()=>{setCamera();fitMechanical();};
  let priorDOM=[];function tick(){requestAnimationFrame(tick);const newHost=document.getElementById('cad-viewport');if(!newHost)return;if(newHost!==host){resize.unobserve(host);host=newHost;host.replaceChildren(renderer.domElement);resize.observe(host);}const next=window.cadConfig||defaults,key=JSON.stringify(next),dom=['cad-special','cad-main-view','cad-front','cad-top','cad-side','cad-entity-list','cad-entity-detail','cad-selection'].map(id=>document.getElementById(id));if(key!==last){const cameraChanged=next.view!==cfg.view||next.camera!==cfg.camera;cfg=next;last=key;root.scale.setScalar(1);if(cameraChanged)setCamera();light.intensity=Number(cfg.light);build();}if(dom.some((el,i)=>el!==priorDOM[i])){priorDOM=dom;highlight();drawAll();}controls.update();renderer.render(scene,camera);}tick();
  const status=document.getElementById('cad-engine-status');if(status)status.textContent='WebGL activo · geometría paramétrica';
 }catch(error){console.error('CAD WebGL:',error);const el=document.getElementById('cad-viewport');if(el)el.textContent='No se pudo iniciar WebGL. Comprueba la conexión al motor Three.js y la aceleración gráfica del navegador; recarga para reintentar.';const s=document.getElementById('cad-engine-status');if(s)s.textContent='Motor 3D no disponible';}
}
init();
})();
