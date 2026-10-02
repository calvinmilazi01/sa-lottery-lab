if(typeof document!=="undefined"){
const $=id=>document.getElementById(id);
const fmtR=v=>"R "+Math.round(v).toLocaleString("en-ZA");
const fmtN=(v,d=2)=>Number(v).toLocaleString("en-ZA",{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtOdds=p=>p>0?"1 in "+Math.round(1/p).toLocaleString("en-ZA"):"–";
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmtDate=d=>new Date(d+"T12:00:00").toLocaleDateString("en-ZA",{day:"numeric",month:"short",year:"numeric"});
const ball=(x,cls="")=>`<span class="mini ${cls}">${x}</span>`;

let DATA=window.SALAB_DATA||{draws:{},info:{}},PICKS=window.SALAB_PICKS||null;
// latest jackpot estimate and sales from the nightly sync replace the hand-set defaults
function applyInfo(){for(const[id,inf]of Object.entries(DATA.info||{}))if(GAMES[id]){if(inf.nextJackpot)GAMES[id].jackpot=inf.nextJackpot;if(inf.boardsSold)GAMES[id].sold=inf.boardsSold;}}
applyInfo();
let gid="lotto";try{const s=localStorage.getItem("salab-game");if(s&&GAMES[s])gid=s;}catch(e){}
const G=()=>GAMES[gid];
const addedCache={};
function loadAdded(id){if(addedCache[id])return addedCache[id];let a=[];try{a=JSON.parse(localStorage.getItem("salab-added-"+id)||"[]")||[];}catch(e){a=[];}return addedCache[id]=a;}
function saveAdded(id){try{localStorage.setItem("salab-added-"+id,JSON.stringify(addedCache[id]||[]));}catch(e){}}
function allDraws(){const m=new Map();for(const d of G().seed)m.set(d.d,d);for(const d of loadAdded(gid))m.set(d.d,d);return[...m.values()].sort((a,b)=>a.d.localeCompare(b.d));}
let range={from:"",to:""};
function active(){return allDraws().filter(d=>(!range.from||d.d>=range.from)&&(!range.to||d.d<=range.to));}
const prizeEdits={};
function prizes(){const g=G();return Object.assign({},g.prizes,prizeEdits[gid]||{});}
function bonusName(){return G().type==="sep"?"PowerBall":"bonus";}
function validDraw(d,n,b){const g=G();if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return"Use a YYYY-MM-DD date.";
  if(n.length!==g.K)return`Enter exactly ${g.K} numbers.`;if(n.some(x=>!Number.isInteger(x)||x<1||x>g.N))return`Numbers must be whole numbers from 1 to ${g.N}.`;
  if(new Set(n).size!==g.K)return"The numbers must all be different.";
  if(g.type==="sep"&&(!Number.isInteger(b)||b<1||b>g.B))return`The PowerBall must be 1–${g.B}.`;
  if(g.type==="same"&&b!=null&&(!Number.isInteger(b)||b<1||b>g.N||n.includes(b)))return`The bonus must be 1–${g.N} and not one of the main numbers.`;return"";}

let selected=0,current="odds",hcView="hot",hcSet="main",btDirty=true;

/* ---------- game picker ---------- */
function renderGames(){$("games").innerHTML=Object.values(GAMES).map(g=>`<button class="game" role="radio" aria-checked="${g.id===gid}" data-g="${g.id}">
  <span>${g.label}</span><small>${g.retired?"Discontinued":g.label.toLowerCase()!==g.name.toLowerCase()?"now "+g.name:g.K+"/"+g.N+(g.type==="sep"?" + 1/"+g.B:"")}</small></button>`).join("");
  document.querySelectorAll(".game").forEach(b=>b.onclick=()=>{gid=b.dataset.g;try{localStorage.setItem("salab-game",gid);}catch(e){}selected=0;range={from:"",to:""};$("fromDate").value="";$("toDate").value="";hcSet="main";$("tickets").innerHTML="";setupGameUI();renderAll();});}

function setupGameUI(){const g=G(),divs=divisions(g);
  $("h1game").textContent=g.name;$("h1odds").textContent=fmtOdds(divs[0].p);
  $("about").textContent=g.about;
  $("grid52").style.setProperty("--cols",g.N===52?13:g.N===50?10:9);
  $("addBonusWrap").style.display=g.type==="none"?"none":"";$("addBonusLabel").textContent=g.type==="sep"?"PowerBall":"Bonus (optional)";$("addBonus").max=g.type==="sep"?g.B:g.N;
  $("addNums").placeholder=g.seed.length?g.seed[g.seed.length-1].n.join(" "):Array.from({length:g.K},(_,i)=>i*5+3).join(" ");
  $("csvFormat").textContent="date,"+Array.from({length:g.K},(_,i)=>"n"+(i+1)).join(",")+(g.type==="sep"?",powerball":g.type==="same"?",bonus":"");
  $("hcSetWrap").style.display=g.type==="sep"?"flex":"none";
  $("vPrice").value=g.price;$("vJackpot").value=g.jackpot;$("vSold").value=g.sold;$("prizeNote").textContent=g.prizeNote;
  $("oddsIntro").innerHTML=g.type==="same"?`${g.K} balls are drawn from ${g.N}, then a bonus ball from the remaining ${g.N-g.K}. Matching <i>m</i> of your ${g.K} numbers happens in C(${g.K},<i>m</i>) × C(${g.N-g.K}, ${g.K}−<i>m</i>) of the C(${g.N},${g.K}) = ${comb(g.N,g.K).toLocaleString("en-ZA")} equally likely draws.`
   :g.type==="sep"?`${g.K} balls are drawn from ${g.N}, and the PowerBall separately from 1–${g.B}. Main-number matches follow the hypergeometric distribution over C(${g.N},${g.K}) = ${comb(g.N,g.K).toLocaleString("en-ZA")} draws; the PowerBall match is 1 in ${g.B}, independent of the rest.`
   :`${g.K} balls are drawn from ${g.N}, with no bonus ball. Matching <i>m</i> numbers happens in C(${g.K},<i>m</i>) × C(${g.N-g.K}, ${g.K}−<i>m</i>) of the C(${g.N},${g.K}) = ${comb(g.N,g.K).toLocaleString("en-ZA")} equally likely draws.`;
  $("oddsNote").textContent=`Past results, how long a number has been missing, which numbers are hot, and the sum or odd/even balance of your numbers. Each draw is independent, so every main ball has a ${g.K}/${g.N} = ${fmtN(g.K/g.N*100)}% chance of being drawn every time${g.type==="sep"?`, and each PowerBall a 1/${g.B} = ${fmtN(100/g.B)}% chance`:""}.`;}

/* ---------- hero ---------- */
function renderMeta(){const D=active(),all=allDraws(),g=G();const L=D[D.length-1];
  $("meta").textContent=D.length?`Analysing ${D.length} of ${all.length} ${g.name} draws, ${fmtDate(D[0].d)} to ${fmtDate(L.d)}. Latest: ${L.n.join(", ")}${L.b!=null?" + "+L.b:""}.`:`No ${g.name} draws loaded yet. Add or import draws in the Draw data tab.`;}
function renderGrid(){const g=G(),D=active(),n=D.length,c=counts(D,g.N),p=g.K/g.N,E=n*p,sd=Math.sqrt(n*p*(1-p))||1,el=$("grid52");el.innerHTML="";
  for(let i=1;i<=g.N;i++){const z=n?(c[i]-E)/sd:0,t=Math.max(-1,Math.min(1,z/2.5)),pc=Math.round(Math.abs(t)*85);
    const b=document.createElement("button");b.className="b";b.textContent=i;b.setAttribute("aria-pressed",String(selected===i));
    b.style.background=`color-mix(in srgb, ${t>=0?"var(--hot)":"var(--cold)"} ${pc}%, var(--sunk))`;if(pc>55)b.style.color="#fff";
    b.setAttribute("aria-label",`Ball ${i}: drawn ${c[i]} times, expected ${fmtN(E,1)}`);b.onclick=()=>{selected=i;renderGrid();renderDetail();};el.appendChild(b);}
  if(!selected)$("detail").textContent=n?"Select a ball to see its record.":"No draws to show yet.";}
function renderDetail(){const i=selected,g=G();if(!i)return;const D=active(),n=D.length;if(!n)return;const c=counts(D,g.N),p=g.K/g.N,E=n*p,sd=Math.sqrt(n*p*(1-p))||1,z=(c[i]-E)/sd;
  const gap=gapsAt(D.map(d=>d.n),n,g.N)[i];let last="never in this range";for(let k=n-1;k>=0;k--)if(D[k].n.includes(i)){last=fmtDate(D[k].d);break;}
  $("detail").innerHTML=`<strong>Ball ${i}</strong>: drawn ${c[i]} times in ${n} draws (expected ${fmtN(E,1)}, z = ${fmtN(z)}). Last drawn ${last}${gap<n?`, ${gap} draw${gap===1?"":"s"} ago`:""}. Chance of appearing in the next draw: ${g.K}/${g.N} = ${fmtN(p*100)}%, the same as every other ball.`;}

/* ---------- daily picks ---------- */
function renderPicks(){const g=G(),p=PICKS&&PICKS.games?PICKS.games[gid]:null,sast=k=>new Date(Date.now()+2*3600e3+k*864e5).toISOString().slice(0,10);
  $("syncedAt").textContent=DATA.updated?`Results synced ${new Date(DATA.updated).toLocaleString("en-ZA",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}`:"";
  $("picksTitle").textContent=`${g.name} picks`;
  if(!p){$("picksMeta").textContent=g.retired?`${g.name} no longer runs, so there's no upcoming draw to pick for.`:`No picks yet for ${g.name}. They're built each night once there are at least 5 draws.`;
    $("picksGrid").innerHTML="";$("picksPrev").hidden=true;$("picksFoot").textContent="";return;}
  const day=new Date(p.date+"T12:00:00").toLocaleDateString("en-ZA",{weekday:"long",day:"numeric",month:"short"}),rel=p.date===sast(0)?"Today, ":p.date===sast(1)?"Tomorrow, ":"";
  $("picksMeta").textContent=`Next draw: ${rel}${day}${p.jackpot?` · jackpot ${fmtR(p.jackpot)}`:""}`;
  $("picksGrid").innerHTML=p.tickets.map((tk,i)=>`<div class="ticket"><div class="balls"><span class="rank">${i+1}</span>${tk.t.map(x=>ball(x)).join("")}${tk.pb!=null?ball(tk.pb,"bo"):""}</div></div>`).join("");
  const pv=p.previous;$("picksPrev").hidden=!pv;
  if(pv){const best=Math.max(...pv.tickets.map(t=>t.matches)),bb=pv.tickets.some(t=>t.matches===best&&t.bonus);
    $("picksPrev").innerHTML=`<strong>${fmtDate(pv.date)} draw</strong><span class="balls">${pv.draw.n.map(x=>ball(x)).join("")}${pv.draw.b!=null?ball(pv.draw.b,"bo"):""}</span><span class="muted">Best of ${pv.tickets.length} pick${pv.tickets.length>1?"s":""} matched ${best}${bb?" + bonus":""}${pv.tickets.length>1?` (each: ${pv.tickets.map(t=>t.matches).join(", ")})`:""}</span>`;}
  $("picksFoot").textContent=`Top ${p.tickets.length} combinations from the Forecast generator on default settings, using ${p.basedOn} past draws. Each has the same ${p.odds} chance of winning the jackpot as any other.`;}

/* ---------- manual update: runs the GitHub workflow, then reloads the data ---------- */
// owner/repo comes from the Pages address (owner.github.io/repo/); elsewhere fall back to the main repo
const REPO=location.hostname.endsWith(".github.io")&&location.pathname.split("/")[1]?`${location.hostname.split(".")[0]}/${location.pathname.split("/")[1]}`:"calvinmilazi01/sa-lottery-lab";
const WORKFLOW="nightly.yml",TOKEN_KEY="salab-gh-token",runsLink=`https://github.com/${REPO}/actions/workflows/${WORKFLOW}`;
const getToken=()=>{try{return localStorage.getItem(TOKEN_KEY)||"";}catch(e){return"";}};
const setToken=t=>{try{t?localStorage.setItem(TOKEN_KEY,t):localStorage.removeItem(TOKEN_KEY);}catch(e){}};
let updating=false;
async function gh(path,opts={}){const r=await fetch(`https://api.github.com/repos/${REPO}${path}`,{...opts,headers:{Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",Authorization:`Bearer ${getToken()}`,...(opts.body?{"Content-Type":"application/json"}:{})}});
  if(r.status===401||r.status===403||r.status===404){const e=new Error(r.status===404?`GitHub couldn't find the repo or workflow with this token. Check that the token gives access to ${REPO}.`:"GitHub rejected the token. It may have expired, or it's missing the Actions read and write permission.");e.auth=true;throw e;}
  if(!r.ok)throw new Error(`GitHub API error ${r.status}`);return r.status===204?null:r.json();}
function showUpd(html){const b=$("updBox");b.hidden=!html;b.innerHTML=html||"";}
function tokenForm(msg){showUpd(`${msg?`<p class="flag">${esc(msg)}</p>`:""}<p>Updating runs the same job as the nightly schedule on GitHub: it fetches the latest results, rebuilds the picks and redeploys this page, which takes about a minute. To start it from here, this page needs a GitHub token that can only run this repo's workflows. It's saved in this browser only.</p>
  <ol><li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Create a fine-grained token</a> on GitHub.</li><li>Under <b>Repository access</b>, choose <b>Only select repositories</b> and pick <b>${esc(REPO.split("/")[1])}</b>.</li><li>Under <b>Permissions</b>, add <b>Actions</b> and set it to <b>Read and write</b>. Leave everything else as it is.</li><li>Generate the token, copy it, and paste it below.</li></ol>
  <div class="row"><input type="password" id="tokIn" placeholder="github_pat_…" autocomplete="off" spellcheck="false" aria-label="GitHub token"><button class="btn sm" id="tokSave">Save and update</button><button class="linkbtn" id="updCancel">Cancel</button></div>
  <p class="muted" style="margin:8px 0 0">Or <a href="${runsLink}" target="_blank" rel="noopener">run the workflow on GitHub</a> and reload this page a minute after it finishes.</p>`);
  $("tokSave").onclick=()=>{const t=$("tokIn").value.trim();if(!t){$("tokIn").focus();return;}setToken(t);startUpdate();};
  $("tokIn").onkeydown=e=>{if(e.key==="Enter")$("tokSave").click();};$("updCancel").onclick=()=>showUpd("");$("tokIn").focus();}
function confirmUpdate(){showUpd(`<p>Fetch the latest results and rebuild the picks for every game now? It takes about a minute.</p>
  <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="updNotify"> Also send today's picks to my phone</label>
  <div class="row" style="margin-top:10px"><button class="btn sm" id="updGo">Update now</button><button class="linkbtn" id="updCancel">Cancel</button><span style="flex:1"></span><button class="linkbtn" id="tokForget">Forget saved token</button></div>`);
  $("updGo").onclick=()=>startUpdate($("updNotify").checked);$("updCancel").onclick=()=>showUpd("");$("tokForget").onclick=()=>{setToken("");showUpd(`<p style="margin:0">Token removed from this browser.</p>`);};}
const updStatus=(msg,busy=true)=>showUpd(`<p style="margin:0" role="status">${busy?'<span class="spin" aria-hidden="true"></span>':""}${msg}</p>`);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const recentRuns=async()=>((await gh(`/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=10`)).workflow_runs||[]);
async function startUpdate(notify=false){if(updating)return;updating=true;$("updBtn").disabled=true;
  try{updStatus("Starting the update on GitHub…");
    const before=new Set((await recentRuns()).map(r=>r.id));
    await gh(`/actions/workflows/${WORKFLOW}/dispatches`,{method:"POST",body:JSON.stringify({ref:"main",inputs:{notify:String(!!notify)}})});
    const t0=Date.now();let run=null;
    while(Date.now()-t0<8*60e3){await sleep(5000);
      run=(await recentRuns()).find(r=>!before.has(r.id))||null;const secs=Math.round((Date.now()-t0)/1000);
      if(run&&run.status==="completed")break;
      updStatus(!run||["queued","waiting","pending","requested"].includes(run.status)?`Waiting for GitHub to start the job… (${secs}s)`:`Fetching results, building picks and redeploying… (${secs}s)`);}
    if(!run||run.status!=="completed"){const e=new Error(`It's taking longer than usual. <a href="${run?run.html_url:runsLink}" target="_blank" rel="noopener">Check the run on GitHub</a> and reload this page when it's done.`);e.html=true;throw e;}
    updStatus("Loading the new results…");
    const fresh=await reloadData(Date.parse(run.created_at)),ok=run.conclusion==="success";
    showUpd(`<p style="margin:0" class="${ok&&fresh?"good":"flag"}">${fresh?"Updated with the latest results and picks.":"The job finished, but GitHub Pages is still serving the old data. Reload the page in a minute."}${notify&&ok?" Picks sent to your phone.":""}${ok?"":` Some steps failed on GitHub: <a href="${run.html_url}" target="_blank" rel="noopener">see the run</a>.`}</p>`);}
  catch(e){if(e.auth)tokenForm(e.message);else showUpd(`<p class="flag" style="margin:0">${e.html?e.message:esc(e.message==="Failed to fetch"?"Couldn't reach GitHub. Check your connection and try again.":e.message)}</p>`);}
  finally{updating=false;$("updBtn").disabled=false;}}
// Pages can take a little while to serve the new deploy, so retry until the data is newer than the run
async function reloadData(since){for(let i=0;i<12;i++){try{
    const[d,p]=await Promise.all(["draws","picks"].map(f=>fetch(`data/${f}.json?t=${Date.now()}`,{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})));
    if(Date.parse(d.updated)>=since-5000){DATA=d;PICKS=p;applyInfo();setSeeds(DATA.draws);setupGameUI();renderAll();return true;}}catch(e){}
    await sleep(5000);}return false;}

/* ---------- odds ---------- */
function renderOdds(){const g=G(),pz=prizes();let h="<thead><tr><th>Division</th><th>Probability</th><th>Odds</th></tr></thead><tbody>",any=0;
  for(const d of divisions(g)){any+=d.p;h+=`<tr><td>Div ${d.id}: ${d.label}</td><td>${(d.p*100).toPrecision(3)}%</td><td>${fmtOdds(d.p)}</td></tr>`;}
  $("oddsTable").innerHTML=h+`<tr><td><strong>Any prize</strong></td><td><strong>${(any*100).toPrecision(3)}%</strong></td><td><strong>${fmtOdds(any)}</strong></td></tr></tbody>`;}

/* ---------- hot & cold ---------- */
function hcData(){const g=G(),all=active(),W=$("hcWindow").value,D=W==="all"?all:all.slice(-(+W));
  if(hcSet==="pb"&&g.type==="sep")return{D,seq:D.map(d=>[d.b]),N:g.B,K:1,label:"PowerBall"};return{D,seq:D.map(d=>d.n),N:g.N,K:g.K,label:"Ball"};}
function renderHC(){document.querySelectorAll(".sub").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.v===hcView)));
  document.querySelectorAll(".setb").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.s===hcSet)));
  const g=G(),{D,seq,N,K,label}=hcData(),n=D.length,out=$("hcOut");$("abWrap").style.display=hcView==="ab"?"flex":"none";
  if(n<3){out.innerHTML=`<p class="note">Not enough draws in this window. Choose a longer window or add draws.</p>`;return;}
  const c=new Array(N+1).fill(0);seq.forEach(s=>s.forEach(x=>{if(x!=null)c[x]++;}));const p=K/N,E=n*p,sd=Math.sqrt(n*p*(1-p)),gap=gapsAt(seq,n,N);
  const ext=extremesMC(n,N,K,hashStr(gid+n+K),hcView==="pairs"?300:500);const lastIdx=i=>{for(let k=n-1;k>=0;k--)if(seq[k].includes(i))return D[k].d;return null;};
  const rows=[];for(let i=1;i<=N;i++)rows.push({i,c:c[i],z:(c[i]-E)/sd,gap:gap[i]});
  const head=`<p class="intro">Window: ${n} draws, ${fmtDate(D[0].d)} to ${fmtDate(D[n-1].d)}. Each ${label.toLowerCase()} is expected ${fmtN(E,1)} times. Chance of any ${label.toLowerCase()} in the next draw: ${fmtN(p*100)}%, whatever its history.</p>`;
  if(hcView==="hot"||hcView==="cold"){const hot=hcView==="hot";rows.sort((a,b)=>hot?(b.c-a.c)||(a.gap-b.gap):(a.c-b.c)||(b.gap-a.gap));const top=rows.slice(0,10);
    let t=`<div class="scroll"><table><thead><tr><th>${label}</th><th>Times drawn</th><th>Expected</th><th>z</th><th>Last drawn</th><th>Draws since</th>${hot?"":"<th>Chance of a gap this long</th>"}</tr></thead><tbody>`;
    for(const r of top){const ld=lastIdx(r.i);t+=`<tr><td>${ball(r.i,hot?"hot":"cold")}</td><td>${r.c}</td><td>${fmtN(E,1)}</td><td>${fmtN(r.z)}</td><td>${ld?fmtDate(ld):"not in window"}</td><td>${ld?r.gap:"≥ "+n}</td>${hot?"":`<td>${fmtN(Math.pow(1-p,r.gap)*100,1)}%</td>`}</tr>`;}
    t+="</tbody></table></div>";const topC=hot?top[0].c:top[0].c,band=hot?ext.max:ext.min;
    const inBand=topC>=band[0]&&topC<=band[1];
    t+=`<p class="note">${hot?`The hottest ${label.toLowerCase()} came up ${topC} times. In fair draws of this length, the most frequent of ${N} balls usually comes up ${band[0]}–${band[1]} times.`:`The coldest ${label.toLowerCase()} came up ${topC} times. In fair draws of this length, the least frequent of ${N} balls usually comes up ${band[0]}–${band[1]} times.`} ${inBand?"So this is normal variation, not a pattern.":topC>band[1]||topC<band[0]?"This is outside the usual range, worth watching as more draws arrive.":""}${hot?"":` "Chance of a gap this long" is (1 − ${K}/${N}) raised to the gap: how often any single ball goes that long without appearing. With ${N} balls, some will always have long gaps.`}</p>`;
    out.innerHTML=head+t;return;}
  if(hcView==="pairs"){if(K<2){out.innerHTML=head+`<p class="note">Pairs need at least two balls per draw. Switch to main balls.</p>`;return;}
    const pc=[...pairCounts(D).entries()].sort((a,b)=>b[1]-a[1]).slice(0,15),q=K*(K-1)/(N*(N-1)),Ep=n*q;
    let t=`<div class="scroll"><table><thead><tr><th>Pair</th><th>Times together</th><th>Expected per pair</th><th>Last together</th></tr></thead><tbody>`;
    for(const[k,v]of pc){const[a,b]=k.split("-").map(Number);let ld="";for(let i=n-1;i>=0;i--)if(D[i].n.includes(a)&&D[i].n.includes(b)){ld=fmtDate(D[i].d);break;}t+=`<tr><td>${ball(a,"hot")} ${ball(b,"hot")}</td><td>${v}</td><td>${fmtN(Ep,2)}</td><td>${ld}</td></tr>`;}
    out.innerHTML=head+t+`</tbody></table></div><p class="note">There are C(${N},2) = ${comb(N,2).toLocaleString("en-ZA")} possible pairs and each has a ${fmtN(q*100,3)}% chance of appearing together in a draw. With that many pairs, the top pair in fair draws of this length usually appears ${ext.pair[0]}–${ext.pair[1]} times. The top pair here appeared ${pc.length?pc[0][1]:0} times.</p>`;return;}
  if(hcView==="ab"){const A=Math.min(N,Math.max(1,+$("abA").value||1)),B=Math.min(N,Math.max(1,+$("abB").value||2));
    if(A===B){out.innerHTML=head+`<p class="note">Choose two different numbers.</p>`;return;}
    const q=K*(K-1)/(N*(N-1)),both=seq.filter(s=>s.includes(A)&&s.includes(B)).length,v=n*(2*p*(1-p)-2*(q-p*p)),z=v>0?(c[A]-c[B])/Math.sqrt(v):0,pv=pTwo(z);
    const row=(x)=>{const ld=lastIdx(x);return`<tr><td>${ball(x)}</td><td>${c[x]}</td><td>${fmtN(E,1)}</td><td>${ld?fmtDate(ld):"not in window"}</td><td>${ld?gap[x]:"≥ "+n}</td><td>${fmtN(p*100)}%</td></tr>`;};
    out.innerHTML=head+`<div class="scroll"><table><thead><tr><th>${label}</th><th>Times drawn</th><th>Expected</th><th>Last drawn</th><th>Draws since</th><th>Chance next draw</th></tr></thead><tbody>${row(A)}${row(B)}</tbody></table></div>
    <div class="stat-row"><div class="stat"><div class="v">${fmtN((p-q)*100)}%</div><div class="l">Next draw has ${A} but not ${B} (same for ${B} but not ${A})</div></div>
    ${K>1?`<div class="stat"><div class="v">${fmtN(q*100,3)}%</div><div class="l">Next draw has both (seen together ${both} times here)</div></div>`:""}
    <div class="stat"><div class="v">${fmtN((1-2*p+q)*100)}%</div><div class="l">Next draw has neither</div></div>
    <div class="stat"><div class="v">p = ${fmtN(pv,3)}</div><div class="l">Is the gap between their counts (${c[A]} vs ${c[B]}) bigger than chance? ${pv<0.05?"Unusually large.":"No, within normal variation."}</div></div></div>
    <p class="note">A or B? Mathematically they are tied: each has exactly a ${fmtN(p*100)}% chance next draw. The test compares their past counts using the variance of the difference, 2np(1−p) − 2n(q − p²), which accounts for both being drawn from the same machine. If you chose these two because their counts already looked different, the p-value overstates the evidence.</p>`;return;}
  if(hcView==="map"){const rowsN=Math.min(n,100),Dm=D.slice(-rowsN).reverse(),sm=seq.slice(-rowsN).reverse(),L=96,Wd=1040,cw=(Wd-L-6)/N,rh=18,H=30+rowsN*rh;
    let s=`<svg viewBox="0 0 ${Wd} ${H}" width="100%" role="img" aria-label="Map of which numbers were drawn in each draw">`;
    for(let i=1;i<=N;i++)if(N<=20||i%2===1)s+=`<text x="${L+(i-.5)*cw}" y="16" font-size="10" text-anchor="middle">${i}</text>`;
    Dm.forEach((d,r)=>{const y=26+r*rh;if(r%2===0)s+=`<rect x="${L}" y="${y}" width="${Wd-L-6}" height="${rh}" fill="var(--sunk)" opacity=".55"/>`;
      s+=`<text x="${L-8}" y="${y+13}" font-size="11" text-anchor="end">${fmtDate(d.d).replace(/ \d{4}$/,"")}</text>`;
      sm[r].forEach(x=>{if(x!=null)s+=`<circle cx="${L+(x-.5)*cw}" cy="${y+rh/2}" r="${Math.min(6,cw/2-1)}" fill="var(--ink)"><title>${fmtDate(d.d)}: ${x}</title></circle>`;});
      if(hcSet==="main"&&g.type==="same"&&d.b!=null)s+=`<circle cx="${L+(d.b-.5)*cw}" cy="${y+rh/2}" r="${Math.min(5,cw/2-1.5)}" fill="none" stroke="var(--ball)" stroke-width="2"><title>Bonus ${d.b}</title></circle>`;});
    for(let i=0;i<=N;i+=(N>20?10:4))s+=`<line x1="${L+i*cw}" x2="${L+i*cw}" y1="22" y2="${H}" stroke="var(--line)"/>`;
    out.innerHTML=head+`<div class="chart scroll"><div style="min-width:640px">${s}</svg></div></div><p class="note">Newest draw at the top${rowsN<n?", showing the latest 100":""}. Filled dots are drawn ${label.toLowerCase()}s${g.type==="same"&&hcSet==="main"?", yellow rings are bonus balls":""}. Streaks, clusters and empty columns appear in random data all the time, so the map shows what happened rather than what comes next.</p>`;}}

