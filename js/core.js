/* Shared model: game rules, maths, strategies, forecast and popularity scoring.
   Loaded as a plain <script> in the browser and with require() by the nightly scripts. */
/* ================= GAMES ================= */
const GAMES={
 lotto:{label:"Lotto",name:"Lotto",N:52,K:6,type:"same",price:5,jackpot:17000000,sold:4000000,
  prizes:{2:250000,3:56591,4:4000,5:200,6:200,7:30,8:20},
  prizeNote:"Divisions 4–8 and the Div 3 default come from the 26 Sep 2026 Lotto payout. Div 2 is an estimate.",
  about:"6 numbers from 1–52 plus a bonus ball, Wednesdays and Saturdays. The range changed from 58 to 52 balls on 3 June 2026."},
 plus1:{label:"Lotto Plus",name:"Lotto Plus 1",N:52,K:6,type:"same",price:2.5,jackpot:3000000,sold:2500000,
  prizes:{2:150000,3:26111,4:2000,5:100,6:100,7:15,8:10},
  prizeNote:"Div 3–8 defaults come from the 26 Sep 2026 Lotto Plus 1 payout. Div 2 is an estimate.",
  about:"A separate 6/52 draw on the same board as Lotto, with its own ball machine."},
 plus2:{label:"Lotto Plus 2",name:"Lotto 5 Max",N:52,K:6,type:"same",price:2.5,jackpot:4500000,sold:2000000,
  prizes:{2:268070,3:22339,4:2000,5:100,6:100,7:15,8:10},
  prizeNote:"Defaults come from the 26 Sep 2026 Lotto 5 Max payout.",
  about:"Lotto Plus 2 was renamed Lotto 5 Max in June 2026. Same 6/52 format, third draw on the Lotto board."},
 daily:{label:"Daily Lotto",name:"Daily Lotto",N:36,K:5,type:"none",price:3,jackpot:300000,sold:1000000,
  prizes:{2:285,3:19.5,4:5},
  prizeNote:"Daily Lotto prizes are shared pools. Div 2–4 defaults are typical 2025 payouts, and the jackpot is a recent estimate; edit them from a current payout.",
  about:"5 numbers from 1–36, drawn every evening, no bonus ball."},
 dailyplus:{label:"Daily Lotto Plus",name:"Daily Lotto Plus",N:36,K:5,type:"none",price:3,jackpot:100000,sold:500000,
  prizes:{2:150,3:10,4:3},retired:true,
  prizeNote:"This game no longer runs, so prize defaults are placeholders.",
  about:"Discontinued in June 2026 under the new operator. The official site no longer publishes it, so there is no built-in data: import historical draws in the Draw data tab to analyse it."},
 pb:{label:"Powerball",name:"PowerBall",N:50,K:5,type:"sep",B:16,price:10,jackpot:65000000,sold:6000000,
  prizes:{2:150000,3:15000,4:2000,5:500,6:100,7:100,8:20,9:10},
  prizeNote:"Fixed-tier defaults use the published PowerBall prize ladder; Div 2 and 3 are estimates. Check a current payout, since prizes changed with the June 2026 rules.",
  about:"5 numbers from 1–50 plus a PowerBall from 1–16, Tuesdays and Fridays. The PowerBall range dropped from 20 to 16 in June 2026."},
 pbx:{label:"Powerball Plus",name:"PowerBall Xtra",N:50,K:5,type:"sep",B:16,price:5,jackpot:5000000,sold:3000000,
  prizes:{2:75000,3:7500,4:1000,5:250,6:50,7:50,8:10,9:5},
  prizeNote:"Defaults are half the PowerBall ladder and are estimates. Edit them from a current payout.",
  about:"PowerBall Plus is now called PowerBall Xtra: a second 5/50 + 1/16 draw on the same board."}
};
// Draw data lives in data/draws.js (browser) or data/draws.json (Node), refreshed nightly from the official results.
function setSeeds(draws){for(const [id,g] of Object.entries(GAMES))g.seed=((draws||{})[id]||[]).map(([d,n,b])=>({d,n:n.slice().sort((x,y)=>x-y),b:b==null?null:b,src:"official"}));}
for(const [id,g] of Object.entries(GAMES)){g.id=id;
 g.divs=g.type==="same"?[[6,null],[5,1],[5,0],[4,1],[4,0],[3,1],[3,0],[2,1]]
  :g.type==="sep"?[[5,1],[5,0],[4,1],[4,0],[3,1],[3,0],[2,1],[1,1],[0,1]]
  :[[5,null],[4,null],[3,null],[2,null]];}
