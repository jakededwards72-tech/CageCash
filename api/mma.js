const BASE="https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds/";
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const decToAmerican=d=>{d=num(d);if(!d||d<=1)return null;return d>=2?Math.round((d-1)*100):Math.round(-100/(d-1))};
const imp=d=>{d=num(d);return d&&d>1?1/d:null};
const fairAmerican=p=>!p||p<=0||p>=1?null:p>=.5?Math.round(-100*p/(1-p)):Math.round(100*(1-p)/p);
const med=a=>{const x=[...a].sort((a,b)=>a-b),n=x.length;return n?x.length%2?x[(n-1)/2]:(x[n/2-1]+x[n/2])/2:null};
const bookName=(k,t)=>t||String(k||"").replace(/[_-]/g," ").replace(/\b\w/g,m=>m.toUpperCase());
function pairFair(a,b){const pa=imp(a),pb=imp(b),s=(pa||0)+(pb||0);return pa&&pb&&s?pa/s:null}
function robustCluster(qs){
 const pts=qs.map(q=>({...q,p:pairFair(q.awayDecimal,q.homeDecimal)})).filter(q=>q.p!=null);
 if(pts.length<3)return{kept:pts,rejected:[],center:med(pts.map(x=>x.p)),integrity:"LOW"};
 // Find the densest 7-point probability window. This prevents a stale/mis-mapped
 // book from dragging consensus or becoming a fake "best price".
 let best=[];
 for(const seed of pts){const group=pts.filter(x=>Math.abs(x.p-seed.p)<=.07);if(group.length>best.length)best=group}
 if(best.length<Math.ceil(pts.length/2))best=pts.filter(x=>Math.abs(x.p-med(pts.map(y=>y.p)))<=.12);
 const kept=best.length>=2?best:pts,rejected=pts.filter(x=>!kept.includes(x)),center=med(kept.map(x=>x.p));
 return{kept,rejected,center,integrity:kept.length>=3&&kept.length/pts.length>=.5?"GOOD":"CAUTION"};
}
function normalizeEvent(e){
 const away=e.away_team||e.teams?.[0]||"Away fighter",home=e.home_team||e.teams?.[1]||"Home fighter",quotes=[];
 for(const book of e.bookmakers||[]){const m=(book.markets||[]).find(x=>x.key==="h2h");if(!m)continue;const by={};for(const o of m.outcomes||[])by[o.name]=o;const av=num(by[away]?.price),hv=num(by[home]?.price);if(!av||!hv||av<=1||hv<=1)continue;quotes.push({bookmakerID:book.key,title:bookName(book.key,book.title),lastUpdate:m.last_update||book.last_update||null,awayDecimal:av,homeDecimal:hv,awayOdds:decToAmerican(av),homeOdds:decToAmerican(hv)})}
 const cl=robustCluster(quotes),valid=cl.kept,validIds=new Set(valid.map(x=>x.bookmakerID)),awayP=cl.center,homeP=awayP==null?null:1-awayP;
 const best=(side)=>valid.slice().sort((x,y)=>(side==="away"?y.awayDecimal-x.awayDecimal:y.homeDecimal-x.homeDecimal))[0]||null;
 const mk=(side,p)=>{const b=best(side);if(!b)return null;const d=side==="away"?b.awayDecimal:b.homeDecimal;return{oddID:e.id+":h2h:"+side,marketName:"Fight winner",periodID:"game",betTypeID:"ml",sideID:side,fairOdds:fairAmerican(p),fairProbability:p,bestBook:{bookmakerID:b.bookmakerID,odds:side==="away"?b.awayOdds:b.homeOdds,decimal:d,openOdds:null,closeOdds:null,deeplink:null},edge:p==null?null:(p-imp(d))*100,ev:p==null?null:(p*d-1)*100,books:quotes.map(q=>({bookmakerID:q.bookmakerID,odds:side==="away"?q.awayOdds:q.homeOdds,decimal:side==="away"?q.awayDecimal:q.homeDecimal,openOdds:null,closeOdds:null,deeplink:null,excluded:!validIds.has(q.bookmakerID)})),integrity:cl.integrity,validBooks:valid.length,totalBooks:quotes.length,rejectedBooks:cl.rejected.map(x=>x.bookmakerID)}};
 const awayM=mk("away",awayP),homeM=mk("home",homeP);
 return{eventID:e.id,leagueID:"MMA",startTime:e.commence_time||null,started:e.commence_time?new Date(e.commence_time)<=new Date():false,home:{name:home},away:{name:away},integrity:{status:cl.integrity,validBooks:valid.length,totalBooks:quotes.length,rejectedBooks:cl.rejected.map(x=>x.bookmakerID)},moneyline:{home:homeM,away:awayM},markets:[awayM,homeM].filter(Boolean)}
}
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
 const key=process.env.THE_ODDS_API_KEY||process.env.SPORTSGAMEODDS_API_KEY;if(!key)return res.status(500).json({ok:false,code:"KEY_MISSING",error:"Add THE_ODDS_API_KEY in Vercel, then redeploy."});
 const url=new URL(BASE);url.searchParams.set("apiKey",key);url.searchParams.set("regions","us");url.searchParams.set("markets","h2h,totals");url.searchParams.set("oddsFormat","decimal");url.searchParams.set("dateFormat","iso");
 try{const r=await fetch(url,{headers:{accept:"application/json"}}),remaining=r.headers.get("x-requests-remaining"),used=r.headers.get("x-requests-used"),last=r.headers.get("x-requests-last"),body=await r.json().catch(()=>null);if(!r.ok)return res.status(r.status).json({ok:false,code:body?.error_code||"ODDS_API_ERROR",error:body?.message||body?.error||body?.error_code||("The Odds API HTTP "+r.status)});const events=Array.isArray(body)?body.map(normalizeEvent).sort((a,b)=>new Date(a.startTime||0)-new Date(b.startTime||0)):[];res.setHeader("Cache-Control","s-maxage=60, stale-while-revalidate=120");return res.status(200).json({ok:true,provider:"The Odds API",fetchedAt:new Date().toISOString(),quota:{remaining,used,last},integrityVersion:"robust-cluster-v1",events})}catch(e){return res.status(502).json({ok:false,code:"FETCH_FAILED",error:e instanceof Error?e.message:"Unable to load MMA odds."})}
}