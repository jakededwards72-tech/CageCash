import React,{useEffect,useMemo,useState} from "react";
import {BarChart3,Info,RefreshCw} from "lucide-react";
type Athlete={id:string;name:string;position:string;headshot:string|null};
type Log={eventId:string;date:string;opponent:string;result:string;min:number;pts:number|null;reb:number|null;ast:number|null;threes:number|null;pra:number|null};
type Metric={currentGames:number;priorGames:number;last5:number|null;last10:number|null;prior10:number|null;baseline:number|null;stdDev:number|null};
type Research={ok:boolean;current?:Log[];previous?:Log[];metrics?:Record<string,Metric>;season?:number;error?:string;warning?:string};
const STATS=[["pts","Points"],["reb","Rebounds"],["ast","Assists"],["threes","3-pointers"],["pra","PRA"],["min","Minutes"]] as const;
const fmt=(v:number|null|undefined)=>v==null?"—":v.toFixed(1);
export default function ResearchPanel({game,onUse}:{game:{id:string;startTime:string|null;away:{teamId:string|null;name:string};home:{teamId:string|null;name:string}};onUse:(v:number,sd:number,line:number)=>void}) {
 const [roster,setRoster]=useState<{away:Athlete[];home:Athlete[];ok:boolean;error?:string}|null>(null);
 const [rosterLoading,setRosterLoading]=useState(true);
 const [athlete,setAthlete]=useState("");
 const [research,setResearch]=useState<Research|null>(null);
 const [loading,setLoading]=useState(false);
 const [metric,setMetric]=useState("pts");
 const [line,setLine]=useState("19.5");
 useEffect(()=>{
   let active=true;setRoster(null);setAthlete("");setRosterLoading(true);
   if(!game.away.teamId||!game.home.teamId) {
     setRoster({ok:false,away:[],home:[],error:"This game has no official ESPN team IDs."});setRosterLoading(false);return;
   }
   fetch("/api/nba-roster?away="+encodeURIComponent(game.away.teamId)+"&home="+encodeURIComponent(game.home.teamId))
     .then(r=>r.json()).then(data=>{if(active){setRoster(data);const a=[...(data.away||[]),...(data.home||[])];if(a.length)setAthlete(String(a[0].id))}})
     .catch(()=>{if(active)setRoster({ok:false,away:[],home:[],error:"Could not load ESPN team rosters"})})
     .finally(()=>{if(active)setRosterLoading(false)});
   return ()=>{active=false};
 },[game.id]);
 useEffect(()=>{
   let active=true;setResearch(null);
   if(!athlete||!game.startTime)return;
   setLoading(true);
   fetch("/api/nba-research?athlete="+encodeURIComponent(athlete)+"&cutoff="+encodeURIComponent(game.startTime))
     .then(r=>r.json()).then(data=>{if(active)setResearch(data)})
     .catch(()=>{if(active)setResearch({ok:false,error:"The player game log did not load"})})
     .finally(()=>{if(active)setLoading(false)});
   return ()=>{active=false};
 },[athlete,game.startTime]);
 const all=[...(roster?.away||[]),...(roster?.home||[])];
 const who=all.find(p=>p.id===athlete);
 const metricData=research?.metrics?.[metric];
 const current=research?.current||[];
 const previous=research?.previous||[];
 const numericLine=Number(line);
 const sample=current.length?current:previous;
 const valid=sample.filter(g=>typeof (g as any)[metric]==="number");
 const hits=valid.filter(g=>(g as any)[metric]>numericLine).length;
 const hitText=valid.length&&Number.isFinite(numericLine)?hits+"/"+valid.length+" over ("+(100*hits/valid.length).toFixed(0)+"%)":"—";
 return <section className="cc-research">
   <div className="cc-research-title"><BarChart3/><div><h2>Player performance research</h2><p>Actual ESPN games strictly before this matchup. Current season is displayed separately from last season.</p></div></div>
   {rosterLoading?<div className="lab"><RefreshCw className="spin"/><h3>Loading rosters</h3></div>:!roster?.ok?<div className="setup"><Info/><h3>Rosters unavailable</h3><p>{roster?.error}</p></div>:<>
     <label className="cc-player-select">Select player<select value={athlete} onChange={e=>setAthlete(e.target.value)}>
       <optgroup label={game.away.name}>{(roster.away||[]).map(a=><option value={a.id} key={a.id}>{a.name} · {a.position}</option>)}</optgroup>
       <optgroup label={game.home.name}>{(roster.home||[]).map(a=><option value={a.id} key={a.id}>{a.name} · {a.position}</option>)}</optgroup>
     </select></label>
     {loading?<div className="lab"><RefreshCw className="spin"/><h3>Loading pre-game results</h3></div>:!research?.ok?<div className="setup"><Info/><h3>No verified game log</h3><p>{research?.error||"Choose a player to load their results."}</p></div>:<>
       <div className="cc-player-label">{who?.headshot&&<img src={who.headshot} alt="" loading="lazy"/>}<div><small>VERIFIED GAME HISTORY</small><h3>{who?.name||"Player"}</h3><span>{current.length} current-season games · {previous.length} prior-season games available</span></div></div>
       {current.length<5&&<div className="warning"><Info/><p><b>Small current-season sample.</b> Early-season results can swing sharply due to minutes, rotation changes, injuries, and opponent quality. Last year's games are labeled separately.</p></div>}
       <div className="cc-research-metrics">{STATS.map(([key,label])=><button className={metric===key?"selected":""} onClick={()=>setMetric(key)} key={key}><small>{label}</small><strong>{fmt(research.metrics?.[key]?.last5)}</strong><em>L5 average</em></button>)}</div>
       <div className="cc-research-detail"><div className="cc-research-values"><div><small>LAST 5 · CURRENT</small><strong>{fmt(metricData?.last5)}</strong></div><div><small>LAST 10 · CURRENT</small><strong>{fmt(metricData?.last10)}</strong></div><div><small>LAST 10 · PRIOR</small><strong>{fmt(metricData?.prior10)}</strong></div></div>
         <div className="cc-hitrate"><label>Compare {STATS.find(x=>x[0]===metric)?.[1]} to a line<input type="number" step=".5" value={line} onChange={e=>setLine(e.target.value)}/></label><div><small>{current.length?"CURRENT":"PRIOR"} SAMPLE HIT RATE</small><b>{hitText}</b><em>Past results do not equal future probability</em></div></div>
         <button className="cc-lab-link" disabled={metricData?.baseline==null} onClick={()=>onUse(metricData!.baseline!,Math.max(1,metricData!.stdDev||1),Number.isFinite(numericLine)?numericLine:19.5)}>Explore these inputs in projection lab</button>
       </div>
       <h3 className="cc-log-header">Recent games before matchup</h3>
       <div className="cc-log-wrap"><table className="cc-log"><thead><tr><th>Date</th><th>Opp</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>3PM</th><th>PRA</th></tr></thead><tbody>{current.slice(0,12).map(g=><tr key={g.eventId}><td>{new Date(g.date).toLocaleDateString("en-US",{month:"numeric",day:"numeric",timeZone:"UTC"})}</td><td>{g.opponent}</td><td>{Math.round(g.min)}</td><td>{g.pts??"—"}</td><td>{g.reb??"—"}</td><td>{g.ast??"—"}</td><td>{g.threes??"—"}</td><td>{g.pra??"—"}</td></tr>)}</tbody></table></div>
       {!current.length&&<p className="cc-sub">No current-season games precede the selected matchup. Prior season is used only as a labeled historical reference.</p>}
       <div className="cc-disclaimer">ESPN's public game logs are unofficial and may be incomplete. No injury report, confirmed minutes, usage adjustment, strength-of-schedule adjustment, or independently calibrated wager probability is implied.</div>
     </>}
   </>}
 </section>;
}