setSeeds(typeof window!=="undefined"&&window.SALAB_DATA?window.SALAB_DATA.draws:null);

/* ================= MATH ================= */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
function hashStr(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function comb(n,k){if(k<0||k>n)return 0;k=Math.min(k,n-k);let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return Math.round(r);}
function lnGamma(z){const c=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if(z<0.5)return Math.log(Math.PI/Math.sin(Math.PI*z))-lnGamma(1-z);z-=1;let x=c[0];for(let i=1;i<9;i++)x+=c[i]/(z+i);const t=z+7.5;return 0.5*Math.log(2*Math.PI)+(z+0.5)*Math.log(t)-t+Math.log(x);}
function gammaQ(a,x){if(x<=0)return 1;
  if(x<a+1){let sum=1/a,del=sum,ap=a;for(let n=0;n<1000;n++){ap+=1;del*=x/ap;sum+=del;if(Math.abs(del)<Math.abs(sum)*1e-15)break;}return Math.max(0,1-sum*Math.exp(-x+a*Math.log(x)-lnGamma(a)));}
  const tiny=1e-300;let b=x+1-a,c=1/tiny,d=1/b,h=d;
  for(let i=1;i<1000;i++){const an=-i*(i-a);b+=2;d=an*d+b;if(Math.abs(d)<tiny)d=tiny;c=b+an/c;if(Math.abs(c)<tiny)c=tiny;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<1e-15)break;}
  return Math.exp(-x+a*Math.log(x)-lnGamma(a))*h;}
const chi2p=(x,df)=>gammaQ(df/2,x/2);
function erfc(x){const z=Math.abs(x),t=1/(1+0.5*z);const r=t*Math.exp(-z*z-1.26551223+t*(1.00002368+t*(0.37409196+t*(0.09678418+t*(-0.18628806+t*(0.27886807+t*(-1.13520398+t*(1.48851587+t*(-0.82215223+t*0.17087277)))))))));return x>=0?r:2-r;}
const pTwo=z=>erfc(Math.abs(z)/Math.SQRT2);
function randomDraw(rng,N,K){const a=[];for(let i=1;i<=N;i++)a.push(i);for(let i=0;i<K;i++){const j=i+Math.floor(rng()*(N-i));[a[i],a[j]]=[a[j],a[i]];}return a.slice(0,K).sort((x,y)=>x-y);}
function pct(a,q){const s=a.slice().sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.max(0,Math.round(q*(s.length-1))))];}

function divisions(g){const{N,K}=g,total=comb(N,K),rest=N-K,pm=m=>comb(K,m)*comb(rest,K-m)/total;
  return g.divs.map(([m,b],i)=>{let f=1,label;
    if(g.type==="same"){f=b===null?1:b?(K-m)/rest:1-(K-m)/rest;label=m+(b?" + bonus":" numbers");}
    else if(g.type==="sep"){f=b?1/g.B:(g.B-1)/g.B;label=(m?m+(b?" + PowerBall":" numbers"):"PowerBall only");}
    else label=m+" numbers";
    return{id:i+1,m,b,label,p:pm(m)*f};});}
function divisionOf(g,m,hb){for(let i=0;i<g.divs.length;i++){const[dm,db]=g.divs[i];if(dm===m&&(db===null||db===(hb?1:0)))return i+1;}return 0;}

