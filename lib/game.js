/* 迷宮尋寶：伺服器與瀏覽器共用的遊戲規則（地圖產生、推／抓移動、視野）。
   在 Node 以 require('./game') 載入；在瀏覽器以 <script> 載入後，下列名稱會成為全域變數。 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else Object.assign(root,api);
})(typeof self!=='undefined'?self:this,function(){
'use strict';
/* ===== 資料：環境、難度、顏色 ===== */
const D4=[[0,-1],[0,1],[-1,0],[1,0]];
const TH=[
 {n:'竹林',bg:'#0b1a14',f1:'#2d4c3b',f2:'#31523f',w:'#13271e',hi:'#6fae80',g:'stalk',p:'firefly',pc:'#d8f5a0'},
 {n:'深海珊瑚',bg:'#06202c',f1:'#164c60',f2:'#1a566c',w:'#0a2a3a',hi:'#ff8f7d',g:'coral',p:'bubble',pc:'#bfeaf5'},
 {n:'沙漠綠洲',bg:'#2b1d10',f1:'#c9a36b',f2:'#d1ad77',w:'#8c5c2c',hi:'#ecca90',g:'dune',p:'sand',pc:'#f6e2b8'},
 {n:'雪原極光',bg:'#101c29',f1:'#c8d8e6',f2:'#d2e0ec',w:'#6c88a6',hi:'#eef7ff',g:'ice',p:'snow',pc:'#ffffff'},
 {n:'星夜',bg:'#090a1c',f1:'#2a2a5c',f2:'#30306a',w:'#11112c',hi:'#bcaaff',g:'star',p:'star',pc:'#e8e2ff'},
 {n:'秋日楓林',bg:'#1d110c',f1:'#6d4b34',f2:'#765139',w:'#3a1c13',hi:'#ee7a3e',g:'leaf',p:'leaf',pc:'#f5a45f'}
];
const LV=[
 {n:'入門',c:6,b:2,m:1,ms:850,v:5.2,br:.14,rooms:3,pulls:9},
 {n:'平靜',c:9,b:3,m:2,ms:720,v:4.4,br:.1,rooms:5,pulls:13},
 {n:'專注',c:12,b:4,m:3,ms:600,v:3.6,br:.08,rooms:8,pulls:17},
 {n:'深度',c:15,b:5,m:4,ms:500,v:3.0,br:.06,rooms:12,pulls:22}
];
const BC=['#ff6b6b','#ffd166','#5ccbff','#a58cff','#6fe08a','#ff9be0'];
const PC=['#f2f2f2','#b8f1d8','#f7c6a3','#c7d2ff','#f5e08f','#e3b6e8'];
const BREATH=8000;
// 難度決定基準視野，每位玩家再依顏色槽位上下浮動，鼓勵彼此報路
const VF=[1.2,.85,1,1.1,.9,.95];
const visOf=(li,c)=>Math.round(LV[li].v*VF[c%6]*10)/10;

