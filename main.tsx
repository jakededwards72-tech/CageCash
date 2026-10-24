import React,{useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {Activity,BarChart3,BookOpen,CalendarDays,ChevronLeft,ChevronRight,Clock3,FlaskConical,Info,RefreshCw,Search,ShieldCheck,Target,TrendingUp,WalletCards,Wifi,WifiOff} from "lucide-react";
import "./styles.css";
import "./nba.css";

type Book={bookmakerID:string;bookmaker:string;odds:number;updatedAt:string|null;excluded?:boolean};
type Market={id:string;eventId:string;market:string;player:string|null;line:number|string;side:string;selection:string;bestBook:Book&{decimal:number};fairProbability:number|null;fairOdds:number|null;edge:number|null;ev:number|null;peerBooks:number;books:Book[];integrity:string};
type Team={name:string;abbr:string;teamId:string|null;logo:string|null;record:string;score:number|null};
type Game={id:string;oddsEventId:string|null;startTime:string|null;status:string;statusDetail:string;away:Team;home:Team;markets:Market[]};
type Feed={ok:boolean;date?:string;games?:Game[];oddsStatus?:string;oddsError?:string;scheduleStatus?:string;error?:string;fetchedAt?:string};
type Props={ok:boolean;markets?:Market[];error?:string;code?:string;fetchedAt?:string};
type Pick={id:string;selection:string;game:string;market:string;odds:number;book:string;stake:number;kind:"LEAN"|"WAGER";result:"PENDING"|"WIN"|"LOSS"|"PUSH";notes:string;createdAt:string};
const fOdds=(n:number|null|undefined)=>n==null?"—":(n>0?"+":"")+Math.round(n);
const fPct=(n:number|null|undefined)=>n==null?"—":(n>=0?"+":"")+n.toFixed(1)+"%";
const localDay=(value:Date=new Date())=>{const p=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value);const x=(s:string)=>p.find(t=>t.type===s)?.value;return x("year")+"-"+x("month")+"-"+x("day")};
const shiftDay=(s:string,n:number)=>{const d=new Date(s+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const eventTime=(v:string|null)=>v?new Date(v).toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/New_York"})+" ET":"TBD";
const marketName=(s:string)=>({h2h:"Moneyline",spreads:"Spread",totals:"Game total",player_points:"Points",player_rebounds:"Rebounds",player_assists:"Assists",player_threes:"3-pointers",player_points_rebounds_assists:"PRA"} as Record<string,string>)[s]||s.replace(/_/g," ");
const formatDate=(s:string)=>new Date(s+"T12:00:00Z").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",timeZone:"UTC"});
const isPrice=(v:number)=>Number.isFinite(v) && v!==0 && Math.abs(v)<=10000;
const net=(p:Pick)=>p.kind!=="WAGER"||p.result==="PENDING"||p.result==="PUSH"?0:p.result==="LOSS"?-p.stake:p.stake*(p.odds>0?p.odds/100:100/Math.abs(p.odds));
function readPicks():Pick[]{try{const v=JSON.parse(localStorage.getItem("courtcash-picks-v1")||"[]");return Array.isArray(v)?v:[]}catch{return []}}
function MarketTile({m,game,onPick}:{m:Market;game:Game;onPick:(m:Market,g:Game,kind:"LEAN"|"WAGER")=>void}) {
  const [expanded,setExpanded]=useState(false);
  return <article className="cc-market">
    <div className="cc-market-head"><small>{marketName(m.market)}{m.player?" · "+m.player:""}</small><span className={m.ev!==null&&m.ev>0?"good":""}>{m.ev===null?"Unrated":fPct(m.ev)+" price gap"}</span></div>
    <h3>{m.selection}</h3>
    <div className="cc-odds"><div><small>Best available</small><b>{fOdds(m.bestBook.odds)}</b><em>{m.bestBook.bookmaker}</em></div><div><small>Peer fair odds</small><b>{fOdds(m.fairOdds)}</b><em>{m.peerBooks} other books</em></div><div><small>Estimated EV</small><b className={m.ev!==null&&m.ev>0?"good":""}>{fPct(m.ev)}</b><em>{m.integrity==="GOOD"?"Higher coverage":m.integrity==="LIMITED"?"Limited coverage":"No reliable estimate"}</em></div></div>
    <div className="cc-buttons"><button onClick={()=>onPick(m,game,"LEAN")}>Save my lean</button><button onClick={()=>onPick(m,game,"WAGER")}>Log wager</button><button className="textbtn" onClick={()=>setExpanded(!expanded)}>{expanded?"Hide":"Compare"} books</button></div>
    {expanded&&<div className="books">{m.books.map((b,i)=><div key={b.bookmakerID+"-"+i} className={b.excluded?"excluded":""}><span>{b.bookmaker}{b.excluded?" (outlier)":""}</span><b>{fOdds(b.odds)}</b></div>)}</div>}
  </article>;
}
function GameCard({g,onOpen}:{g:Game;onOpen:(g:Game)=>void}) {
  const ml=g.markets.filter(x=>x.market==="h2h");
  const away=ml.find(x=>x.side==="away"),home=ml.find(x=>x.side==="home");
  const best=g.markets.find(x=>x.ev!==null&&x.ev>0);
  return <button className="cc-game" onClick={()=>onOpen(g)}>
    <div className="cc-game-head"><span><Clock3 size={13}/>{eventTime(g.startTime)}</span><span className={g.status==="in"?"good":""}>{g.status==="pre"?"UPCOMING":g.status==="post"?"FINAL":g.statusDetail||"LIVE"}</span></div>
    <div className="cc-teams"><div className="cc-team">{g.away.logo&&<img src={g.away.logo} alt="" loading="lazy"/>}<div><small>AWAY · {g.away.record}</small><strong>{g.away.name}</strong><em>{fOdds(away?.bestBook.odds)}</em></div></div><div className="cc-score">{g.status==="pre"?"@":(g.away.score??"–")+" : "+(g.home.score??"–")}</div><div className="cc-team cc-team-home"><div><small>HOME · {g.home.record}</small><strong>{g.home.name}</strong><em>{fOdds(home?.bestBook.odds)}</em></div>{g.home.logo&&<img src={g.home.logo} alt="" loading="lazy"/>}</div></div>
    <div className="cc-game-bottom"><span>{g.markets.length?g.markets.length+" market selections":"No sportsbook lines yet"}</span><b>{best?"Best peer-price gap "+fPct(best.ev):"View matchup"} <ChevronRight size={15}/></b></div>
  </button>;
}
function App(){
  const [tab,setTab]=useState("Games");
  const [date,setDate]=useState(localDay);
  const [feed,setFeed]=useState<Feed|null>(null);
  const [loading,setLoading]=useState(false);
  const [selected,setSelected]=useState<Game|null>(null);
  const [detailTab,setDetailTab]=useState<"Lines"|"Props">("Lines");
  const [props,setProps]=useState<Props|null>(null);
  const [propsLoading,setPropsLoading]=useState(false);
  const [filter,setFilter]=useState("");
  const [onlyPositive,setOnlyPositive]=useState(true);
  const [picks,setPicks]=useState<Pick[]>(readPicks);
  const [stake,setStake]=useState(1);
  const [manual,setManual]=useState({selection:"",odds:"-110",book:"FanDuel",notes:""});
  const [mean,setMean]=useState(20),[sd,setSd]=useState(6),[threshold,setThreshold]=useState(19.5),[labOdds,setLabOdds]=useState(-110);
  const [refreshKey,setRefreshKey]=useState(0);
  useEffect(()=>{localStorage.setItem("courtcash-picks-v1",JSON.stringify(picks))},[picks]);
  useEffect(()=>{
    let active=true;setLoading(true);setFeed(null);setSelected(null);
    fetch("/api/nba?date="+date+"&refresh="+refreshKey,{cache:"no-store"}).then(r=>r.json()).then(d=>{if(active)setFeed(d)}).catch(e=>{if(active)setFeed({ok:false,error:String(e)})}).finally(()=>{if(active)setLoading(false)});
    return ()=>{active=false};
  },[date,refreshKey]);
  useEffect(()=>{
    let active=true;setProps(null);
    if(!selected?.oddsEventId || detailTab!=="Props")return;
    setPropsLoading(true);
    fetch("/api/nba-props?event="+encodeURIComponent(selected.oddsEventId)).then(r=>r.json()).then(d=>{if(active)setProps(d)}).catch(()=>{if(active)setProps({ok:false,error:"Prop feed could not load"})}).finally(()=>{if(active)setPropsLoading(false)});
    return ()=>{active=false};
  },[selected?.oddsEventId,detailTab]);
  const games=feed?.games||[];
  const all=useMemo(()=>games.flatMap(g=>g.markets.map(m=>({m,g}))),[games]);
  const scanner=useMemo(()=>all.filter(({m,g})=>m.fairProbability!==null && (!onlyPositive || (m.ev??0)>0) && (m.selection+" "+m.market+" "+g.away.name+" "+g.home.name).toLowerCase().includes(filter.toLowerCase())).sort((a,b)=>(b.m.ev??-999)-(a.m.ev??-999)),[all,filter,onlyPositive]);
  const wagers=picks.filter(x=>x.kind==="WAGER");
  const settled=wagers.filter(x=>x.result!=="PENDING");
  const wins=settled.filter(x=>x.result==="WIN").length,losses=settled.filter(x=>x.result==="LOSS").length;
  const units=settled.reduce((a,p)=>a+net(p),0);
  const risked=settled.reduce((a,p)=>a+p.stake,0);
  const savePick=(m:Market,g:Game,kind:"LEAN"|"WAGER")=>{
    const p:Pick={id:Date.now().toString()+"-"+Math.random().toString(36).slice(2),game:g.away.name+" @ "+g.home.name,market:marketName(m.market),selection:m.selection,odds:m.bestBook.odds,book:m.bestBook.bookmaker,stake:Math.max(0.1,stake),kind,result:"PENDING",notes:"",createdAt:new Date().toISOString()};
    setPicks(old=>[p,...old]);setTab("Tracker");setSelected(null);
  };
  const changePick=(id:string,changes:Partial<Pick>)=>setPicks(old=>old.map(x=>x.id===id?{...x,...changes}:x));
  const nav=(name:string)=>{setSelected(null);setTab(name)};
  const dOdds=(a:number)=>a>0?1+a/100:1+100/Math.abs(a);
  const z=(threshold-mean)/Math.max(0.1,sd);
  // Abramowitz-Stegun normal-CDF approximation. Manual inputs, NOT an automatic player model.
  const normalCdf=(x:number)=>{const t=1/(1+0.2316419*Math.abs(x));const q=0.3989422804*Math.exp(-x*x/2)*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?1-q:q};
  const over=1-normalCdf(z),labEv=100*(over*dOdds(labOdds)-1);
  if(selected)return <main><header><button className="cc-back" onClick={()=>{setSelected(null);setDetailTab("Lines")}}><ChevronLeft size={23}/> Back</button><div className="brand"><span className="mark">◉</span>COURTCASH</div></header>
    <div className="cc-detail"><p className="eyebrow">NBA MATCHUP DESK</p><h1>{selected.away.name} <span>@</span> {selected.home.name}</h1><p>{eventTime(selected.startTime)} · {selected.statusDetail || "Scheduled"}</p>
      {selected.status!=="pre"&&<h2>{selected.away.score??"–"} — {selected.home.score??"–"}</h2>}
    </div>
    <div className="cc-segments"><button className={detailTab==="Lines"?"selected":""} onClick={()=>setDetailTab("Lines")}>Game lines</button><button className={detailTab==="Props"?"selected":""} onClick={()=>setDetailTab("Props")}>Player props</button></div>
    {detailTab==="Lines"?<section><p className="cc-sub">Best available prices across matching lines. Fair odds use other sportsbooks, not the book being evaluated.</p>{selected.markets.length?selected.markets.map(m=><MarketTile key={m.id} m={m} game={selected} onPick={savePick}/>):<div className="lab"><Info/><h3>No lines for this matchup</h3><p>Game schedule is real, but the configured odds feed has no matching active markets yet.</p></div>}</section>:
    <section>{propsLoading?<div className="lab"><RefreshCw className="spin"/><h3>Loading player props</h3></div>:props?.ok?<><p className="cc-sub">{props.markets?.length||0} selections. Books and prices are real; no automatic player projections are implied.</p>{props.markets?.length?props.markets.map(m=><MarketTile key={m.id} m={m} game={selected} onPick={savePick}/>):<div className="lab"><h3>No covered player props yet</h3><p>Some books post player lines closer to tipoff.</p></div>}</>:<div className="setup"><Info/><h3>Props unavailable</h3><p>{!selected.oddsEventId?"No matching sportsbook event ID is available for this game.":props?.error || "The provider has not returned player lines."}</p><p>NBA prop access requires a plan that supports per-event additional markets.</p></div>}</section>}
    <div className="cc-disclaimer">A positive cross-book price gap is not a validated predictive edge. Check injuries, minutes, line movement, and actual sportsbook availability before making a decision.</div></main>;
  return <main><header><div className="brand"><span className="mark">◉</span>COURTCASH</div><div className="headright"><span className={feed?.ok?"status on":"status"}>{feed?.ok?<Wifi/>:<WifiOff/>}</span><span className="cc-tag">NBA · 2026–27</span></div></header>
    {tab==="Games"&&<><section className="hero cc-hero"><div className="eyebrow"><Activity size={14}/> NBA INTELLIGENCE DESK</div><h1>Better numbers.<span> Better decisions.</span></h1><p>Real NBA schedules and bookmaker prices, on-demand player props, and a separate betting record. No made-up projections or manufactured picks.</p><div className="pills"><b>LIVE NBA</b><span>GAME & PROP LINES</span><span>PRICE COMPARISONS</span></div></section>
      <section className="cc-datebar"><button aria-label="Previous day" onClick={()=>setDate(shiftDay(date,-1))}><ChevronLeft/></button><div><CalendarDays size={16}/><strong>{formatDate(date)}</strong><input aria-label="Choose date" type="date" value={date} onChange={e=>e.target.value&&setDate(e.target.value)}/></div><button aria-label="Next day" onClick={()=>setDate(shiftDay(date,1))}><ChevronRight/></button><button className="cc-today" onClick={()=>setDate(localDay())}>Today</button></section>
      <div className="feed"><div>{loading?<RefreshCw className="spin"/>:feed?.ok?<Wifi/>:<WifiOff/>}<span><b>{loading?"Loading NBA schedule":feed?.ok?"NBA schedule connected":"Schedule offline"}</b><small>{feed?.ok?games.length+" games · odds "+(feed.oddsStatus==="CONNECTED"?"connected":feed.oddsStatus==="KEY_MISSING"?"not configured":"unavailable"):feed?.error||"Checking feeds"}</small></span></div><button aria-label="Refresh" onClick={()=>setRefreshKey(x=>x+1)}><RefreshCw/></button></div>
      {feed?.ok&&feed.oddsStatus!=="CONNECTED"&&<div className="warning"><Info/><p><b>Sportsbook feed not active.</b> {feed.oddsStatus==="KEY_MISSING"?"Add THE_ODDS_API_KEY to Vercel and redeploy.":"The odds provider isn't returning prices right now."} Schedule and bet tracking still work.</p></div>}
      <section className="snapshot"><div><small>GAMES</small><strong>{games.length}</strong><em>selected date</em></div><div><small>PRICED</small><strong>{games.filter(g=>g.markets.length).length}</strong><em>bookmaker coverage</em></div><div><small>WAGER P/L</small><strong className={units>=0?"good":"bad"}>{units>=0?"+":""}{units.toFixed(2)}u</strong><em>settled only</em></div></section>
      <section><div className="sectionhead"><div><small>THE SLATE</small><h2>{formatDate(date)} games</h2></div></div>{loading?<div className="lab"><RefreshCw className="spin"/><h3>Fetching games…</h3></div>:!feed?.ok?<div className="setup"><WifiOff/><h3>Unable to load games</h3><p>{feed?.error||"Try refreshing the schedule."}</p></div>:!games.length?<div className="lab"><CalendarDays/><h3>No games scheduled</h3><p>Choose another date to view NBA matchups.</p></div>:games.map(g=><GameCard key={g.id} g={g} onOpen={g=>{setSelected(g);setDetailTab("Lines")}}/>)}</section></>}
    {tab==="Scanner"&&<section><div className="sectionhead"><div><small>THE MARKET</small><h2>Price scanner</h2></div></div><p className="intro">Compares the best sportsbook price at an identical line against a no-vig consensus of at least two *other* sportsbooks. These are price discrepancies, not independent NBA model picks.</p><div className="cc-datebar cc-date-small"><button onClick={()=>setDate(shiftDay(date,-1))}><ChevronLeft/></button><strong>{formatDate(date)}</strong><button onClick={()=>setDate(shiftDay(date,1))}><ChevronRight/></button></div><div className="search"><Search/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Team, player, market"/></div><label className="cc-toggle"><input type="checkbox" checked={onlyPositive} onChange={e=>setOnlyPositive(e.target.checked)}/> Show positive price gaps only</label><p className="cc-sub">{scanner.length} qualified selections · {all.length} total prices on this slate</p>{scanner.length?scanner.map(({g,m})=><MarketTile key={m.id} m={m} game={g} onPick={savePick}/>):<div className="lab"><Search/><h3>No qualifying prices</h3><p>{feed?.oddsStatus!=="CONNECTED"?"Connect the sportsbook odds provider to activate the scanner.":"There are no lines meeting this filter, or not enough independent books to price them."}</p></div>}</section>}
    {tab==="Tracker"&&<section><div className="sectionhead"><div><small>YOUR RECORD</small><h2>Bet tracker</h2></div></div><p className="intro">Keep original leans separate from actual wagers. Only settled wagers affect units and ROI. Saved locally in this browser.</p><div className="cc-tracker-stats"><div><small>RECORD</small><b>{wins}–{losses}</b></div><div><small>NET</small><b className={units>=0?"good":"bad"}>{units>=0?"+":""}{units.toFixed(2)}u</b></div><div><small>ROI</small><b>{risked?(100*units/risked).toFixed(1)+"%":"—"}</b></div></div>
      <div className="cc-entry"><h3>Manual entry</h3><input value={manual.selection} onChange={e=>setManual({...manual,selection:e.target.value})} placeholder="e.g. Bam Adebayo Over 16.5 points"/><div className="cc-entry-row"><label>Odds<input type="number" value={manual.odds} onChange={e=>setManual({...manual,odds:e.target.value})}/></label><label>Book<input value={manual.book} onChange={e=>setManual({...manual,book:e.target.value})}/></label><label>Stake (u)<input type="number" min=".1" step=".1" value={stake} onChange={e=>setStake(Math.max(0.1,Number(e.target.value)||0.1))}/></label></div><textarea value={manual.notes} onChange={e=>setManual({...manual,notes:e.target.value})} placeholder="Your initial read / reason for this selection"/><div className="cc-buttons"><button disabled={!manual.selection.trim()||!isPrice(Number(manual.odds))} onClick={()=>{setPicks(old=>[{id:Date.now()+"-"+Math.random(),selection:manual.selection,game:"Manual entry",market:"Custom",odds:Number(manual.odds),book:manual.book,stake,kind:"LEAN",result:"PENDING",notes:manual.notes,createdAt:new Date().toISOString()},...old]);setManual({...manual,selection:"",notes:""})}}>Save lean</button><button disabled={!manual.selection.trim()||!isPrice(Number(manual.odds))} onClick={()=>{setPicks(old=>[{id:Date.now()+"-"+Math.random(),selection:manual.selection,game:"Manual entry",market:"Custom",odds:Number(manual.odds),book:manual.book,stake,kind:"WAGER",result:"PENDING",notes:manual.notes,createdAt:new Date().toISOString()},...old]);setManual({...manual,selection:"",notes:""})}}>Log wager</button></div></div>
      <div className="sectionhead"><div><small>HISTORY</small><h2>Recorded selections</h2></div></div>{picks.length?picks.map(p=><article className="cc-pick" key={p.id}><div className="cc-picktop"><span>{p.kind==="LEAN"?"INITIAL LEAN":"OFFICIAL WAGER"}</span><b>{p.result}</b></div><h3>{p.selection}</h3><p>{p.game} · {p.market} · {p.book} {fOdds(p.odds)}</p><div className="cc-entry-row"><label>Stake (u)<input aria-label="Stake in units" type="number" min=".1" step=".1" value={p.stake} onChange={e=>changePick(p.id,{stake:Math.max(.1,Number(e.target.value)||.1)})}/></label><label>Type<select value={p.kind} onChange={e=>changePick(p.id,{kind:e.target.value as Pick["kind"],result:"PENDING"})}><option value="LEAN">Initial lean</option><option value="WAGER">Wager</option></select></label><label>Result<select value={p.result} disabled={p.kind!=="WAGER"} onChange={e=>changePick(p.id,{result:e.target.value as Pick["result"]})}><option value="PENDING">Pending</option><option value="WIN">Won</option><option value="LOSS">Lost</option><option value="PUSH">Push</option></select></label></div><textarea aria-label="Notes" value={p.notes} placeholder="Your reasoning, injuries, usage notes…" onChange={e=>changePick(p.id,{notes:e.target.value})}/><div className="cc-pickfoot"><span>{new Date(p.createdAt).toLocaleDateString()}</span><b className={net(p)>=0?"good":"bad"}>{p.kind==="WAGER"&&p.result!=="PENDING"?(net(p)>=0?"+":"")+net(p).toFixed(2)+"u":"Not settled"}</b><button onClick={()=>{if(confirm("Remove this entry from your tracker?"))setPicks(old=>old.filter(x=>x.id!==p.id))}}>Remove</button></div></article>):<div className="lab"><Target/><h3>No picks recorded yet</h3><p>Save a lean or log a wager from a matchup, scanner, or manual entry.</p></div>}</section>}
    {tab==="Lab"&&<section><div className="sectionhead"><div><small>INDEPENDENT INPUTS</small><h2>Projection lab</h2></div></div><p className="intro">Evaluate a player-prop Over using your own mean and uncertainty instead of copying sportsbook consensus. Inputs are manual and the normal distribution is an approximation; this is not an automatically trained model.</p><div className="cc-lab"><label>Projected average <strong>{mean.toFixed(1)}</strong></label><input type="range" min="0" max="60" step=".5" value={mean} onChange={e=>setMean(Number(e.target.value))}/><label>Standard deviation <strong>{sd.toFixed(1)}</strong></label><input type="range" min="1" max="25" step=".5" value={sd} onChange={e=>setSd(Number(e.target.value))}/><div className="cc-entry-row"><label>Prop line<input type="number" step=".5" value={threshold} onChange={e=>setThreshold(Number(e.target.value))}/></label><label>Over odds<input type="number" value={labOdds} onChange={e=>setLabOdds(Number(e.target.value)||-110)}/></label></div><div className="cc-lab-result"><div><small>YOUR OVER PROBABILITY</small><strong>{(100*over).toFixed(1)}%</strong></div><div><small>EST. EV AT INPUT ODDS</small><strong className={labEv>0?"good":"bad"}>{fPct(labEv)}</strong></div></div><p>This calculator assumes an approximately normal stat distribution. It excludes injury uncertainty, minutes volatility, correlation, late lineup changes, and push outcomes on whole-number lines.</p></div></section>}
    {tab==="About"&&<section><div className="sectionhead"><div><small>ENGINE HEALTH</small><h2>How it works</h2></div></div><div className="model"><ShieldCheck/><h3>Clear separation of facts and estimates</h3><p><b>Schedule & scores:</b> ESPN public NBA scoreboard, by selected Eastern date.</p><p><b>Odds:</b> The Odds API v4, queried from a serverless endpoint so your key stays private. The server returns only matching line comparisons and covered games.</p><p><b>Player props:</b> Pulled on demand per sportsbook event. They depend on your odds API plan, current bookmaker coverage, and a valid key.</p><p><b>Price signal:</b> Each candidate book is excluded from its own no-vig fair-price estimate. At least two other book quotes are required to show EV. It is still consensus pricing, not predictive modeling.</p><p><b>Performance:</b> User-controlled log of leans versus placed bets, manually settled with unit-based ROI, stored in this device/browser.</p><p className="note">There is no automatically validated player projection, injury model, or historical backtest in this release. Those require reliable NBA statistical history and out-of-sample evaluation before turning into official picks.</p></div></section>}
    <nav>{[["Games",Activity],["Scanner",TrendingUp],["Tracker",WalletCards],["Lab",FlaskConical],["About",BookOpen]].map(([name,Icon]:any)=><button key={name} className={tab===name?"active":""} onClick={()=>nav(name)}><Icon size={19}/><span>{name}</span></button>)}</nav>
  </main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