function counts(draws,N,key){const c=new Array(N+1).fill(0);for(const d of draws)for(const x of (key?[d[key]]:d.n))if(x!=null)c[x]++;return c;}
function chiStat(c,n,N,K){const E=n*K/N;let s=0;for(let i=1;i<=N;i++)s+=(c[i]-E)**2/E;return s;}
function chiTest(draws,N,K,seed){const n=draws.length,c=counts(draws,N),raw=chiStat(c,n,N,K),adj=raw*(N-1)/(N-K);
  const sims=n>400?1500:4000,rng=mulberry32(seed);let ge=0;
  for(let s=0;s<sims;s++){const cc=new Array(N+1).fill(0);for(let i=0;i<n;i++)for(const x of randomDraw(rng,N,K))cc[x]++;if(chiStat(cc,n,N,K)>=raw-1e-9)ge++;}
  return{n,raw,adj,df:N-1,pApprox:chi2p(adj,N-1),pMC:(ge+1)/(sims+1),sims,E:n*K/N};}
// typical max / min count across all balls, and max pair count, under fair draws
function extremesMC(n,N,K,seed,sims){const rng=mulberry32(seed),mx=[],mn=[],mp=[];
  for(let s=0;s<sims;s++){const c=new Array(N+1).fill(0),pc=new Map();
    for(let i=0;i<n;i++){const d=randomDraw(rng,N,K);for(const x of d)c[x]++;
      if(K>1)for(let a=0;a<K;a++)for(let b=a+1;b<K;b++){const k=d[a]*64+d[b];pc.set(k,(pc.get(k)||0)+1);}}
    const cs=c.slice(1);mx.push(Math.max(...cs));mn.push(Math.min(...cs));let m=0;for(const v of pc.values())if(v>m)m=v;mp.push(m);}
  return{max:[pct(mx,.05),pct(mx,.95)],min:[pct(mn,.05),pct(mn,.95)],pair:[pct(mp,.05),pct(mp,.95)]};}
function pairCounts(draws){const m=new Map();for(const d of draws){const n=d.n;for(let a=0;a<n.length;a++)for(let b=a+1;b<n.length;b++){const k=n[a]+"-"+n[b];m.set(k,(m.get(k)||0)+1);}}return m;}
function gapsAt(seq,t,N){const g=new Array(N+1).fill(-1);let found=0;for(let i=t-1;i>=0&&found<N;i--)for(const x of seq[i])if(x!=null&&g[x]<0){g[x]=t-1-i;found++;}for(let i=1;i<=N;i++)if(g[i]<0)g[i]=t;return g;}

/* ================= STRATEGIES ================= */
function windowCounts(D,t,W,N){const c=new Array(N+1).fill(0);for(let i=Math.max(0,t-W);i<t;i++)for(const x of D[i].n)c[x]++;return c;}
function topK(scores,K,rng,desc){const a=[];for(let i=1;i<scores.length;i++)a.push([i,scores[i],rng()]);a.sort((p,q)=>(desc?q[1]-p[1]:p[1]-q[1])||(p[2]-q[2]));return a.slice(0,K).map(v=>v[0]).sort((x,y)=>x-y);}
function weightedPick(w,K,rng){const idx=[],wt=[];for(let i=1;i<w.length;i++){idx.push(i);wt.push(w[i]);}const out=[];
  for(let k=0;k<K;k++){let tot=0;for(const v of wt)tot+=v;let r=rng()*tot,j=0;while(j<wt.length-1&&r>=wt[j]){r-=wt[j];j++;}out.push(idx[j]);idx.splice(j,1);wt.splice(j,1);}return out.sort((x,y)=>x-y);}