/* ===== 可重現的迷宮產生器（所有裝置用同一個 seed 得到相同地圖） ===== */
function rng(s){return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

function reach(g,W,H,from,block){
  const v=new Uint8Array(W*H);const q=[from];v[from]=1;
  for(let h=0;h<q.length;h++){const c=q[h],x=c%W,y=c/W|0;
    for(const d of D4){const nx=x+d[0],ny=y+d[1];if(nx<0||ny<0||nx>=W||ny>=H)continue;const n=ny*W+nx;
      if(v[n]||g[n]||(block instanceof Set?block.has(n):n===block))continue;v[n]=1;q.push(n)}}
  v.order=q;return v;
}

function gen(seed,li){
  const L=LV[li],c=L.c,W=2*c+1,H=W,R=rng(seed),g=new Uint8Array(W*H).fill(1);
  const st=[[1,1]];g[W+1]=0;
  while(st.length){
    const [x,y]=st[st.length-1],nb=[];
    for(const d of D4){const nx=x+d[0]*2,ny=y+d[1]*2;if(nx>0&&ny>0&&nx<W-1&&ny<H-1&&g[ny*W+nx])nb.push(d)}
    if(!nb.length){st.pop();continue}
    const d=nb[R()*nb.length|0];
    g[(y+d[1])*W+x+d[0]]=0;g[(y+d[1]*2)*W+x+d[0]*2]=0;st.push([x+d[0]*2,y+d[1]*2]);
  }
  // 打通部分牆面形成環路，讓路徑不只一條
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
    if(!g[y*W+x])continue;
    const horiz=(x%2===0&&y%2===1),vert=(x%2===1&&y%2===0);
    if(horiz&&!g[y*W+x-1]&&!g[y*W+x+1]&&R()<L.br)g[y*W+x]=0;
    else if(vert&&!g[(y-1)*W+x]&&!g[(y+1)*W+x]&&R()<L.br)g[y*W+x]=0;
  }
  // 開幾個 3×3 小廣場，球才有轉彎的空間
  for(let k=0;k<L.rooms;k++){
    const cx=1+2*(R()*c|0),cy=1+2*(R()*c|0);
    for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const x=cx+i,y=cy+j;if(x>0&&y>0&&x<W-1&&y<H-1)g[y*W+x]=0}
  }
  const spawn=W+1;
  const free=(x,y)=>x>0&&y>0&&x<W-1&&y<H-1&&!g[y*W+x];
  const floors=[];for(let i=0;i<g.length;i++)if(!g[i])floors.push(i);
  // 寶石與寶箱：先決定寶箱位置，再從「全部歸位」的狀態開始，用遊戲本身的推、抓規則隨機走若干步。
  // 推與抓互為逆操作，所以走出來的任何局面都一定能走回去，單人也一定有解。
  const used=new Set([spawn]),targets=[];
  for(let k=0;k<L.b;k++){
    let t=-1;
    for(let tr=0;tr<300;tr++){
      const c=floors[R()*floors.length|0];
      if(used.has(c))continue;
      if(c%W+(c/W|0)<W*.55&&tr<250)continue;
      t=c;break;
    }
    if(t<0)do{t=floors[R()*floors.length|0]}while(used.has(t));
    used.add(t);targets.push([t%W,t/W|0]);
  }
  const lvl={W,H,g};
  let best=null,bestScore=-1;
  for(let at=0;at<30;at++){
    const st={pl:[{k:'s',x:0,y:0}],b:targets.map(q=>q.slice()),mo:[]};
    let pp=null;
    for(const d of D4){const x=targets[0][0]+d[0],y=targets[0][1]+d[1];if(free(x,y)&&!st.b.some(b=>b[0]===x&&b[1]===y)){pp=[x,y];break}}
    if(!pp)continue;
    st.pl[0].x=pp[0];st.pl[0].y=pp[1];
    let last=null;const steps=L.pulls*L.b*2;
    for(let s=0;s<steps;s++){
      const pl=st.pl[0],gset=new Set(st.b.map(b=>b[1]*W+b[0])),vis=reach(g,W,H,pl.y*W+pl.x,gset),opts=[];
      st.b.forEach((b,bi)=>{for(let di=0;di<4;di++){
        const d=D4[di];
        for(const mode of [0,1]){
          const qx=mode?b[0]+d[0]:b[0]-d[0],qy=mode?b[1]+d[1]:b[1]-d[1];
          if(!free(qx,qy)||!vis[qy*W+qx])continue;
          const tmp={pl:[{k:'s',x:qx,y:qy}],b:st.b.map(a=>a.slice()),mo:[]};
          if(tryMove(lvl,tmp,'s',di,mode)&&(tmp.b[bi][0]!==b[0]||tmp.b[bi][1]!==b[1]))opts.push({bi,di,mode,tmp});
        }}});
      if(!opts.length)break;
      const same=last?opts.filter(o=>o.bi===last.bi&&o.di===last.di):[];
      const o=(same.length&&R()<.6)?same[R()*same.length|0]:opts[R()*opts.length|0];
      st.pl=o.tmp.pl;st.b=o.tmp.b;last=o;
    }
    const gset=new Set(st.b.map(b=>b[1]*W+b[0]));
    if(gset.has(spawn)||gset.size<st.b.length)continue;
    if(!reach(g,W,H,spawn,gset)[st.pl[0].y*W+st.pl[0].x])continue;
    if(st.b.some((b,i)=>b[0]===targets[i][0]&&b[1]===targets[i][1]))continue;
    let score=0;st.b.forEach((b,i)=>{score+=Math.abs(b[0]-targets[i][0])+Math.abs(b[1]-targets[i][1])});
    if(score>bestScore){bestScore=score;best=st.b}
  }
  const balls=best?best.map(b=>b.slice()):targets.map(q=>[q[0],q[1]]);
  // 小怪獸：各沿一段固定路徑來回巡邏，路徑避開出生點附近
  const mons=[],mused=new Set();
  for(let k=0;k<L.m;k++){
    let best=null;
    for(let tr=0;tr<80&&!best;tr++){
      const s0=floors[R()*floors.length|0];
      if(s0%W+(s0/W|0)<10||mused.has(s0))continue;
      const path=[s0],inP=new Set([s0]),len=5+(R()*4|0);let dirp=-1;
      while(path.length<len){
        const c=path[path.length-1],cx=c%W,cy=c/W|0,opts=[];
        for(let di=0;di<4;di++){const nx=cx+D4[di][0],ny=cy+D4[di][1],n=ny*W+nx;if(free(nx,ny)&&!inP.has(n)&&!mused.has(n)&&nx+ny>=10)opts.push(di)}
        if(!opts.length)break;
        const di=(opts.includes(dirp)&&R()<.7)?dirp:opts[R()*opts.length|0];dirp=di;
        const n=(cy+D4[di][1])*W+cx+D4[di][0];path.push(n);inP.add(n);
      }
      if(path.length>=4)best=path;
    }
    if(best){best.forEach(i=>mused.add(i));mons.push(best.map(i=>[i%W,i/W|0]))}
  }
  return {W,H,g,balls,targets,spawn,v:L.v,mons,key:''};
}