/* ---------- randomness ---------- */
function renderRandom(){const g=G(),D=active(),n=D.length,N=g.N,K=g.K;
  if(n<5){["chiStats","freqChart","patternTable","oddTable"].forEach(id=>$(id).innerHTML="");$("chiNote").textContent="Select at least 5 draws to run the tests.";return;}
  const r=chiTest(D,N,K,4242);
  $("chiStats").innerHTML=`<div class="stat"><div class="v">${fmtN(r.adj,1)}</div><div class="l">Chi-squared (adjusted), ${r.df} degrees of freedom</div></div>
   <div class="stat"><div class="v">${fmtN(r.pMC,3)}</div><div class="l">Simulated p-value (${r.sims.toLocaleString()} fair histories)</div></div>
   <div class="stat"><div class="v">${r.pMC<0.05?"Unusual":"Fair-looking"}</div><div class="l">${r.pMC<0.05?"Worth watching as more draws come in":"No evidence of bias in ball frequencies"}</div></div>`;
  $("chiNote").innerHTML=`Because ${K} balls are drawn without replacement, the raw chi-squared statistic (${fmtN(r.raw,1)}) is scaled by (N−1)/(N−K) = ${N-1}/${N-K} before comparing with the χ² distribution (textbook p = ${fmtN(r.pApprox,3)}). With ${fmtN(r.E,1)} expected hits per ball, the simulated p-value is the one to trust. With ${N} balls, 2 or 3 bars outside the shaded band is normal even when draws are perfectly fair.`;
  const c=counts(D,N),p=K/N,E=n*p,sd=Math.sqrt(n*p*(1-p)),maxY=Math.max(...c.slice(1),E+2*sd)*1.1,W=1040,H=280,L=36,B=30,T=12,bw=(W-L-8)/N,y=v=>T+(H-T-B)*(1-v/maxY);
  let s=`<rect x="${L}" y="${y(E+1.96*sd)}" width="${W-L-8}" height="${y(Math.max(0,E-1.96*sd))-y(E+1.96*sd)}" fill="var(--teal)" opacity=".12"/>`;
  for(let i=1;i<=N;i++){const x=L+(i-1)*bw,o=Math.abs(c[i]-E)>1.96*sd;s+=`<rect x="${x+1.5}" y="${y(c[i])}" width="${bw-3}" height="${y(0)-y(c[i])}" fill="${o?(c[i]>E?"var(--hot)":"var(--cold)"):"var(--ink)"}" opacity="${o?1:.72}"><title>Ball ${i}: ${c[i]}</title></rect>`;
    if(i%2===1||N<=26)s+=`<text x="${x+bw/2}" y="${H-12}" font-size="11" text-anchor="middle">${i}</text>`;}
  s+=`<line x1="${L}" x2="${W-8}" y1="${y(E)}" y2="${y(E)}" stroke="var(--ball)" stroke-width="2.5"/><text x="${L}" y="${y(E)-5}" font-size="12">expected ${fmtN(E,1)}</text>`;
  const step=Math.max(1,Math.round(maxY/5));for(let v=0;v<=maxY;v+=step)s+=`<text x="${L-6}" y="${y(v)+4}" font-size="11" text-anchor="end">${v}</text>`;
  s+=`<text x="${W-10}" y="${T+10}" font-size="12" text-anchor="end">shaded band: 95% range for a single ball</text>`;$("freqChart").innerHTML=s;
  const Ct=comb(N,K),mu=K*(N+1)/2,sdS=Math.sqrt(K*(N-K)*(N+1)/12),half=N/2,hv=K*.25*(N-K)/(N-1),mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const sums=D.map(d=>d.n.reduce((a,b)=>a+b,0)),odd=D.map(d=>d.n.filter(x=>x%2).length),high=D.map(d=>d.n.filter(x=>x>half).length);
  const pNo=comb(N-K+1,K)/Ct,cons=D.filter(d=>d.n.some((x,i)=>i>0&&x===d.n[i-1]+1)).length/n;
  const rep=[];for(let i=1;i<n;i++)rep.push(D[i].n.filter(x=>D[i-1].n.includes(x)).length);const rm=K*K/N,rs=Math.sqrt(K*(K/N)*((N-K)/N)*((N-K)/(N-1)));
  const rows=[["Average sum of the numbers",fmtN(mean(sums),1),fmtN(mu,1),(mean(sums)-mu)/(sdS/Math.sqrt(n))],
   ["Average odd numbers per draw",fmtN(mean(odd)),fmtN(K/2),(mean(odd)-K/2)/Math.sqrt(hv/n)],
   [`Average numbers above ${half} per draw`,fmtN(mean(high)),fmtN(K/2),(mean(high)-K/2)/Math.sqrt(hv/n)],
   ["Draws with at least one consecutive pair",(cons*100).toFixed(1)+"%",((1-pNo)*100).toFixed(1)+"%",(cons-(1-pNo))/Math.sqrt((1-pNo)*pNo/n)],
   ["Average numbers repeated from the previous draw",fmtN(mean(rep)),fmtN(rm,3),(mean(rep)-rm)/(rs/Math.sqrt(rep.length))]];
  if(N>31){const pb=comb(31,K)/Ct,bd=D.filter(d=>d.n.every(x=>x<=31)).length/n;rows.push([`Draws with all numbers 31 or lower`,(bd*100).toFixed(1)+"%",(pb*100).toFixed(1)+"%",(bd-pb)/Math.sqrt(pb*(1-pb)/n)]);}
  if(g.type==="sep"){const Db=D.filter(d=>d.b!=null),pbc=counts(Db,g.B,"b"),rb=chiStat(pbc,Db.length,g.B,1),pr=chi2p(rb,g.B-1);rows.push([`PowerBall frequencies (χ² = ${fmtN(rb,1)}, ${g.B-1} df)`,"–","–",null,pr]);}
  let h="<thead><tr><th>Test</th><th>Observed</th><th>Expected if fair</th><th>z</th><th>p-value</th><th>Verdict</th></tr></thead><tbody>";
  for(const[l,o,e,z,pd]of rows){const pv=z==null?pd:pTwo(z);h+=`<tr><td>${l}</td><td>${o}</td><td>${e}</td><td>${z==null?"–":fmtN(z)}</td><td>${fmtN(pv,3)}</td><td class="${pv<0.05?"flag":"good"}">${pv<0.05?"Unusual":"Consistent"}</td></tr>`;}
  $("patternTable").innerHTML=h+"</tbody>";
  let oh="<thead><tr><th>Odd numbers in draw</th>";for(let j=0;j<=K;j++)oh+=`<th>${j}</th>`;oh+="</tr></thead><tbody><tr><td>Observed draws</td>";
  for(let j=0;j<=K;j++)oh+=`<td>${odd.filter(v=>v===j).length}</td>`;oh+="</tr><tr><td>Expected draws</td>";
  for(let j=0;j<=K;j++)oh+=`<td>${fmtN(n*comb(half,j)*comb(half,K-j)/Ct,1)}</td>`;$("oddTable").innerHTML=oh+"</tr></tbody>";}

