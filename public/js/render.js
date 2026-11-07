/* ===== 繪圖：預先繪製擬真地景，再疊上動態光影 ===== */
function shade(hex,a){
  const n=parseInt(hex.slice(1),16),f=v=>Math.max(0,Math.min(255,v+a));
  return 'rgb('+f(n>>16)+','+f((n>>8)&255)+','+f(n&255)+')';
}
const darken=(hex,k)=>{const n=parseInt(hex.slice(1),16);return 'rgba('+((n>>16)*k|0)+','+(((n>>8)&255)*k|0)+','+((n&255)*k|0)+',.965)'};
TH.forEach(t=>{t.fog=darken(t.bg,.35)});
const rot=(c,x,y,a,fn)=>{c.save();c.translate(x,y);c.rotate(a);fn();c.restore()};

function floorDetail(c,T,px,py,S,R){
  const r=()=>R();
  switch(T.g){
    case 'stalk':
      for(let i=0;i<7;i++){const x=px+r()*S,y=py+S*(.3+r()*.7);c.strokeStyle=r()<.5?'#4d8a58':'#3a6e46';c.globalAlpha=.55;c.lineWidth=1.2;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+(r()-.5)*5,y-S*.15,x+(r()-.5)*7,y-S*(.12+r()*.18));c.stroke()}
      c.globalAlpha=.4;c.fillStyle='#8a8f7a';for(let i=0;i<2;i++){c.beginPath();c.ellipse(px+r()*S,py+r()*S,S*.05,S*.035,r()*3,0,6.3);c.fill()}break;
    case 'coral':
      c.globalAlpha=.16;c.strokeStyle='#e7fbff';c.lineWidth=1.3;for(let i=0;i<2;i++){const y=py+S*(.25+i*.45);c.beginPath();c.moveTo(px,y);c.bezierCurveTo(px+S*.3,y-5,px+S*.6,y+5,px+S,y);c.stroke()}
      {const g=c.createRadialGradient(px+r()*S,py+r()*S,0,px+S/2,py+S/2,S*.7);g.addColorStop(0,'rgba(200,245,255,.16)');g.addColorStop(1,'rgba(200,245,255,0)');c.globalAlpha=1;c.fillStyle=g;c.fillRect(px,py,S,S)}break;
    case 'dune':
      c.globalAlpha=.3;for(let i=0;i<14;i++){c.fillStyle=r()<.5?'#7a5528':'#fff1cf';c.fillRect(px+r()*S,py+r()*S,1.4,1.4)}
      c.globalAlpha=.22;c.strokeStyle='#8a6030';c.lineWidth=1.3;c.beginPath();c.arc(px+S*.5,py+S*(.9+r()*.4),S*.6,3.5,5.9);c.stroke();break;
    case 'ice':
      c.globalAlpha=.5;for(let i=0;i<5;i++){c.fillStyle='#fff';c.beginPath();c.arc(px+r()*S,py+r()*S,.9+r()*.9,0,6.3);c.fill()}
      {const g=c.createRadialGradient(px+r()*S,py+r()*S,0,px+S/2,py+S/2,S*.8);g.addColorStop(0,'rgba(120,160,210,.2)');g.addColorStop(1,'rgba(120,160,210,0)');c.globalAlpha=1;c.fillStyle=g;c.fillRect(px,py,S,S)}break;
    case 'star':
      for(let i=0;i<5;i++){c.globalAlpha=.25+r()*.6;c.fillStyle='#e8e2ff';c.beginPath();c.arc(px+r()*S,py+r()*S,.5+r()*1.1,0,6.3);c.fill()}
      {const g=c.createRadialGradient(px+r()*S,py+r()*S,0,px+S/2,py+S/2,S*.8);g.addColorStop(0,'rgba(120,100,255,.2)');g.addColorStop(1,'rgba(120,100,255,0)');c.globalAlpha=1;c.fillStyle=g;c.fillRect(px,py,S,S)}break;
    case 'leaf':
      for(let i=0;i<3;i++){c.globalAlpha=.7;c.fillStyle=['#c9531f','#e08a2e','#8a3a14','#a8742e'][r()*4|0];rot(c,px+r()*S,py+r()*S,r()*6,()=>{c.beginPath();c.ellipse(0,0,S*.12,S*.055,0,0,6.3);c.fill()})}break;
  }
  c.globalAlpha=1;
}