/* ===== 遊戲規則 ===== */
// 移動玩家。mode 0＝推：走向球就把球推走；mode 1＝抓：球在身後時，往反方向走會把球拖著走
function tryMove(lv,S,k,d,mode){
  const p=S.pl.find(q=>q.k===k);if(!p)return false;
  const dx=D4[d][0],dy=D4[d][1],nx=p.x+dx,ny=p.y+dy;
  if(lv.g[ny*lv.W+nx])return false;
  if(S.pl.some(q=>q!==p&&q.x===nx&&q.y===ny))return false;
  const bi=S.b.findIndex(b=>b[0]===nx&&b[1]===ny);
  if(mode){
    if(bi>=0)return false; // 抓的時候前方有球不會推它
    const pi=S.b.findIndex(b=>b[0]===p.x-dx&&b[1]===p.y-dy);
    if(pi>=0)S.b[pi]=[p.x,p.y];
    p.x=nx;p.y=ny;return true;
  }
  if(bi>=0){
    const bx=nx+dx,by=ny+dy;
    if(lv.g[by*lv.W+bx]||S.b.some(b=>b[0]===bx&&b[1]===by)||S.pl.some(q=>q.x===bx&&q.y===by)||(S.mo&&S.mo.some(m=>m[0]===bx&&m[1]===by)))return false;
    S.b[bi]=[bx,by];
  }
  p.x=nx;p.y=ny;return true;
}
const allHome=(lv,b)=>b.every((q,i)=>q[0]===lv.targets[i][0]&&q[1]===lv.targets[i][1]);

// 離起點最近的空位
function spawnSpot(lv,pl,b){
  const v=reach(lv.g,lv.W,lv.H,lv.spawn,-1);
  for(const i of v.order){const x=i%lv.W,y=i/lv.W|0;
    if(!pl.some(p=>p.x===x&&p.y===y)&&!b.some(q=>q[0]===x&&q[1]===y))return [x,y]}
  return [1,1];
}

// 視野：以玩家為中心的圓形範圍；seen 是全隊累積探索，cur 是此刻看得見
function mark(seen,lv,x,y,v,cur){
  const r=Math.ceil(v);
  for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++){
    const X=x+i,Y=y+j;if(X<0||Y<0||X>=lv.W||Y>=lv.H)continue;
    if(i*i+j*j<=v*v+.5){const id=Y*lv.W+X;seen[id]=1;if(cur)cur[id]=1}
  }
}
return {D4,TH,LV,BC,PC,BREATH,VF,visOf,rng,reach,gen,tryMove,allHome,spawnSpot,mark};
});
