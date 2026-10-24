import {normalizeOddsEvents,matchOddsGame} from "../lib/nba-pricing.mjs";
const ESPN="https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";
const ODDS="https://api.the-odds-api.com/v4/sports/basketball_nba/odds/";
function easternDate(value) {
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(value));
  const part=k=>parts.find(p=>p.type===k)?.value;
  return part("year")+"-"+part("month")+"-"+part("day");
}
const currentDate=()=>easternDate(Date.now());
async function jsonRequest(url) {
  const response=await fetch(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(9000)});
  const body=await response.json().catch(()=>null);
  return {response,body};
}
function fromESPN(raw) {
  return (raw?.events || []).map(e=>{
    const comp=e.competitions?.[0] || {};
    const competitors=comp.competitors || [];
    const team=(side)=>{
      const c=competitors.find(x=>x.homeAway===side) || {};
      return {name:c.team?.displayName || "Unknown",abbr:c.team?.abbreviation || "",
        teamId:c.team?.id || null,logo:c.team?.logo || c.team?.logos?.[0]?.href || null,
        record:c.records?.find(x=>x.type==="total")?.summary || "",
        score:c.score === undefined ? null : Number(c.score)};
    };
    return {id:String(e.id),oddsEventId:null,startTime:e.date || comp.date || null,
      status:e.status?.type?.state || "pre",statusDetail:e.status?.type?.shortDetail || e.status?.type?.detail || "",
      away:team("away"),home:team("home"),markets:[]};
  });
}
export default async function handler(req,res) {
  if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
  const date=typeof req.query.date==="string" ? req.query.date : currentDate();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date+"T12:00:00Z"))) {
    return res.status(400).json({ok:false,error:"Date must be YYYY-MM-DD"});
  }
  const espnUrl=ESPN+"?dates="+date.replace(/-/g,"")+"&limit=100";
  const key=process.env.THE_ODDS_API_KEY || process.env.SPORTSGAMEODDS_API_KEY; // legacy CageCash Vercel variable
  const oddsUrl=new URL(ODDS);
  oddsUrl.searchParams.set("apiKey",key || "");
  oddsUrl.searchParams.set("regions","us");
  oddsUrl.searchParams.set("markets","h2h,spreads,totals");
  oddsUrl.searchParams.set("oddsFormat","american");
  const [schedule,prices]=await Promise.allSettled([
    jsonRequest(espnUrl),
    key?jsonRequest(oddsUrl):Promise.resolve(null)
  ]);
  const s=schedule.status==="fulfilled" ? schedule.value : null;
  const scheduleOK=Boolean(s?.response?.ok && Array.isArray(s.body?.events));
  let games=scheduleOK ? fromESPN(s.body) : [];
  let oddsStatus=key?"UNAVAILABLE":"KEY_MISSING",oddsError=null,quota=null;
  const o=prices.status==="fulfilled"?prices.value:null;
  let events=[];
  if(key && o?.response?.ok && Array.isArray(o.body)) {
    events=normalizeOddsEvents(o.body);
    oddsStatus="CONNECTED";
    quota={remaining:o.response.headers.get("x-requests-remaining")};
  } else if(key) {
    oddsStatus=o?.response?.status===401 || o?.response?.status===403?"KEY_REJECTED":"UNAVAILABLE";
    oddsError=o?.body?.message || o?.body?.error_code || (prices.status==="rejected" ? "Odds feed timed out" : "Odds provider unavailable");
  }
  // The scoreboard drives the date navigation, and sportsbook event IDs are kept separate.
  for(const game of games) {
    const match=matchOddsGame(game,events);
    if(match) {
      game.oddsEventId=match.eventId;
      game.markets=match.markets;
    }
  }
  if(!scheduleOK) {
    games=events.filter(e=>e.startTime && easternDate(e.startTime)===date).map(e=>({
      id:"odds:"+e.eventId,oddsEventId:e.eventId,startTime:e.startTime,
      status:"pre",statusDetail:"Schedule feed unavailable",markets:e.markets,
      away:{name:e.away,abbr:"",teamId:null,logo:null,record:"",score:null},
      home:{name:e.home,abbr:"",teamId:null,logo:null,record:"",score:null}
    }));
  }
  games.sort((a,b)=>new Date(a.startTime || 0)-new Date(b.startTime || 0));
  res.setHeader("Cache-Control","public, s-maxage=75, stale-while-revalidate=120");
  if(!scheduleOK && !games.length) {
    return res.status(502).json({ok:false,date,code:"SCHEDULE_UNAVAILABLE",
      error:"Could not load the NBA schedule. Please retry.",oddsStatus,oddsError,games:[]});
  }
  return res.status(200).json({ok:true,date,games,oddsStatus,oddsError,
    scheduleStatus:scheduleOK?"CONNECTED":"UNAVAILABLE",
    provider:"ESPN schedule + The Odds API markets",
    fetchedAt:new Date().toISOString(),quota});
}