function wallArt(c,T,px,py,S,R,x,y){
  const r=()=>R();
  const g=c.createLinearGradient(0,py,0,py+S);g.addColorStop(0,shade(T.w,22));g.addColorStop(1,shade(T.w,-16));
  c.fillStyle=g;c.fillRect(px,py,S+.5,S+.5);
  switch(T.g){
    case 'stalk':
      for(let i=0;i<3;i++){const sx=px+S*(.08+i*.3),w=S*.22,gr=c.createLinearGradient(sx,0,sx+w,0);gr.addColorStop(0,'#1f4430');gr.addColorStop(.4,'#6fae80');gr.addColorStop(1,'#1f4430');
        c.fillStyle=gr;c.fillRect(sx,py,w,S+.5);c.fillStyle='rgba(0,0,0,.35)';for(let k=0;k<2;k++)c.fillRect(sx,py+S*(.2+k*.45+r()*.1),w,1.6)}
      c.fillStyle='rgba(160,230,150,.25)';rot(c,px+S*(.2+r()*.6),py+S*.3,-.5,()=>{c.beginPath();c.ellipse(0,0,S*.2,S*.04,0,0,6.3);c.fill()});break;
    case 'coral':
      c.fillStyle='rgba(255,255,255,.05)';c.fillRect(px,py,S,S*.5);
      for(let i=0;i<3;i++){const bx=px+S*(.2+i*.3),col=['#ff8f7d','#ffb36b','#ff6f9a'][(x+y+i)%3];c.strokeStyle=col;c.lineWidth=S*.1;c.lineCap='round';
        c.beginPath();c.moveTo(bx,py+S*.95);c.lineTo(bx+(r()-.5)*6,py+S*.5);c.lineTo(bx+(r()-.5)*14,py+S*.2);c.stroke();
        c.fillStyle='#fff';c.globalAlpha=.55;c.beginPath();c.arc(bx+(r()-.5)*10,py+S*.2,S*.045,0,6.3);c.fill();c.globalAlpha=1}break;
    case 'dune':
      for(let i=0;i<5;i++){c.fillStyle=shade(T.w,(i%2?18:-4)+r()*10);c.fillRect(px,py+i*S/5,S+.5,S/5+.5)}
      c.strokeStyle='rgba(60,30,10,.4)';c.lineWidth=1.2;c.beginPath();c.moveTo(px+r()*S,py);c.lineTo(px+r()*S,py+S*.5);c.lineTo(px+r()*S,py+S);c.stroke();break;
    case 'ice':{
      const gi=c.createLinearGradient(px,py,px+S,py+S);gi.addColorStop(0,'#cfe6fb');gi.addColorStop(.5,'#8fb4d8');gi.addColorStop(1,'#bcd8f2');c.fillStyle=gi;c.fillRect(px,py,S+.5,S+.5);
      c.fillStyle='rgba(255,255,255,.38)';c.beginPath();c.moveTo(px+S*.1,py+S*.9);c.lineTo(px+S*.45,py+S*.1);c.lineTo(px+S*.6,py+S*.1);c.lineTo(px+S*.25,py+S*.9);c.fill();
      c.strokeStyle='rgba(255,255,255,.6)';c.lineWidth=1;c.beginPath();c.moveTo(px+S*(.3+r()*.4),py);c.lineTo(px+S*(.3+r()*.4),py+S);c.stroke();break}
    case 'star':
      for(let i=0;i<2;i++){const cx=px+S*(.3+i*.4),cy=py+S*(.4+r()*.3),gr=c.createLinearGradient(cx,cy-S*.3,cx,cy+S*.3);gr.addColorStop(0,'#d9ccff');gr.addColorStop(1,'#5a46c8');
        c.fillStyle=gr;c.shadowColor='#9a85ff';c.shadowBlur=8;c.beginPath();c.moveTo(cx,cy-S*.32);c.lineTo(cx+S*.13,cy);c.lineTo(cx,cy+S*.3);c.lineTo(cx-S*.13,cy);c.closePath();c.fill();c.shadowBlur=0}break;
    case 'leaf':
      for(let i=0;i<9;i++){c.fillStyle=['#ee7a3e','#c9531f','#8a3a14','#e9a13c'][r()*4|0];c.globalAlpha=.92;rot(c,px+r()*S,py+r()*S,r()*6,()=>{c.beginPath();c.ellipse(0,0,S*.2,S*.1,0,0,6.3);c.fill()})}
      c.globalAlpha=1;break;
  }
  c.globalAlpha=1;
}