/* ---------- backtest ---------- */
function renderBacktest(){const g=G(),D=active(),N=g.N,K=g.K,W=Math.max(1,+$("btWindow").value||20),warm=Math.max(1,+$("btWarm").value||10),seed=+$("btSeed").value||0,T=D.length-warm;
  if(T<5){$("btChart").innerHTML="";$("btTable").innerHTML="";$("btNote").textContent=`Only ${Math.max(0,T)} test draws after the warm-up. Lower the warm-up or add more draws (at least 5 test draws needed).`;return;}
  const band=randomBand(g,D,warm,seed,2000),mu=K*K/N,sd1=Math.sqrt(K*(K/N)*((N-K)/N)*((N-K)/(N-1))),se=sd1/Math.sqrt(T),pz=prizes();
  const res=STRATS.map(s=>({s,...runStrategy(g,D,s,W,warm,seed,pz)}));
  const Wd=1040,Ht=60+res.length*36,L=190,R=30,lo=Math.min(band.lo,...res.map(r=>r.mean))-0.1,hi=Math.max(band.hi,...res.map(r=>r.mean))+0.1,x=v=>L+(Wd-L-R)*(v-lo)/(hi-lo);
  $("btChart").setAttribute("viewBox",`0 0 ${Wd} ${Ht}`);
  let s=`<rect x="${x(band.lo)}" y="20" width="${x(band.hi)-x(band.lo)}" height="${Ht-50}" fill="var(--teal)" opacity=".14"/><line x1="${x(mu)}" x2="${x(mu)}" y1="14" y2="${Ht-28}" stroke="var(--ball)" stroke-width="2.5"/><text x="${x(mu)}" y="12" font-size="12" text-anchor="middle">random average ${fmtN(mu,3)}</text>`;
  res.forEach((r,i)=>{const yy=40+i*36;s+=`<text x="${L-12}" y="${yy+4}" font-size="13" text-anchor="end">${r.s.name}</text><line x1="${L}" x2="${Wd-R}" y1="${yy}" y2="${yy}" stroke="var(--line)"/><circle cx="${x(r.mean)}" cy="${yy}" r="8" fill="${r.mean<band.lo||r.mean>band.hi?"var(--hot)":"var(--ink)"}"><title>${r.s.name}: ${fmtN(r.mean,3)}</title></circle>`;});
  for(let k=0;k<=4;k++){const v=lo+(hi-lo)*k/4;s+=`<text x="${x(v)}" y="${Ht-10}" font-size="11" text-anchor="middle">${fmtN(v,2)}</text>`;}$("btChart").innerHTML=s;
  let h=`<thead><tr><th>Strategy</th><th>Avg matches</th><th>z vs random</th><th>p-value</th><th>Draws with 3+</th><th>Spent</th><th>Won (Div 2+)</th></tr></thead><tbody>`;
  for(const r of res){const z=(r.mean-mu)/se,pv=pTwo(z);h+=`<tr><td>${r.s.name}<br><small class="muted">${r.s.desc}</small></td><td>${fmtN(r.mean,3)}</td><td>${fmtN(z)}</td><td class="${pv<0.05?"flag":""}">${fmtN(pv,3)}</td><td>${r.hits3} of ${r.T}</td><td>${fmtR(r.T*g.price)}</td><td>${fmtR(r.won)}</td></tr>`;}
  $("btTable").innerHTML=h+"</tbody>";const beat=res.filter(r=>r.s.key!=="random"&&(r.mean-mu)/se>1.96);
  $("btNote").innerHTML=`Tested on ${T} draws. A random pick averages ${fmtN(mu,3)} main-number matches with a standard error of ${fmtN(se,3)} over ${T} draws, so results between about ${fmtN(band.lo,3)} and ${fmtN(band.hi,3)} are ordinary luck.${g.type==="sep"?" Every strategy picks its PowerBall at random.":""} `+
   (beat.length?`${beat.map(r=>r.s.name).join(" and ")} scored above the band this time. Change the seed and the window before reading anything into it: with ${STRATS.length-1} strategies tested, one landing outside a 95% band happens often by chance, and a real edge would have to hold up on new draws.`:"No strategy beat random. That is what probability predicts, and it's what to expect as more draws are added.");
  if(T<30)$("btNote").innerHTML+=` With only ${T} test draws, this test can only detect very large effects; import more history for a sharper test.`;}

