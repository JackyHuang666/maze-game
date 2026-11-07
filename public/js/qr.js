/* ===== 簡易 QR Code 產生器（位元組模式、容錯 M、版本 1–6） ===== */
const QRT=[null,
 {n:26,e:10,b:1,d:16,a:[]},{n:44,e:16,b:1,d:28,a:[6,18]},{n:70,e:26,b:1,d:44,a:[6,22]},
 {n:100,e:18,b:2,d:32,a:[6,26]},{n:134,e:24,b:2,d:43,a:[6,30]},{n:172,e:16,b:4,d:27,a:[6,34]}];
function qrEncode(text){
  const bytes=[...new TextEncoder().encode(text)];
  let v=1;while(v<=6&&bytes.length>QRT[v].b*QRT[v].d-2)v++;
  if(v>6)return null;
  const T=QRT[v],cap=T.b*T.d,size=17+4*v;
  // 資料位元
  const bits=[];const put=(val,n)=>{for(let i=n-1;i>=0;i--)bits.push((val>>>i)&1)};
  put(4,4);put(bytes.length,8);bytes.forEach(b=>put(b,8));
  for(let i=0;i<4&&bits.length<cap*8;i++)bits.push(0);
  while(bits.length%8)bits.push(0);
  const data=[];for(let i=0;i<bits.length;i+=8){let x=0;for(let j=0;j<8;j++)x=x<<1|bits[i+j];data.push(x)}
  for(let p=0;data.length<cap;p++)data.push(p%2?0x11:0xEC);
  // Reed-Solomon
  const exp=new Array(512),log=new Array(256);let x=1;
  for(let i=0;i<255;i++){exp[i]=x;log[x]=i;x<<=1;if(x&256)x^=0x11D}
  for(let i=255;i<512;i++)exp[i]=exp[i-255];
  const mul=(a,b)=>a&&b?exp[log[a]+log[b]]:0;
  let gen=[1];
  for(let i=0;i<T.e;i++){const ng=new Array(gen.length+1).fill(0);gen.forEach((c,j)=>{ng[j]^=c;ng[j+1]^=mul(c,exp[i])});gen=ng}
  const blocks=[],ecs=[];
  for(let b=0;b<T.b;b++){
    const blk=data.slice(b*T.d,(b+1)*T.d),rem=new Array(T.e).fill(0);
    for(const c of blk){const f=c^rem[0];rem.shift();rem.push(0);for(let j=0;j<T.e;j++)rem[j]^=mul(gen[j+1],f)}
    blocks.push(blk);ecs.push(rem);
  }
  const out=[];
  for(let i=0;i<T.d;i++)blocks.forEach(b=>out.push(b[i]));
  for(let i=0;i<T.e;i++)ecs.forEach(b=>out.push(b[i]));
  // 矩陣
  const M=Array.from({length:size},()=>new Array(size).fill(false)),F=Array.from({length:size},()=>new Array(size).fill(false));
  const set=(px,py,d)=>{if(px>=0&&py>=0&&px<size&&py<size){M[py][px]=d;F[py][px]=true}};
  for(let i=0;i<size;i++){set(6,i,i%2===0);set(i,6,i%2===0)}
  for(const [cx,cy] of [[3,3],[size-4,3],[3,size-4]])
    for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy));set(cx+dx,cy+dy,d!==2&&d!==4)}
  if(T.a.length){const c=T.a[1];for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(c+dx,c+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1)}
  const fmt=mask=>{
    let rem=mask;for(let i=0;i<10;i++)rem=(rem<<1)^((rem>>>9)*0x537);
    const f=((mask<<10)|rem)^0x5412,bit=i=>((f>>>i)&1)!==0;
    for(let i=0;i<=5;i++)set(8,i,bit(i));set(8,7,bit(6));set(8,8,bit(7));set(7,8,bit(8));
    for(let i=9;i<15;i++)set(14-i,8,bit(i));
    for(let i=0;i<8;i++)set(size-1-i,8,bit(i));
    for(let i=8;i<15;i++)set(8,size-15+i,bit(i));
    set(8,size-8,true);
  };
  fmt(0);
  // 放資料（之字形）
  const base=M.map(r=>r.slice());let k=0;
  for(let right=size-1;right>=1;right-=2){
    if(right===6)right=5;
    for(let vert=0;vert<size;vert++)for(let j=0;j<2;j++){
      const px=right-j,up=((right+1)&2)===0,py=up?size-1-vert:vert;
      if(!F[py][px]&&k<out.length*8){base[py][px]=((out[k>>>3]>>>(7-(k&7)))&1)!==0;k++}
    }
  }
  const MK=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,(x,y)=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,
    (x,y)=>x*y%2+x*y%3===0,(x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];
  const penalty=g=>{
    let p=0;const line=a=>{let run=1;for(let i=1;i<a.length;i++){if(a[i]===a[i-1]){run++;if(run===5)p+=3;else if(run>5)p++}else run=1}
      const s=a.map(b=>b?1:0).join('');for(const pat of ['10111010000','00001011101']){let i=-1;while((i=s.indexOf(pat,i+1))>=0)p+=40}};
    for(let y=0;y<size;y++)line(g[y]);for(let x=0;x<size;x++)line(g.map(r=>r[x]));
    for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++)if(g[y][x]===g[y][x+1]&&g[y][x]===g[y+1][x]&&g[y][x]===g[y+1][x+1])p+=3;
    let dark=0;g.forEach(r=>r.forEach(b=>{if(b)dark++}));p+=Math.floor(Math.abs(dark*20-size*size*10)/(size*size))*10;
    return p;
  };
  let best=null,bp=1e9;
  for(let m=0;m<8;m++){
    const g=base.map(r=>r.slice());
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!F[y][x]&&MK[m](x,y))g[y][x]=!g[y][x];
    // 格式資訊依 mask 重寫
    const save=M.map(r=>r.slice());fmt(m);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(F[y][x])g[y][x]=M[y][x];
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)M[y][x]=save[y][x];
    const pn=penalty(g);if(pn<bp){bp=pn;best=g}
  }
  return {size,get:(x,y)=>best[y][x]};
}
function drawQR(cv,text,px){
  const q=qrEncode(text);if(!q||!cv)return false;
  const quiet=4,n=q.size+quiet*2;cv.width=cv.height=n*px;
  const c=cv.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,n*px,n*px);c.fillStyle='#0b1a1a';
  for(let y=0;y<q.size;y++)for(let x=0;x<q.size;x++)if(q.get(x,y))c.fillRect((x+quiet)*px,(y+quiet)*px,px,px);
  return true;
}