function paintBase(c,lv,T,S){
  const W=lv.W,H=lv.H,R=rng(W*977+T.g.charCodeAt(0)*131),wall=(x,y)=>x<0||y<0||x>=W||y>=H||lv.g[y*W+x];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const px=x*S,py=y*S;c.fillStyle=shade(((x+y)&1)?T.f1:T.f2,(R()-.5)*9);c.fillRect(px,py,S+.5,S+.5);
    if(!lv.g[y*W+x])floorDetail(c,T,px,py,S,R);
  }
  // 牆的投影
  c.save();c.shadowColor='rgba(0,0,0,.65)';c.shadowBlur=S*.4;c.shadowOffsetX=S*.05;c.shadowOffsetY=S*.16;c.fillStyle='#000';
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(lv.g[y*W+x])c.fillRect(x*S,y*S,S,S);
  c.restore();
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(lv.g[y*W+x]){
    wallArt(c,T,x*S,y*S,S,R,x,y);
    if(!wall(x,y-1)){c.fillStyle='rgba(255,255,255,.2)';c.fillRect(x*S,y*S,S,2)}
    if(!wall(x,y+1)){c.fillStyle='rgba(0,0,0,.35)';c.fillRect(x*S,y*S+S-3,S,3)}
  }
  // 牆邊的環境遮蔽
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(!lv.g[y*W+x]){
    const px=x*S,py=y*S,e=S*.32;
    [[0,-1,px,py,0,py+e,px,py,S,e],[0,1,px,py+S,0,py+S-e,px,py+S-e,S,e],[-1,0,px,py,px+e,0,px,py,e,S],[1,0,px+S,py,px+S-e,0,px+S-e,py,e,S]].forEach(a=>{
      if(!wall(x+a[0],y+a[1]))return;
      const gr=a[0]?c.createLinearGradient(a[2],0,a[4],0):c.createLinearGradient(0,a[3],0,a[5]);
      gr.addColorStop(0,'rgba(0,0,0,.28)');gr.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gr;c.fillRect(a[6],a[7],a[8],a[9]);
    });
  }
}
const baseCache={key:'',cv:null};
function getBase(lv,th){
  const key=lv.key+'/'+th;if(baseCache.key===key)return baseCache.cv;
  const S=40,cv=document.createElement('canvas');cv.width=lv.W*S;cv.height=lv.H*S;
  paintBase(cv.getContext('2d'),lv,TH[th],S);baseCache.key=key;baseCache.cv=cv;return cv;
}

/* 已探索範圍的柔邊遮罩（以每格一像素存放，放大時由瀏覽器平滑處理） */
let maskCv=null,maskKey='',maskVer=-1,fogCv=null;
function getMask(lv,seen,ver){
  if(!maskCv||maskKey!==lv.key){maskCv=document.createElement('canvas');maskCv.width=lv.W;maskCv.height=lv.H;maskKey=lv.key;maskVer=-1}
  if(ver!==maskVer){
    const c=maskCv.getContext('2d'),id=c.createImageData(lv.W,lv.H);
    for(let i=0;i<seen.length;i++)id.data[i*4+3]=seen[i]?150:0;
    c.putImageData(id,0,0);maskVer=ver;
  }
  return maskCv;
}