/* ---------- value ---------- */
function renderValue(){const g=G(),divs=divisions(g),J=+$("vJackpot").value||0,S=+$("vSold").value||0,price=+$("vPrice").value||g.price,wk=Math.max(1,+$("vWeekly").value||1),pz=prizes();
  const p1=divs[0].p,lam=S*p1,share=lam>1e-9?J*(1-Math.exp(-lam))/lam:J;let ev=0,any=0;
  let h="<thead><tr><th>Division</th><th>Odds</th><th>Prize (R)</th><th>Adds to value</th></tr></thead><tbody>";
  for(const d of divs){const prize=d.id===1?share:(pz[d.id]||0),c=d.p*prize;ev+=c;any+=d.p;
    h+=`<tr><td>Div ${d.id}: ${d.label}</td><td>${fmtOdds(d.p)}</td><td>${d.id===1?fmtR(share)+' <small class="muted">expected share</small>':`<input class="pz" type="number" min="0" data-d="${d.id}" value="${pz[d.id]||0}" aria-label="Division ${d.id} prize">`}</td><td>R ${fmtN(c,3)}</td></tr>`;}
  $("valueTable").innerHTML=h+`<tr><td><strong>Total</strong></td><td>${fmtOdds(any)}</td><td></td><td><strong>R ${fmtN(ev,3)}</strong></td></tr></tbody>`;
  document.querySelectorAll(".pz").forEach(inp=>inp.onchange=()=>{prizeEdits[gid]=prizeEdits[gid]||{};prizeEdits[gid][inp.dataset.d]=+inp.value||0;renderValue();btDirty=true;});
  const yr=wk*52,pYr=1-Math.pow(1-p1,yr),half=Math.log(0.5)/Math.log(1-p1)/yr;
  $("valueStats").innerHTML=`<div class="stat"><div class="v">R ${fmtN(ev)}</div><div class="l">Expected return on a R${fmtN(price)} board (${Math.round(ev/price*100)}c per R1)</div></div>
   <div class="stat"><div class="v">${fmtR(share)}</div><div class="l">Expected top-prize share if you win (${fmtN(lam,2)} other winners expected)</div></div>
   <div class="stat"><div class="v">${fmtR(yr*(price-ev))}</div><div class="l">Expected yearly loss at ${wk} board${wk>1?"s":""} a week</div></div>
   <div class="stat"><div class="v">1 in ${Math.round(1/pYr).toLocaleString("en-ZA")}</div><div class="l">Chance of a top prize in a year; a 50% chance takes about ${Math.round(half).toLocaleString("en-ZA")} years</div></div>`;}

