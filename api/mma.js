const BASE = "https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds/";

function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function decToAmerican(d){d=num(d);if(!d||d<=1)return null;return d>=2?Math.round((d-1)*100):Math.round(-100/(d-1))}
function impliedFromDecimal(d){d=num(d);return d&&d>1?1/d:null}
function americanToDecimal(o){o=num(o);if(o===null||o===0)return null;return o>0?1+o/100:1+100/Math.abs(o)}
function noVigPair(a,b){const pa=impliedFromDecimal(a),pb=impliedFromDecimal(b);if(pa===null||pb===null)return null;const s=pa+pb;return s?{a:pa/s,b:pb/s}:null}
function fairAmerican(p){if(!p||p<=0||p>=1)return null;return p>=.5?Math.round(-100*p/(1-p)):Math.round(100*(1-p)/p)}
function bookName(k,t){return t||String(k||"").replace(/[_-]/g," ").replace(/\b\w/g,m=>m.toUpperCase())}

function normalizeEvent(e){
  const away=e.away_team||e.teams?.[0]||"Away fighter";
  const home=e.home_team||e.teams?.[1]||"Home fighter";
  const quotes=[];
  for(const book of e.bookmakers||[]){
    const market=(book.markets||[]).find(m=>m.key==="h2h");
    if(!market)continue;
    const byName={};
    for(const out of market.outcomes||[])byName[out.name]=out;
    const aq=byName[away],hq=byName[home];
    if(!aq||!hq)continue;
    const av=num(aq.price),hv=num(hq.price);
    if(av===null||hv===null)continue;
    quotes.push({bookmakerID:book.key,title:bookName(book.key,book.title),lastUpdate:market.last_update||book.last_update||null,awayDecimal:av,homeDecimal:hv,awayOdds:decToAmerican(av),homeOdds:decToAmerican(hv)});
  }
  const bestAway=quotes.slice().sort((x,y)=>y.awayDecimal-x.awayDecimal)[0]||null;
  const bestHome=quotes.slice().sort((x,y)=>y.homeDecimal-x.homeDecimal)[0]||null;

  // Consensus no-vig probability: de-vig each two-way book first, then average.
  const fair=quotes.map(q=>noVigPair(q.awayDecimal,q.homeDecimal)).filter(Boolean);
  const awayP=fair.length?fair.reduce((s,x)=>s+x.a,0)/fair.length:null;
  const homeP=fair.length?fair.reduce((s,x)=>s+x.b,0)/fair.length:null;

  const mk=(side,best,p)=>best?{
    oddID:e.id+":h2h:"+side,
    marketName:"Fight winner",
    periodID:"game",
    betTypeID:"ml",
    sideID:side,
    fairOdds:fairAmerican(p),
    fairProbability:p,
    bestBook:{bookmakerID:best.bookmakerID,odds:side==="away"?best.awayOdds:best.homeOdds,decimal:side==="away"?best.awayDecimal:best.homeDecimal,openOdds:null,closeOdds:null,deeplink:null},
    edge:p!==null?(p-(side==="away"?impliedFromDecimal(best.awayDecimal):impliedFromDecimal(best.homeDecimal)))*100:null,
    ev:p!==null?(p*(side==="away"?best.awayDecimal:best.homeDecimal)-1)*100:null,
    books:quotes.map(q=>({bookmakerID:q.bookmakerID,odds:side==="away"?q.awayOdds:q.homeOdds,decimal:side==="away"?q.awayDecimal:q.homeDecimal,openOdds:null,closeOdds:null,deeplink:null}))
  }:null;
  const awayM=mk("away",bestAway,awayP),homeM=mk("home",bestHome,homeP);
  return {eventID:e.id,leagueID:"MMA",startTime:e.commence_time||null,started:e.commence_time?new Date(e.commence_time)<=new Date():false,home:{name:home},away:{name:away},moneyline:{home:homeM,away:awayM},markets:[awayM,homeM].filter(Boolean)};
}

export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
  // Accept the new name. Also accept the previous env-var name temporarily so a
  // user who replaced its VALUE with a The Odds API key does not have to reconfigure Vercel.
  const key=process.env.THE_ODDS_API_KEY||process.env.SPORTSGAMEODDS_API_KEY;
  if(!key)return res.status(500).json({ok:false,code:"KEY_MISSING",error:"Add THE_ODDS_API_KEY in Vercel, then redeploy."});

  const url=new URL(BASE);
  url.searchParams.set("apiKey",key);
  url.searchParams.set("regions","us");
  url.searchParams.set("markets","h2h");
  url.searchParams.set("oddsFormat","decimal");
  url.searchParams.set("dateFormat","iso");

  try{
    const r=await fetch(url,{headers:{accept:"application/json"}});
    const remaining=r.headers.get("x-requests-remaining");
    const used=r.headers.get("x-requests-used");
    const last=r.headers.get("x-requests-last");
    const body=await r.json().catch(()=>null);
    if(!r.ok){
      const msg=body?.message||body?.error||body?.error_code||`The Odds API HTTP ${r.status}`;
      return res.status(r.status).json({ok:false,code:body?.error_code||"ODDS_API_ERROR",error:msg});
    }
    const events=Array.isArray(body)?body.map(normalizeEvent).sort((a,b)=>new Date(a.startTime||0)-new Date(b.startTime||0)):[];
    res.setHeader("Cache-Control","s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({ok:true,provider:"The Odds API",fetchedAt:new Date().toISOString(),quota:{remaining,used,last},events});
  }catch(e){
    return res.status(502).json({ok:false,code:"FETCH_FAILED",error:e instanceof Error?e.message:"Unable to load MMA odds."});
  }
}