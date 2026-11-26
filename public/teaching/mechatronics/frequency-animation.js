/* Playback uses the same trajectory as the waveform; no second physics clock. */
const Motion=(()=>{
 const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
 const node=(tag,attrs={},text)=>{const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
 const fmt=v=>Number(Math.abs(v)<1e-12?0:v).toLocaleString('en-US',{maximumSignificantDigits:4});
 let run,plot,time=0,frame=null,last=null,playing=false,limit=1,cursor,dotX,dotY;
 const mechanical=()=>['mechanism','combined','feedback'].includes(run.id);
 function pause(){playing=false;if(frame!==null)cancelAnimationFrame(frame);frame=null;last=null;$('motion-play').textContent='Play';}
 function values(t){
  const pts=run.points;let lo=0,hi=pts.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(pts[mid][0]<=t)lo=mid;else hi=mid;}
  const a=pts[lo],b=pts[hi],q=b[0]===a[0]?0:Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));
  return {x:run.p.A*Math.sin(2*Math.PI*run.p.f*t),y:a[1]+q*(b[1]-a[1]),z:mechanical()?a[2]+q*(b[2]-a[2]):null};
 }
 function setPlot(p){plot=p;cursor=node('line',{stroke:'var(--ink)','stroke-dasharray':'3 3','pointer-events':'none'});dotX=node('circle',{r:4,fill:'var(--signal-blue)','pointer-events':'none'});dotY=node('circle',{r:4,fill:'var(--signal-green)','pointer-events':'none'});p.svg.append(cursor,dotX,dotY);}
 function scale(){
  limit=$('motion-scale').value==='fit'?Math.max(run.p.A,...run.points.map(d=>Math.abs(d[1])),...run.points.map(d=>Math.abs(d[2]||0)))*1.1:Number($('motion-scale').value)*run.p.A;
 }
 function draw(){
  if(!run)return;const v=values(time),svg=$('motion'),W=Math.max(280,svg.clientWidth),base=W*.17,origin=W*.73,travel=W*.13;
  const clamp=n=>Math.max(-limit,Math.min(limit,n)),dx=n=>travel*clamp(n)/limit,xx=origin+dx(v.x),yy=origin+dx(v.y),zz=base+dx(v.z||0);
  svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${W} 230`);
  const line=(x1,y1,x2,y2,stroke='var(--ink)',extra={})=>svg.append(node('line',{x1,y1,x2,y2,stroke,'stroke-width':2,...extra}));
  const label=(x,y,text,anchor='middle')=>svg.append(node('text',{x,y,'text-anchor':anchor},text));
  label(8,18,`Fixed scale: ±${fmt(limit)} mm`,'start');
  line(origin-travel,203,origin+travel,203,'var(--muted)');
  for(const n of [-1,0,1]){line(origin+travel*n,199,origin+travel*n,207,'var(--muted)');}
  label(origin,223,'Output displacement');
  line(origin,83,origin,193,'var(--line)',{'stroke-dasharray':'2 3'});
  line(xx,44,xx,155,'var(--signal-blue)',{'stroke-dasharray':'5 4'});svg.append(node('path',{d:`M${xx} 38 l-6 6 l6 6 l6 -6 Z`,fill:'var(--signal-blue)'}));label(xx,33,'Target x');
  // A horizontal bracket directly shows target-minus-output displacement.
  line(xx,63,yy,63,'var(--orange)');line(xx,59,xx,67,'var(--orange)');line(yy,59,yy,67,'var(--orange)');
  if(mechanical()){
   line(zz,89,zz,144,'var(--orange)',{'stroke-width':4});label(Math.max(45,zz),80,'Spring end z');
   // Projected helix: fixed turn count and diameter; pitch follows endpoint separation.
   // Count depends only on viewport geometry, never instantaneous displacement.
   const end=yy-20,lead=Math.min(20,(end-zz)*.12),start=zz+lead,finish=end-lead;
   const turns=Math.max(5,Math.min(18,Math.round((origin-20-base-40)/30)));
   const pitch=(finish-start)/turns,radius=12,depth=Math.min(14,pitch*.45);
   svg.append(node('path',{d:`M${zz} 115 H${zz+lead*.4} C${start-4} 115 ${start-4} 103 ${start} 103 M${finish} 103 C${finish+4} 103 ${finish+4} 115 ${end-lead*.4} 115 H${end}`,stroke:'var(--orange)',fill:'none','stroke-width':2.5,'stroke-linecap':'round'}));
   const back=[],front=[];
   for(let turn=0;turn<turns;turn++){
    for(let half=0;half<2;half++){
     let path='';
     for(let step=0;step<=20;step++){
      const u=half/2+step/40,theta=2*Math.PI*u;
      const px=start+pitch*(turn+u)+depth*Math.sin(theta);
      const py=115-radius*Math.cos(theta);
      path+=`${step?'L':'M'}${px.toFixed(2)},${py.toFixed(2)} `;
     }
     (half?front:back).push(path);
    }
   }
   // Rear halves recede; front halves keep the visible coil continuous.
   svg.append(node('path',{d:back.join(' '),stroke:'var(--orange)',opacity:.5,fill:'none','stroke-width':2.5,'stroke-linecap':'round','stroke-linejoin':'round','data-spring':'rear'}));
   svg.append(node('path',{d:front.join(' '),stroke:'var(--orange)',fill:'none','stroke-width':2.5,'stroke-linecap':'round','stroke-linejoin':'round','data-spring':'front'}));
   for(const attach of [zz,end])svg.append(node('circle',{cx:attach,cy:115,r:3.5,fill:'var(--cream)',stroke:'var(--orange)','stroke-width':2}));
   // Grounded damper: cylinder fixed to ground, piston attached to moving mass.
   const body=base+W*.04,bodyEnd=base+W*.34;
   line(base,161,base,195);for(let j=0;j<4;j++)line(base-8,167+j*7,base,161+j*7,'var(--muted)');
   line(base,178,body,178);svg.append(node('path',{d:`M${bodyEnd} 168 H${body} V188 H${bodyEnd}`,fill:'none',stroke:'var(--muted)','stroke-width':2}));
   const piston=base+W*.19+dx(v.y);line(piston,171,piston,185,'var(--signal-green)');line(piston,178,yy,178,'var(--signal-green)');line(yy,135,yy,178,'var(--signal-green)');label(base,214,'Ground');
  }else{line(origin-travel-30,145,origin+travel+30,145,'var(--muted)');label(base,116,'Ideal motion');}
  svg.append(node('rect',{x:yy-20,y:95,width:40,height:40,rx:3,fill:'var(--mint)',stroke:'var(--signal-green)','stroke-width':3}));label(yy,120,mechanical()?'m':'y');label(yy,156,'Output y');
  const clipped=Math.abs(v.y)>limit||Math.abs(v.x)>limit||(mechanical()&&Math.abs(v.z)>limit);
  if(clipped)label(8,50,'Outside scale — positions clipped','start');
  $('motion-values').textContent=`x = ${fmt(v.x)} mm · y = ${fmt(v.y)} mm · error x − y = ${fmt(v.x-v.y)} mm`+(mechanical()?` · z = ${fmt(v.z)} mm · spring stretch y − z = ${fmt(v.y-v.z)} mm`:'');
  $('motion-time-label').textContent=`${fmt(time)} / ${fmt(run.duration)} s`;$('motion-time').value=run.duration?time/run.duration*1000:0;
  if(plot){const px=plot.x(time);for(const [k,val] of Object.entries({x1:px,x2:px,y1:plot.top,y2:plot.bottom}))cursor.setAttribute(k,val);for(const [dot,value] of [[dotX,v.x],[dotY,v.y]]){dot.setAttribute('cx',px);dot.setAttribute('cy',Math.max(plot.top,Math.min(plot.bottom,plot.y(value))));}}
 }
 function setRun(r){pause();run=r;time=0;scale();draw();
  const fast=mechanical()&&r.startup?Math.max(r.p.f,Math.sqrt(r.p.k/r.p.m)/(2*Math.PI)):r.p.f;
  run.clock=1/(2*fast);
  $('motion-timing').textContent=`At 1×, one ${fast>r.p.f*1.01?'mechanical':'input'} cycle takes 2 seconds on screen. Playback changes viewing speed only; input remains ${fmt(r.p.f)} Hz. This run takes about ${fmt(r.duration/run.clock)} screen seconds at 1×.`;
  $('motion-status').textContent='Paused at start. Press Play or scrub the time cursor.';
 }
 function tick(now){if(!playing)return;if(last!==null)time=Math.min(run.duration,time+Math.min((now-last)/1000,.1)*run.clock*Number($('motion-speed').value));last=now;draw();if(time>=run.duration){pause();$('motion-status').textContent='End of displayed response. Play replays from the start.';}else frame=requestAnimationFrame(tick);}
 $('motion-play').addEventListener('click',()=>{if(playing){pause();$('motion-status').textContent='Paused. Scrub to inspect a moment.';return;}if(time>=run.duration)time=0;playing=true;$('motion-play').textContent='Pause';$('motion-status').textContent='Playing. Displacement scale is fixed.';last=null;frame=requestAnimationFrame(tick);});
 $('motion-reset').addEventListener('click',()=>{pause();time=0;draw();$('motion-status').textContent='Rewound to start.';});
 $('motion-time').addEventListener('input',()=>{pause();time=run.duration*Number($('motion-time').value)/1000;draw();$('motion-status').textContent='Paused at selected time.';});
 $('motion-scale').addEventListener('change',()=>{pause();scale();draw();$('motion-status').textContent='Scale changed. It stays fixed during playback.';});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){pause();$('motion-status').textContent='Paused while the page is hidden.';}});
 return {pause,setPlot,setRun};
})();