/* ---------- forecast ---------- */
const FC_KEYS=[["hot","Hot frequency"],["recent","Recent form"],["overdue","Overdue"],["pairs","Hot pairs"],["balance","Balanced sum and odd/even"],["avoid","Avoid popular picks"]];
function fcOpts(){const o={window:Math.max(3,+$("fcWindow").value||30),halfLife:Math.max(1,+$("fcHalf").value||8)};for(const[k]of FC_KEYS)o[k]=+$("fc_"+k).value;return o;}
function renderForecast(){const g=G(),D=active(),n=D.length,out=$("fcOut");
  if(n<5){out.innerHTML=`<p class="note">The generator needs at least 5 ${g.name} draws. Add or import draws in the Draw data tab.</p>`;$("fcBars").innerHTML="";return;}
  const o=fcOpts(),rng=mulberry32((+$("fcSeed").value||1)^hashStr(gid)),{combos,scores}=forecastCombos(g,D,n,o,10,20000,rng,allDraws());
  const odds=fmtOdds(divisions(g)[0].p),top=[...scores.keys()].slice(1).sort((a,b)=>scores[b]-scores[a]);
  out.innerHTML=combos.map((c,i)=>`<div class="ticket"><div class="balls"><span class="rank">${i+1}</span>${c.t.map(x=>ball(x,top.indexOf(x)<g.K*2?"hot":"")).join("")}${c.pb?ball(c.pb,"bo"):""}</div>
    <small>Score ${fmtN(c.score)} · numbers ${fmtN(c.parts.ns)}${o.pairs?` · pairs ${fmtN(c.parts.ps)}`:""}${o.balance?` · balance ${fmtN(c.parts.bal)}`:""}${o.avoid?` · popularity ${c.parts.pop}`:""} · odds ${odds}</small></div>`).join("")+
    `<p class="note">Ranked by score from ${n} draws. Red balls are the model's ${g.K*2} highest-weighted numbers. The score measures how well a combination matches the patterns you weighted; it does not change the chance of it being drawn, which is ${odds} for every combination. Use the test below to see how the generator's top pick would have done on past draws.</p>`;
  // weight strip
  const N=g.N,Wd=1040,H=150,L=10,bw=(Wd-2*L)/N,mx=Math.max(...scores.slice(1).map(Math.abs),0.5),y0=H/2-10;
  let s=`<line x1="${L}" x2="${Wd-L}" y1="${y0}" y2="${y0}" stroke="var(--ball)" stroke-width="2"/>`;
  for(let i=1;i<=N;i++){const v=scores[i],h=Math.abs(v)/mx*(y0-12),x=L+(i-1)*bw;s+=`<rect x="${x+1}" y="${v>=0?y0-h:y0}" width="${bw-2}" height="${h}" fill="${v>=0?"var(--hot)":"var(--cold)"}" opacity=".85"><title>${i}: ${fmtN(v)}</title></rect>`;
    if(N<=36||i%2===1)s+=`<text x="${x+bw/2}" y="${H-6}" font-size="10" text-anchor="middle">${i}</text>`;}
  $("fcBars").innerHTML=s;}