function particles(ctx,cw,ch,T,t){
  const n=22;ctx.fillStyle=T.pc;
  for(let i=0;i<n;i++){
    const a=((i*9301+49297)%233280)/233280,b=((i*7919+13)%104729)/104729,sp=.012+a*.02;
    let x,y,r=1+b*2,al=.5;
    switch(T.p){
      case 'bubble':x=(a*cw+Math.sin(t/1800+i)*14)%cw;y=ch-((t*sp+b*ch)%(ch+20));r+=1;al=.3;break;
      case 'snow':x=(a*cw+Math.sin(t/1500+i)*20+t*.01)%cw;y=(t*sp*.8+b*ch)%ch;al=.7;break;
      case 'sand':x=(a*cw+t*sp*2)%cw;y=b*ch+Math.sin(t/900+i)*6;al=.25;r*=.8;break;
      case 'leaf':x=(a*cw+t*.015+Math.sin(t/1000+i)*12)%cw;y=(t*sp*.7+b*ch)%ch;r+=1;al=.6;break;
      case 'star':x=a*cw;y=b*ch;al=.2+.4*Math.abs(Math.sin(t/900+i*2));break;
      default:x=(a*cw+Math.sin(t/2200+i*3)*40+cw)%cw;y=(b*ch+Math.cos(t/2600+i*2)*30+ch)%ch;al=.2+.6*Math.abs(Math.sin(t/700+i));r+=.8;
    }
    ctx.globalAlpha=al;ctx.beginPath();ctx.arc(x,y,r,0,6.3);ctx.fill();
  }
  ctx.globalAlpha=1;
}

// o: {lv,S,seen,cur,ver,x0,y0,cols,rows,all,meK,t}
function drawMaze(ctx,cw,ch,o){
  const T=TH[o.S.th],lv=o.lv,t=o.t;
  const ts=Math.min(cw/o.cols,ch/o.rows),ox=(cw-ts*o.cols)/2,oy=(ch-ts*o.rows)/2;
  const sx=x=>ox+(x-o.x0+.5)*ts,sy=y=>oy+(y-o.y0+.5)*ts;
  ctx.globalAlpha=1;ctx.fillStyle=T.bg;ctx.fillRect(0,0,cw,ch);
  ctx.save();ctx.beginPath();ctx.rect(ox,oy,ts*o.cols,ts*o.rows);ctx.clip();
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(getBase(lv,o.S.th),ox-o.x0*ts,oy-o.y0*ts,lv.W*ts,lv.H*ts);
  const reveal=o.S.ph==='done';
  // 小怪獸的巡邏路線：走過的地方會留下淡淡的足跡，方便觀察規律
  (lv.mons||[]).forEach(m=>m.forEach(q=>{
    if(!reveal&&!o.seen[q[1]*lv.W+q[0]])return;
    ctx.fillStyle=MC[o.S.th];ctx.globalAlpha=.28;ctx.beginPath();ctx.arc(sx(q[0]),sy(q[1]),ts*.07,0,6.3);ctx.fill();ctx.globalAlpha=1;
  }));
  // 寶箱：與寶石同色的鑲邊，寶石放進去後箱內發光
  lv.targets.forEach((q,i)=>{
    const id=q[1]*lv.W+q[0];if(!reveal&&!o.seen[id])return;
    const b=o.S.b[i];drawChest(ctx,sx(q[0]),sy(q[1]),ts,BC[i],b&&b[0]===q[0]&&b[1]===q[1],t,i);
  });
  // 寶石：切面寶石，有投影與閃光
  (o.S.b||[]).forEach((q,i)=>{
    const id=q[1]*lv.W+q[0];if(!reveal&&!o.seen[id])return;
    drawGem(ctx,sx(q[0]),sy(q[1]),ts,BC[i],t,i,q[0]===lv.targets[i][0]&&q[1]===lv.targets[i][1]);
  });
  // 光影：全黑霧罩，挖出已探索（微亮）與玩家手電筒（全亮）
  const lights=(o.S.pl||[]).filter(p=>o.all||o.cur[p.y*lv.W+p.x]||p.k===o.meK);
  if(!reveal){
    if(!fogCv)fogCv=document.createElement('canvas');
    if(fogCv.width!==cw||fogCv.height!==ch){fogCv.width=cw;fogCv.height=ch}
    const f=fogCv.getContext('2d');f.globalCompositeOperation='source-over';f.clearRect(0,0,cw,ch);
    f.fillStyle=T.fog;f.fillRect(0,0,cw,ch);f.globalCompositeOperation='destination-out';f.imageSmoothingEnabled=true;
    f.drawImage(getMask(lv,o.seen,o.ver),ox-o.x0*ts,oy-o.y0*ts,lv.W*ts,lv.H*ts);
    for(const p of (o.S.pl||[])){
      const x=sx(p.x),y=sy(p.y),r=p.v*ts*(1.02+.02*Math.sin(t/240+p.c*2));
      const g=f.createRadialGradient(x,y,ts*.2,x,y,r);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.55,'rgba(0,0,0,.92)');g.addColorStop(.85,'rgba(0,0,0,.4)');g.addColorStop(1,'rgba(0,0,0,0)');
      f.fillStyle=g;f.fillRect(x-r,y-r,2*r,2*r);
    }
    ctx.drawImage(fogCv,0,0);
    ctx.globalCompositeOperation='lighter';
    for(const p of (o.S.pl||[])){
      const x=sx(p.x),y=sy(p.y),r=p.v*ts*.9,g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,'rgba(255,214,150,.2)');g.addColorStop(1,'rgba(255,214,150,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r);
    }
    ctx.globalCompositeOperation='source-over';
  }
  // 小怪獸：只在目前看得見的格子顯示
  (o.S.mo||[]).forEach((m,i)=>{
    if(!reveal&&!o.cur[m[1]*lv.W+m[0]])return;
    const r=o.mr&&o.mr[i]?o.mr[i]:{x:m[0],y:m[1]};
    drawMonster(ctx,o.S.th,sx(r.x),sy(r.y),ts,t,i);
  });
  // 玩家：提燈
  (o.S.pl||[]).forEach(p=>{
    if(!o.all&&!o.cur[p.y*lv.W+p.x])return;
    const cx=sx(p.x),cy=sy(p.y),r=ts*.3,me=p.k===o.meK;
    ctx.globalAlpha=(p.fz-(t-o.S.at))>0?.45+.2*Math.sin(t/150):1;
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(cx+r*.2,cy+r*.8,r,r*.38,0,0,6.3);ctx.fill();
    ctx.save();ctx.shadowColor=PC[p.c];ctx.shadowBlur=ts*.5;
    const g=ctx.createRadialGradient(cx-r*.3,cy-r*.3,r*.1,cx,cy,r);g.addColorStop(0,'#2a3f3d');g.addColorStop(1,'#0c1717');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,r,0,6.3);ctx.fill();ctx.restore();
    ctx.strokeStyle=PC[p.c];ctx.lineWidth=Math.max(2,ts*(me?.1:.07));
    if(p.m)ctx.setLineDash([ts*.12,ts*.08]);ctx.beginPath();ctx.arc(cx,cy,r,0,6.3);ctx.stroke();ctx.setLineDash([]);
    if(ts>14){ctx.fillStyle=PC[p.c];ctx.font='700 '+Math.round(ts*.3)+'px "Noto Sans TC",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText([...p.n][0]||'?',cx,cy+ts*.01)}
    ctx.globalAlpha=1;
  });
  ctx.restore();
  if(!o.all){
    const g=ctx.createRadialGradient(cw/2,ch/2,Math.min(cw,ch)*.36,cw/2,ch/2,Math.min(cw,ch)*.72);
    g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.5)');ctx.fillStyle=g;ctx.fillRect(0,0,cw,ch);
  }
  particles(ctx,cw,ch,T,t);
}