const STRATS=[
 {key:"random",name:"Random pick",desc:"Numbers chosen uniformly at random",pick:(D,t,W,N,K,r)=>randomDraw(r,N,K)},
 {key:"hot",name:"Hot numbers",desc:"Most frequent in the look-back window",pick:(D,t,W,N,K,r)=>topK(windowCounts(D,t,W,N),K,r,true)},
 {key:"cold",name:"Cold numbers",desc:"Least frequent in the look-back window",pick:(D,t,W,N,K,r)=>topK(windowCounts(D,t,W,N),K,r,false)},
 {key:"overdue",name:"Overdue numbers",desc:"Unseen for the longest",pick:(D,t,W,N,K,r)=>topK(gapsAt(D.map(d=>d.n),t,N),K,r,true)},
 {key:"weighted",name:"Frequency-weighted",desc:"Random, weighted by (count + 1) in the window",pick:(D,t,W,N,K,r)=>weightedPick(windowCounts(D,t,W,N).map(v=>v+1),K,r)},
 {key:"hotpair",name:"Hot pair + random",desc:"The most frequent pair in the window, rest random",pick:(D,t,W,N,K,r)=>{const pc=pairCounts(D.slice(Math.max(0,t-W),t));let best=null,bv=-1;for(const[k,v]of pc)if(v>bv||(v===bv&&r()<.5)){bv=v;best=k;}const base=best?best.split("-").map(Number):[];const rest=randomDraw(r,N,N).filter(x=>!base.includes(x));return base.concat(rest).slice(0,K).sort((x,y)=>x-y);}},
 {key:"repeat",name:"Repeat last draw",desc:"The previous draw's numbers",pick:(D,t)=>D[t-1].n.slice()},
];
function runStrategy(g,D,s,W,warm,seed,prizes){const{N,K}=g,rng=mulberry32((seed^hashStr(s.key))>>>0);let sum=0,T=0,won=0,hits3=0;
  for(let t=warm;t<D.length;t++){const pick=s.pick(D,t,W,N,K,rng),d=D[t],set=new Set(d.n);let m=0;for(const x of pick)if(set.has(x))m++;
    let hb=false;if(g.type==="same")hb=d.b!=null&&pick.includes(d.b);else if(g.type==="sep")hb=d.b!=null&&(1+Math.floor(rng()*g.B))===d.b;
    const dv=divisionOf(g,m,hb);sum+=m;T++;if(m>=3)hits3++;if(dv>1)won+=prizes[dv]||0;}
  return{mean:T?sum/T:0,T,won,hits3};}
function randomBand(g,D,warm,seed,reps){const{N,K}=g,T=D.length-warm;if(T<=0)return null;const rng=mulberry32(seed+99),means=[];
  for(let r=0;r<reps;r++){let s=0;for(let t=warm;t<D.length;t++){const p=randomDraw(rng,N,K),set=new Set(D[t].n);for(const x of p)if(set.has(x))s++;}means.push(s/T);}
  return{lo:pct(means,.025),hi:pct(means,.975)};}

/* ================= FORECAST GENERATOR ================= */
function zs(a){const v=a.slice(1),m=v.reduce((x,y)=>x+y,0)/v.length,sd=Math.sqrt(v.reduce((x,y)=>x+(y-m)**2,0)/v.length)||1;return a.map((x,i)=>i?(x-m)/sd:0);}
// per-number features from the first t sequences (each sequence = array of balls)
function numberScores(seq,t,N,o){const W=Math.max(1,o.window),f=new Array(N+1).fill(0),r=new Array(N+1).fill(0);
  for(let i=Math.max(0,t-W);i<t;i++)for(const x of seq[i])if(x!=null)f[x]++;
  const hl=Math.max(1,o.halfLife);for(let i=0;i<t;i++){const w=Math.pow(0.5,(t-1-i)/hl);for(const x of seq[i])if(x!=null)r[x]+=w;}
  const g=gapsAt(seq,t,N),zf=zs(f),zr=zs(r),zg=zs(g),s=new Array(N+1).fill(0);
  for(let i=1;i<=N;i++)s[i]=o.hot*zf[i]+o.recent*zr[i]+o.overdue*zg[i];
  return{s,f,r,g};}