function testForecast(){const g=G(),D=active(),warm=Math.max(3,Math.min(10,Math.floor(D.length/3))),T=D.length-warm,box=$("fcTest");
  if(T<5){box.innerHTML="Not enough draws to test. Add more history first.";return;}
  const o=fcOpts(),seed=+$("fcSeed").value||1,s=forecastStrategy(o),r=runStrategy(g,D,s,o.window,warm,seed,prizes()),band=randomBand(g,D,warm,seed,1000),mu=g.K*g.K/g.N,
    se=Math.sqrt(g.K*(g.K/g.N)*((g.N-g.K)/g.N)*((g.N-g.K)/(g.N-1)))/Math.sqrt(T),z=(r.mean-mu)/se,pv=pTwo(z);
  box.innerHTML=`Tested on the last ${T} draws, choosing each draw's top combination using only earlier draws. It averaged <strong>${fmtN(r.mean,3)}</strong> matches per draw against <strong>${fmtN(mu,3)}</strong> for a random pick (random range ${fmtN(band.lo,3)}–${fmtN(band.hi,3)}; z = ${fmtN(z)}, p = ${fmtN(pv,3)}). It won ${fmtR(r.won)} in Div 2+ prizes for ${fmtR(T*g.price)} spent. `+
   (pv<0.05&&z>0?"That is above the random range on this run; check it with other seeds and settings, and on new draws, before trusting it.":"That is within what random picks achieve, so on this data the settings show no predictive edge.");}

