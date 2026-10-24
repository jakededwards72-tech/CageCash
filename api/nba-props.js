import {normalizeMarkets} from "../lib/nba-pricing.mjs";
const BASE="https://api.the-odds-api.com/v4/sports/basketball_nba/events/";
const MARKETS=["player_points","player_rebounds","player_assists","player_threes","player_points_rebounds_assists"];
export default async function handler(req,res) {
  if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
  const id=typeof req.query.event==="string"?req.query.event:"";
  if(!/^[a-zA-Z0-9]{8,64}$/.test(id))return res.status(400).json({ok:false,error:"Invalid sportsbook event ID"});
  const key=process.env.THE_ODDS_API_KEY;
  if(!key)return res.status(503).json({ok:false,code:"KEY_MISSING",error:"Set THE_ODDS_API_KEY in the NBA Vercel project's environment variables."});
  const url=new URL(BASE+encodeURIComponent(id)+"/odds/");
  url.searchParams.set("apiKey",key);url.searchParams.set("regions","us");
  url.searchParams.set("markets",MARKETS.join(","));
  url.searchParams.set("oddsFormat","american");
  try {
    const r=await fetch(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(12000)});
    const raw=await r.json().catch(()=>null);
    if(!r.ok)return res.status(r.status===404?404:503).json({ok:false,code:r.status===401||r.status===403?"KEY_OR_PLAN":r.status===422?"MARKETS_UNAVAILABLE":"PROVIDER_ERROR",
      error:raw?.message||"Player props require a supported odds plan and bookmaker coverage."});
    const markets=normalizeMarkets(raw,MARKETS);
    res.setHeader("Cache-Control","public, s-maxage=120, stale-while-revalidate=180");
    return res.status(200).json({ok:true,eventId:id,markets,fetchedAt:new Date().toISOString(),
      provider:"The Odds API",note:"Market-only prices; no independent player projection.",
      quota:{remaining:r.headers.get("x-requests-remaining")}});
  } catch(err) {
    return res.status(502).json({ok:false,code:"FETCH_FAILED",error:"Unable to fetch player props right now."});
  }
}
