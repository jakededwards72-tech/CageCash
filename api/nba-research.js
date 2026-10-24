import {parseGameLog,describeLogs} from "../lib/nba-stats.mjs";
const BASE="https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/";
async function gameLog(id,year){
  const url=BASE+encodeURIComponent(id)+"/gamelog?season="+year;
  const r=await fetch(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(9000)});
  if(!r.ok)throw new Error("ESPN game log unavailable");
  return r.json();
}
export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
  const athlete=String(req.query.athlete||""),cutoff=String(req.query.cutoff||"");
  if(!/^[0-9]{3,12}$/.test(athlete)||!Number.isFinite(Date.parse(cutoff)))
    return res.status(400).json({ok:false,error:"Valid ESPN athlete ID and cutoff required"});
  const when=new Date(cutoff),season=when.getUTCFullYear()+(when.getUTCMonth()>=6?1:0);
  let current=[],previous=[],currentError=null,previousError=null;
  try{current=parseGameLog(await gameLog(athlete,season),cutoff)}
  catch(e){currentError=String(e?.message||e)}
  // Previous season is labelled separately and never silently mixed with the current season.
  if(current.length<10){
    try{previous=parseGameLog(await gameLog(athlete,season-1),cutoff)}
    catch(e){previousError=String(e?.message||e)}
  }
  if(!current.length&&!previous.length)
    return res.status(503).json({ok:false,code:"NO_LOGS",error:"No pre-game ESPN game logs available for this player.",details:{currentError,previousError}});
  res.setHeader("Cache-Control","public,s-maxage=900,stale-while-revalidate=1800");
  return res.status(200).json({ok:true,athlete,cutoff,season,
    current:current.slice(0,20),previous:previous.slice(0,12),metrics:describeLogs(current,previous),
    source:"ESPN athlete game logs",fetchedAt:new Date().toISOString(),
    warning:"Descriptive history only; no lineup/injury adjustment and no calibrated prediction."});
}