/* ---------- tickets ---------- */
function renderTickets(){const g=G(),k=Math.min(20,Math.max(1,+$("tCount").value||5)),past=allDraws(),rng=mulberry32((Date.now()^hashStr("t"))>>>0),out=[],odds=fmtOdds(divisions(g)[0].p);
  for(let i=0;i<k;i++){let best=null;for(let j=0;j<400;j++){const t=randomDraw(rng,g.N,g.K),sc=popularity(t,past,g.N);if(!best||sc.s<best.sc.s)best={t,sc};if(best.sc.s===0&&(g.N<=31||best.t.filter(x=>x>31).length>=2))break;}
    if(g.type==="sep")best.pb=1+Math.floor(rng()*g.B);out.push(best);}
  $("tickets").innerHTML=out.map(o=>`<div class="ticket"><div class="balls">${o.t.map(x=>ball(x)).join("")}${o.pb?ball(o.pb,"bo"):""}</div><small>Popularity score ${o.sc.s}${o.sc.why.length?" ("+o.sc.why.join(", ")+")":""}${g.N>31?` · ${o.t.filter(x=>x>31).length} above 31`:""} · still ${odds}</small></div>`).join("");}

/* ---------- data ---------- */
function renderData(){const g=G(),D=allDraws().slice().reverse();let h=`<thead><tr><th>Date</th><th>Numbers</th>${g.type==="none"?"":`<th>${g.type==="sep"?"PowerBall":"Bonus"}</th>`}<th>Source</th></tr></thead><tbody>`;
  for(const d of D)h+=`<tr><td>${fmtDate(d.d)}</td><td>${d.n.join("  ")}</td>${g.type==="none"?"":`<td>${d.b??"–"}</td>`}<td>${esc(d.src||"added")}</td></tr>`;
  $("drawTable").innerHTML=D.length?h+"</tbody>":`<tbody><tr><td>No draws yet for ${g.name}. Add one above or import a CSV.</td></tr></tbody>`;}

