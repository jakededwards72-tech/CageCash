import React,{useEffect,useMemo,useState} from "react";
import {Activity,BarChart3,Info,RefreshCw,Target,SlidersHorizontal,Save} from "lucide-react";
import {americanBreakEven,projectPlayerMetric,walkForwardError} from "./lib/nba-projection.mjs";
type Athlete={id:string;name:string;position:string;headshot:string|null;status?:string|null;injuries?:string[]};
type Log={eventId:string;date:string;opponent:string;result:string;min:number;pts:number|null;reb:number|null;ast:number|null;threes:number|null;pra:number|null};
type Research={ok:boolean;current?:Log[];previous?:Log[];error?:string;warning?:string;source?:string};
type Game={id:string;startTime:string|null;away:{teamId:string|null;name:string};home:{teamId:string|null;name:string}};
type Saved={selection:string;odds:number;book:string;notes:string;kind:"LEAN"|"WAGER";market:string};
const STATS=[["pts","Points"],["reb","Rebounds"],["ast","Assists"],["threes","3-pointers made"],["pra","Pts + reb + ast"]] as const;
const fmt=(v:number|null|undefined,d=1)=>v==null||!Number.isFinite(v)?"—":v.toFixed(d);
const pct=(v:number|null|undefined)=>v==null?"—":(100*v).toFixed(1)+"%";
export default function ProjectionPanel({game,onUse,onRecord}:{game:Game;onUse:(avg:number,sd:number,line:number)=>void;onRecord:(p:Saved)=>void}){
 const [roster,setRoster]=useState<{away:Athlete[];home:Athlete[];ok:boolean;error?:string}|null>(null);
 const [rosterLoading,setRosterLoading]=useState(true);
 const [athlete,setAthlete]=useState("");
 const [search,setSearch]=useState("");
 const [research,setResearch]=useState<Research|null>(null);
 const [loading,setLoading]=useState(false);
 const [metric,setMetric]=useState("pts");
 const [line,setLine]=useState("");
 const [odds,setOdds]=useState("");
 const [book,setBook]=useState("");
 const [minutes,setMinutes]=useState("");
 const [side,setSide]=useState<"Over"|"Under">("Over");
 useEffect(()=>{
   let active=true;setRoster(null);setAthlete("");setSearch("");setRosterLoading(true);
   if(!game.away.teamId||!game.home.teamId){
     setRoster({ok:false,away:[],home:[],error:"ESPN team IDs are not available for this matchup."});setRosterLoading(false);return;
   }
   fetch("/api/nba-roster?away="+encodeURIComponent(game.away.teamId)+"&home="+encodeURIComponent(game.home.teamId))
    .then(r=>r.json()).then(d=>{if(active){setRoster(d);const list=[...(d.away||[]),...(d.home||[])];if(list.length)setAthlete(String(list[0].id));}})
    .catch(()=>{if(active)setRoster({ok:false,away:[],home:[],error:"The NBA rosters could not be loaded."})})
    .finally(()=>{if(active)setRosterLoading(false)});
   return ()=>{active=false};
 },[game.id]);
 useEffect(()=>{
   let active=true;setResearch(null);setMinutes("");setLine("");setOdds("");
   if(!athlete||!game.startTime)return;
   setLoading(true);
   fetch("/api/nba-research?athlete="+encodeURIComponent(athlete)+"&cutoff="+encodeURIComponent(game.startTime)+"&game="+encodeURIComponent(game.id))
    .then(r=>r.json()).then(d=>{if(active)setResearch(d)})
    .catch(()=>{if(active)setResearch({ok:false,error:"The pregame player logs could not be loaded."})})
    .finally(()=>{if(active)setLoading(false)});
   return ()=>{active=false};
 },[athlete,game.id,game.startTime]);
 const players=[...(roster?.away||[]),...(roster?.home||[])];
 const who=players.find(a=>a.id===athlete);
 const visible=players.filter(a=>a.name.toLowerCase().includes(search.trim().toLowerCase()));
 const current=research?.current||[],previous=research?.previous||[];
 const lineValue=line.trim()===""?null:Number(line);
 const oddsValue=odds.trim()===""?null:Number(odds);
 const minutesValue=minutes.trim()===""?null:Number(minutes);
 const result=useMemo(()=>research?.ok?projectPlayerMetric(current,previous,metric,{line:lineValue,minutesOverride:minutesValue}):null,[research,metric,lineValue,minutesValue]);
 const validation=useMemo(()=>research?.ok?walkForwardError(current,previous,metric):null,[research,metric]);
 const p=result?(side==="Over"?result.over:result.under):null;
 const implied=oddsValue===null?null:americanBreakEven(oddsValue);
 const ev=implied!==null&&p!==null&&oddsValue!==null?100*(p/(implied)-1)*(1-implied)/(1- p + p*(1-implied)/implied):null;
 // Exact expected profit per 1 unit staked, using the experimental probability.
 const dec=oddsValue!==null&&implied!==null?1/implied:null;
 const estimatedEV=dec!==null&&p!==null?(100*(p*dec-1)):null;
 const marketLabel=STATS.find(x=>x[0]===metric)?.[1]||metric;
 const lineReady=lineValue!==null&&Number.isFinite(lineValue)&&lineValue>=0;
 const canBet=lineReady&&oddsValue!==null&&implied!==null;
 const save=(kind:"LEAN"|"WAGER")=>{
  if(!who||!lineReady||!result||kind==="WAGER"&&!canBet)return;
  const selection=who.name+" "+side+" "+lineValue+" "+marketLabel;
  const notes="Experimental pregame estimate: "+fmt(result.projection)+" "+marketLabel+"; projected minutes "+fmt(result.minutes)+"; approx. 80% range "+fmt(result.range80[0])+"–"+fmt(result.range80[1])+"; data "+result.currentGames+" current + "+result.previousGames+" prior games; "+result.confidence+" sample confidence. The estimated probability is uncalibrated. Original reasoning: ";
  onRecord({selection,odds:canBet?oddsValue!:0,book:book.trim()||"Manual / unverified",notes,kind,market:marketLabel});
 };
 return <section className="cc-research cc-projection">
  <div className="cc-research-title"><Target/><div><h2>Player prop projection engine</h2><p>Independent estimate from pregame NBA logs and expected minutes. No sportsbook subscription required.</p></div></div>
  {rosterLoading?<div className="lab"><RefreshCw className="spin"/><h3>Loading NBA players…</h3></div>:!roster?.ok?<div className="setup"><Info/><h3>Unable to load NBA players</h3><p>{roster?.error}</p></div>:<>
    <div className="cc-project-controls">
     <label>Find a player<input value={search} placeholder="Search either team's roster" onChange={e=>setSearch(e.target.value)}/></label>
     <label>Choose player<select value={athlete} onChange={e=>setAthlete(e.target.value)}>
       {visible.length?visible.map(a=><option value={a.id} key={a.id}>{a.name} · {a.position}</option>):<option value={athlete}>No matches — clear search</option>}
     </select></label>
    </div>
    {who&&<div className="cc-player-label">{who.headshot&&<img src={who.headshot} alt="" loading="lazy"/>}<div><small>INDEPENDENT PLAYER ANALYSIS</small><h3>{who.name}</h3><span>{current.length} current-season · {previous.length} previous-season pregame logs</span></div></div>}
    {loading?<div className="lab"><RefreshCw className="spin"/><h3>Building player profile…</h3></div>:!research?.ok?<div className="setup"><Info/><h3>Player history unavailable</h3><p>{research?.error||"Select a player to analyze."}</p><p>Sportsbook odds are unrelated to this connection. If the ESPN feed is down, try another player.</p></div>:<>
     <div className="cc-metric-tabs">{STATS.map(([k,label])=><button className={metric===k?"selected":""} key={k} onClick={()=>{setMetric(k);setLine("")}}>{label}</button>)}</div>
     {!result?<div className="setup"><Info/><h3>Insufficient historical sample</h3><p>This player's available log contains fewer than three current-season games and fewer than eight prior-season games with valid minutes and {marketLabel.toLowerCase()}.</p><p>No estimate is shown rather than inventing a projection.</p></div>:<>
       <div className="cc-model-hero">
        <div><small>PROJECTED {marketLabel.toUpperCase()}</small><strong>{fmt(result.projection)}</strong><span>{result.minutesOverrideUsed?"Manual minutes scenario":"Automatic minutes estimate"}</span></div>
        <div><small>EST. MINUTES</small><strong>{fmt(result.minutes)}</strong><span>Last 5 median: {fmt(result.recentMinutes)}</span></div>
        <div><small>APPROX. 80% RANGE</small><strong>{fmt(result.range80[0])}–{fmt(result.range80[1])}</strong><span>Not a calibrated interval</span></div>
       </div>
       <div className="cc-model-evidence">
        <div><small>LAST 5 · CURRENT</small><b>{fmt(result.currentL5)}</b></div>
        <div><small>LAST 10 · CURRENT</small><b>{fmt(result.currentL10)}</b></div>
        <div><small>LAST 10 · PRIOR</small><b>{fmt(result.priorL10)}</b></div>
       </div>
       <div className="cc-project-controls">
        <label>Projected playing time (minutes)<input type="number" min="0" max="48" step=".5" placeholder={"Auto: "+fmt(result.automaticMinutes)} value={minutes} onChange={e=>setMinutes(e.target.value)}/><small>Override for rotation or injury news; blank = auto.</small></label>
        <label>Your sportsbook line<input type="number" min="0" step=".5" placeholder="Enter any line (e.g. 19.5)" value={line} onChange={e=>setLine(e.target.value)}/><small>Does not require an API or supported prop market.</small></label>
       </div>
       {lineReady&&<div className="cc-model-comparison">
        <div className="cc-side-toggle"><button className={side==="Over"?"selected":""} onClick={()=>setSide("Over")}>Over {lineValue}</button><button className={side==="Under"?"selected":""} onClick={()=>setSide("Under")}>Under {lineValue}</button></div>
        <div className="cc-model-numbers"><div><small>EXPERIMENTAL {side.toUpperCase()} CHANCE</small><strong>{pct(p)}</strong></div><div><small>PAST GAMES OVER LINE</small><strong>{result.recentHits}/{result.recentHitGames}</strong><span>{result.currentGames?"Current season":"Previous season"}</span></div></div>
        <p>This estimate uses an approximate distribution of player outcomes, not sportsbook consensus. It has not been calibrated or validated for betting.</p>
       </div>}
       <div className="cc-project-controls">
        <label>Sportsbook odds (optional)<input type="number" placeholder="e.g. -110" value={odds} onChange={e=>setOdds(e.target.value)}/></label>
        <label>Sportsbook name (optional)<input value={book} onChange={e=>setBook(e.target.value)} placeholder="e.g. FanDuel"/></label>
       </div>
       {implied!==null&&lineReady&&<div className="cc-price-test"><div><small>BREAK-EVEN AT INPUT ODDS</small><b>{pct(implied)}</b></div><div><small>MODEL-ASSUMED EV</small><b className={estimatedEV!==null&&estimatedEV>0?"good":"bad"}>{estimatedEV!==null?(estimatedEV>=0?"+":"")+fmt(estimatedEV)+"%":"—"}</b></div><p>Exploratory comparison only. Model probabilities can be wrong; positive model EV is not proof of a profitable bet.</p></div>}
       <div className="cc-model-actions"><button disabled={!lineReady} onClick={()=>save("LEAN")}><Save size={15}/> Save initial lean</button><button disabled={!canBet} onClick={()=>save("WAGER")}>Log actual wager</button><button disabled={!lineReady} className="secondary" onClick={()=>onUse(result.projection,result.uncertainty,lineValue!)}>Open scenario lab</button></div>
       <div className="cc-confidence"><Info size={17}/><p><b>Model confidence: {result.confidence.replace("_"," ")}.</b> Inputs: {result.currentGames} valid current-season and {result.previousGames} valid prior-season games; current-season rate weight {(result.currentWeight*100).toFixed(0)}%. The model blends scoring rates and recent minutes but does not know today's injuries, role changes, rest, opponent defense or pace. {result.warning}</p></div>
       {validation&&<p className="cc-backtest"><b>Historical walk-forward error:</b> {fmt(validation.mae)} {marketLabel.toLowerCase()} MAE across {validation.n} past games, versus {fmt(validation.baselineMae)} for a simple 8-game average. This is a small descriptive check, not independent validation.</p>}
       <h3 className="cc-log-header">Game logs available before this matchup</h3>
       <div className="cc-log-wrap"><table className="cc-log"><thead><tr><th>Date</th><th>Season</th><th>Opp</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>3PM</th><th>PRA</th></tr></thead><tbody>{[...current.slice(0,10).map(g=>({...g,season:"Current"})),...previous.slice(0,7).map(g=>({...g,season:"Prior"}))].map(g=><tr key={g.eventId}><td>{new Date(g.date).toLocaleDateString("en-US",{month:"numeric",day:"numeric",timeZone:"UTC"})}</td><td>{g.season}</td><td>{g.opponent}</td><td>{fmt(g.min,0)}</td><td>{g.pts??"—"}</td><td>{g.reb??"—"}</td><td>{g.ast??"—"}</td><td>{g.threes??"—"}</td><td>{g.pra??"—"}</td></tr>)}</tbody></table></div>
     </>}
     <p className="cc-sub">Data: ESPN pregame game logs. Prior and current seasons are never silently merged. The model excludes games played at or after this matchup's scheduled tipoff.</p>
    </>}
  </>}
 </section>;
}