function drawChest(ctx,cx,cy,ts,col,home,t,i){
  const w=ts*.8,h=ts*.62,x=cx-w/2,y=cy-h/2+ts*.04,pulse=.7+.3*Math.sin(t/500+i);
  const rr=(a,b,c,d,r)=>{ctx.beginPath();if(ctx.roundRect)ctx.roundRect(a,b,c,d,r);else ctx.rect(a,b,c,d)};
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(cx+ts*.04,y+h+ts*.02,w*.55,ts*.09,0,0,6.3);ctx.fill();
  const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#8a5a30');g.addColorStop(1,'#4a2c14');
  ctx.fillStyle=g;rr(x,y+h*.3,w,h*.7,ts*.06);ctx.fill();
  ctx.strokeStyle='rgba(30,15,5,.6)';ctx.lineWidth=1;for(let k=1;k<3;k++){ctx.beginPath();ctx.moveTo(x,y+h*(.3+k*.23));ctx.lineTo(x+w,y+h*(.3+k*.23));ctx.stroke()}
  if(home){
    ctx.shadowColor=col;ctx.shadowBlur=ts*.9;ctx.fillStyle=col;ctx.globalAlpha=.85;ctx.beginPath();ctx.ellipse(cx,y+h*.32,w*.42,h*.2,0,0,6.3);ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1;
    ctx.fillStyle='#6b4120';rr(x+w*.04,y-h*.14,w*.92,h*.2,ts*.05);ctx.fill();
  }else{
    const lg=ctx.createLinearGradient(0,y,0,y+h*.38);lg.addColorStop(0,'#a06a38');lg.addColorStop(1,'#6b4120');
    ctx.fillStyle=lg;rr(x,y,w,h*.38,[ts*.12,ts*.12,ts*.02,ts*.02]);ctx.fill();
  }
  ctx.fillStyle=col;ctx.globalAlpha=.3;ctx.fillRect(x,y,w,h);ctx.globalAlpha=.95;ctx.fillRect(x,y+h*.3,w,h*.1);ctx.fillRect(x+w*.1,y+(home?h*.3:0),w*.1,h*(home?.7:1));ctx.fillRect(x+w*.8,y+(home?h*.3:0),w*.1,h*(home?.7:1));
  ctx.globalAlpha=1;
  ctx.shadowColor=col;ctx.shadowBlur=ts*(home?.2:.5)*pulse;ctx.fillStyle=col;ctx.beginPath();ctx.arc(cx,y+h*.4,ts*.065,0,6.3);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(cx-ts*.012,y+h*.4,ts*.024,ts*.06);
  ctx.restore();
}
function drawGem(ctx,cx,cy,ts,col,t,i,home){
  const r=ts*.34,pts=[];
  for(let k=0;k<8;k++){const a=k*Math.PI/4+Math.PI/8;pts.push([Math.cos(a)*r,Math.sin(a)*r*.92])}
  ctx.save();ctx.translate(cx,cy-(home?ts*.06:0));
  ctx.fillStyle='rgba(0,0,0,.38)';ctx.beginPath();ctx.ellipse(r*.2,r*.95,r*.95,r*.32,0,0,6.3);ctx.fill();
  ctx.shadowColor=col;ctx.shadowBlur=ts*(home?.8:.35);
  const g=ctx.createLinearGradient(-r,-r,r,r);g.addColorStop(0,'#fff');g.addColorStop(.3,col);g.addColorStop(1,shade(col,-120));
  ctx.fillStyle=g;ctx.beginPath();pts.forEach((p,k)=>k?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();ctx.shadowBlur=0;
  const ir=r*.5;ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=Math.max(1,ts*.025);
  ctx.beginPath();pts.forEach((p,k)=>{const a=k*Math.PI/4+Math.PI/4;ctx.moveTo(p[0],p[1]);ctx.lineTo(Math.cos(a)*ir,Math.sin(a)*ir*.92)});ctx.stroke();
  ctx.beginPath();for(let k=0;k<8;k++){const a=k*Math.PI/4+Math.PI/4,x=Math.cos(a)*ir,y=Math.sin(a)*ir*.92;k?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.28)';ctx.beginPath();ctx.moveTo(-r*.7,-r*.3);ctx.lineTo(-r*.2,-r*.8);ctx.lineTo(r*.2,-r*.6);ctx.lineTo(-r*.2,-r*.1);ctx.fill();
  const sp=Math.max(0,Math.sin(t/700+i*1.7));
  if(sp>.7){ctx.strokeStyle='#fff';ctx.globalAlpha=(sp-.7)/.3;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(r*.05,-r*.55);ctx.lineTo(r*.75,-r*.55);ctx.moveTo(r*.4,-r*.9);ctx.lineTo(r*.4,-r*.2);ctx.stroke();ctx.globalAlpha=1}
  ctx.restore();
}
const MC=['#d9f27a','#ff9ad0','#f0c070','#ffffff','#b9a0ff','#ff8a3d'];
function drawMonster(ctx,th,cx,cy,ts,t,i){
  const r=ts*.34,col=MC[th],bob=Math.sin(t/300+i*2)*ts*.04;
  ctx.save();ctx.translate(cx,cy+bob);
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(0,r*.95-bob,r*.9,r*.28,0,0,6.3);ctx.fill();
  ctx.shadowColor=col;ctx.shadowBlur=ts*.8;
  const gr=ctx.createRadialGradient(-r*.3,-r*.4,r*.1,0,0,r*1.1);gr.addColorStop(0,'#fff');gr.addColorStop(.35,col);gr.addColorStop(1,shade(col,-90));
  ctx.fillStyle=gr;ctx.strokeStyle=col;ctx.lineWidth=Math.max(1.5,ts*.05);ctx.lineCap='round';
  switch(th){
    case 0: // 螢火蟲獸
      ctx.globalAlpha=.55;ctx.fillStyle='#e8ffd0';ctx.beginPath();ctx.ellipse(-r*.7,-r*.5,r*.55,r*.25,-.6+Math.sin(t/60)*.15,0,6.3);ctx.ellipse(r*.7,-r*.5,r*.55,r*.25,.6-Math.sin(t/60)*.15,0,6.3);ctx.fill();ctx.globalAlpha=1;
      ctx.fillStyle=gr;ctx.beginPath();ctx.ellipse(0,0,r*.85,r,0,0,6.3);ctx.fill();
      ctx.fillStyle='#fff7a8';ctx.beginPath();ctx.arc(0,r*.55,r*.38,0,6.3);ctx.fill();break;
    case 1: // 水母
      ctx.beginPath();ctx.arc(0,-r*.1,r,3.14,6.28);ctx.lineTo(r,r*.1);ctx.lineTo(-r,r*.1);ctx.closePath();ctx.fill();
      for(let k=-2;k<=2;k++){ctx.beginPath();ctx.moveTo(k*r*.38,r*.1);ctx.bezierCurveTo(k*r*.38+Math.sin(t/260+k)*r*.3,r*.5,k*r*.38-Math.sin(t/260+k)*r*.3,r*.8,k*r*.38+Math.sin(t/200+k)*r*.2,r*1.1);ctx.stroke()}break;
    case 2: // 沙影
      ctx.beginPath();ctx.ellipse(0,0,r,r*.75,0,0,6.3);ctx.fill();
      ctx.beginPath();ctx.moveTo(r*.8,0);ctx.bezierCurveTo(r*1.5,-r*.2,r*1.3,-r*1.2,r*.5,-r*1.1);ctx.stroke();
      for(let k=-1;k<=1;k++){ctx.beginPath();ctx.moveTo(k*r*.5,r*.5);ctx.lineTo(k*r*.7,r*.95);ctx.stroke()}break;
    case 3: // 雪靈
      for(let k=0;k<8;k++){ctx.beginPath();ctx.arc(Math.cos(k*.785)*r*.78,Math.sin(k*.785)*r*.78,r*.4,0,6.3);ctx.fill()}
      ctx.beginPath();ctx.arc(0,0,r*.9,0,6.3);ctx.fill();
      ctx.beginPath();ctx.moveTo(-r*.7,-r*.7);ctx.lineTo(-r*.5,-r*1.25);ctx.lineTo(-r*.2,-r*.9);ctx.moveTo(r*.7,-r*.7);ctx.lineTo(r*.5,-r*1.25);ctx.lineTo(r*.2,-r*.9);ctx.stroke();break;
    case 4: // 星塵獸
      ctx.beginPath();ctx.arc(0,0,r,0,6.3);ctx.fill();ctx.fillStyle='#fff';
      for(let k=0;k<5;k++){const a=t/700+k*1.256;ctx.beginPath();ctx.arc(Math.cos(a)*r*1.3,Math.sin(a)*r*1.3,r*.12,0,6.3);ctx.fill()}break;
    default: // 楓林狐影
      ctx.beginPath();ctx.ellipse(r*.8,r*.3,r*.55,r*.3,-.5,0,6.3);ctx.fill();
      ctx.beginPath();ctx.arc(0,0,r,0,6.3);ctx.fill();
      ctx.beginPath();ctx.moveTo(-r*.8,-r*.4);ctx.lineTo(-r*.55,-r*1.3);ctx.lineTo(-r*.1,-r*.8);ctx.moveTo(r*.8,-r*.4);ctx.lineTo(r*.55,-r*1.3);ctx.lineTo(r*.1,-r*.8);ctx.fill();
  }
  ctx.shadowBlur=0;
  for(const sx of [-1,1]){ctx.fillStyle='#1a1a24';ctx.beginPath();ctx.arc(sx*r*.34,-r*.08,r*.17,0,6.3);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx*r*.34-r*.05,-r*.14,r*.06,0,6.3);ctx.fill()}
  ctx.restore();
}

function fitCanvas(cv){
  const r=cv.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2);
  const w=Math.max(2,Math.round(r.width*d)),h=Math.max(2,Math.round(r.height*d));
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
  return [w,h];
}