function renderAll(){renderGames();renderPicks();renderMeta();renderGrid();renderDetail();renderOdds();renderRandom();renderValue();renderData();renderHC();btDirty=true;$("fcOut").innerHTML="";$("fcTest").textContent="Runs the generator draw by draw on history it hadn't seen yet and compares its matches with random picks.";if(current==="forecast")renderForecast();if(current==="backtest"){renderBacktest();btDirty=false;}}

document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{current=b.dataset.tab;document.querySelectorAll(".tab").forEach(x=>x.setAttribute("aria-selected",String(x===b)));
  document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("on",p.id==="p-"+current));if(current==="backtest"&&btDirty){renderBacktest();btDirty=false;}if(current==="tickets"&&!$("tickets").innerHTML)renderTickets();if(current==="forecast"&&!$("fcOut").innerHTML)renderForecast();});
document.querySelectorAll(".sub").forEach(b=>b.onclick=()=>{hcView=b.dataset.v;renderHC();});
document.querySelectorAll(".setb").forEach(b=>b.onclick=()=>{hcSet=b.dataset.s;renderHC();});
$("hcWindow").onchange=renderHC;$("abA").oninput=renderHC;$("abB").oninput=renderHC;
$("fcRun").onclick=renderForecast;$("fcTestBtn").onclick=testForecast;
FC_KEYS.forEach(([k])=>$("fc_"+k).addEventListener("input",()=>{$("fco_"+k).textContent=$("fc_"+k).value;}));
$("btRun").onclick=()=>{renderBacktest();btDirty=false;};$("tRun").onclick=renderTickets;
["vJackpot","vSold","vPrice","vWeekly"].forEach(id=>$(id).addEventListener("input",()=>renderValue()));
$("applyRange").onclick=()=>{range={from:$("fromDate").value,to:$("toDate").value};renderAll();};
$("addBtn").onclick=()=>{const g=G(),d=$("addDate").value,n=($("addNums").value.match(/\d+/g)||[]).map(Number),braw=$("addBonus").value,b=g.type==="none"||braw===""?null:+braw;const err=validDraw(d,n,b);
  if(err){$("addMsg").innerHTML=`<span class="flag">${err}</span>`;return;}const a=loadAdded(gid).filter(x=>x.d!==d);a.push({d,n:n.sort((x,y)=>x-y),b,src:"added"});addedCache[gid]=a;saveAdded(gid);
  $("addMsg").innerHTML=`<span class="good">Added the ${fmtDate(d)} ${g.name} draw.</span>`;$("addNums").value="";$("addBonus").value="";renderAll();};
$("importBtn").onclick=()=>{const g=G(),lines=$("csvBox").value.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);let ok=0;const bad=[];let a=loadAdded(gid);
  for(const line of lines){const parts=line.split(/[,;\t]/).map(s=>s.trim());if(/date/i.test(parts[0]))continue;const d=parts[0],nums=parts.slice(1,1+g.K).map(Number),bs=parts[1+g.K],b=g.type==="none"||bs==null||bs===""?null:Number(bs);
    const err=validDraw(d,nums,b);if(err){bad.push(line.slice(0,40));continue;}a=a.filter(x=>x.d!==d);a.push({d,n:nums.sort((x,y)=>x-y),b,src:"imported"});ok++;}
  addedCache[gid]=a;saveAdded(gid);$("csvMsg").innerHTML=`<span class="${bad.length?"flag":"good"}">Imported ${ok} ${g.name} draw${ok===1?"":"s"}.${bad.length?` Skipped ${bad.length} line${bad.length===1?"":"s"} that didn't match the format, starting with “${esc(bad[0])}”.`:""}</span>`;renderAll();};
$("exportBtn").onclick=()=>{const g=G();$("csvBox").value=$("csvFormat").textContent+"\n"+allDraws().map(d=>[d.d,...d.n].concat(g.type==="none"?[]:[d.b??""]).join(",")).join("\n");$("csvBox").select();$("csvMsg").textContent=`All ${g.name} draws are in the box above. Copy them to save a backup.`;};
$("resetBtn").onclick=()=>{addedCache[gid]=[];saveAdded(gid);$("csvMsg").textContent=`Removed your added ${G().name} draws. The built-in data is unchanged.`;renderAll();};

$("updBtn").onclick=()=>{if(updating)return;getToken()?confirmUpdate():tokenForm();};
setupGameUI();renderAll();
}