function forecastCombos(g,D,t,o,count,cands,rng,past){const{N,K}=g,seq=D.map(d=>d.n),sc=numberScores(seq,t,N,o).s;
  const pc=new Map();for(let i=Math.max(0,t-o.window);i<t;i++){const n=D[i].n;for(let a=0;a<n.length;a++)for(let b=a+1;b<n.length;b++){const k=n[a]*64+n[b];pc.set(k,(pc.get(k)||0)+1);}}
  const q=K*(K-1)/(N*(N-1)),Ep=Math.min(t,o.window)*q,sdp=Math.sqrt(Ep)||1;
  const w=sc.map((v,i)=>i?Math.exp(0.7*v):0),mu=K*(N+1)/2,sdS=Math.sqrt(K*(N-K)*(N+1)/12),oddSd=Math.sqrt(K*.25*(N-K)/(N-1));
  const seen=new Set(),list=[];
  for(let c=0;c<cands;c++){const t6=(o.hot||o.recent||o.overdue)?weightedPick(w,K,rng):randomDraw(rng,N,K),key=t6.join(",");if(seen.has(key))continue;seen.add(key);
    let ns=0;for(const x of t6)ns+=sc[x];ns/=K;let ps=0;for(let a=0;a<K;a++)for(let b=a+1;b<K;b++)ps+=((pc.get(t6[a]*64+t6[b])||0)-Ep)/sdp;ps/=K*(K-1)/2;
    const sum=t6.reduce((x,y)=>x+y,0),odd=t6.filter(x=>x%2).length,bal=-(Math.abs(sum-mu)/sdS+Math.abs(odd-K/2)/oddSd)/2;
    const pop=o.avoid?popularity(t6,past,N).s:0;
    list.push({t:t6,score:ns+o.pairs*ps+o.balance*bal-o.avoid*pop*0.5,parts:{ns,ps,bal,pop}});}
  list.sort((a,b)=>b.score-a.score);const out=[];
  for(const c of list){if(out.every(p=>p.t.filter(x=>c.t.includes(x)).length<=K-3))out.push(c);if(out.length>=count)break;}
  if(g.type==="sep"){const pbs=numberScores(D.map(d=>[d.b]),t,g.B,o).s;const pw=pbs.map((v,i)=>i?Math.exp(0.7*v):0);out.forEach(c=>c.pb=weightedPick(pw,1,rng)[0]);}
  return{combos:out,scores:sc};}
function forecastStrategy(o){return{key:"forecast",name:"Forecast generator",desc:"Top combination from your current settings",
  pick:(D,t,W,N,K,r)=>{const g={N,K,type:"same"};return forecastCombos(g,D,t,o,1,800,r,D.slice(0,t)).combos[0].t;}};}

/* ================= POPULARITY ================= */
function popularity(t,past,N){let s=0;const why=[];const low=t.filter(x=>x<=31).length,K=t.length;
  if(N>31){if(low===K){s+=3;why.push("all ≤31");}else if(low===K-1){s+=1.5;why.push("one above 31");}}
  let run=1,best=1;for(let i=1;i<K;i++){run=t[i]===t[i-1]+1?run+1:1;best=Math.max(best,run);}if(best>=3){s+=2;why.push(`run of ${best}`);}
  const d=t[1]-t[0];if(t.every((x,i)=>i===0||x-t[i-1]===d)){s+=5;why.push("evenly spaced");}
  if(t.filter(x=>x%7===0).length>=3){s+=1;why.push("multiples of 7");}
  const ld={};t.forEach(x=>ld[x%10]=(ld[x%10]||0)+1);if(Math.max(...Object.values(ld))>=Math.min(4,K-1)){s+=1;why.push("same last digit");}
  let maxOv=0;for(const p of past){let o=0;for(const x of t)if(p.n.includes(x))o++;maxOv=Math.max(maxOv,o);}
  if(maxOv===K){s+=5;why.push("past winner");}else if(maxOv===K-1){s+=2;why.push("close to a past winner");}
  return{s,why};}

if(typeof module!=="undefined")module.exports={GAMES,setSeeds,forecastCombos,mulberry32,hashStr,fmtOddsPlain:p=>p>0?"1 in "+Math.round(1/p).toLocaleString("en-ZA"):"-",divisions,divisionOf,chiTest,extremesMC,pairCounts,STRATS,runStrategy,randomBand,popularity,counts,gapsAt,comb,pTwo};
