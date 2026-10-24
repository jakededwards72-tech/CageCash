// Pure helpers for ESPN game-by-game basketball statistics.
// Handles both nested seasonTypes and flat log response variants.
const number=(v)=>{
  if(v===null||v===undefined||v===""||String(v).trim()==="--")return null;
  const n=Number(v);return Number.isFinite(n)?n:null;
};
const made=(v)=>{const s=String(v??"");return number(s.includes("-")?s.split("-")[0]:s)};
const minutes=(v)=>{
  const s=String(v??"");
  if(s.includes(":")){const x=s.split(":").map(Number);return Number.isFinite(x[0])&&Number.isFinite(x[1])?x[0]+x[1]/60:null}
  return number(v);
};
const get=(row,labels,...keys)=>{
  for(const key of keys) {
    const i=labels.findIndex(x=>String(x).toUpperCase()===key);
    if(i>=0&&i<row.length)return row[i];
  }
  return null;
};
export function parseGameLog(raw,cutoff) {
  const eventMeta=raw?.events || {};
  const cutoffMs=cutoff ? Date.parse(cutoff) : Number.POSITIVE_INFINITY;
  const types=Array.isArray(raw?.seasonTypes)?raw.seasonTypes:[];
  const rows=[];
  for(const group of types) {
    const title=String(group.displayName||group.name||"").toLowerCase();
    if(/preseason|postseason|playoffs|summer league/.test(title))continue;
    for(const category of group.categories || []) {
      for(const ev of category.events || [])rows.push({ev,labels:category.labels || raw.labels || raw.displayNames || raw.names || []});
    }
  }
  // Some ESPN payloads expose flat events with the stats already attached.
  if(!rows.length&&Array.isArray(raw?.events))for(const ev of raw.events)rows.push({ev,labels:raw.labels||raw.displayNames||raw.names||[]});
  const seen=new Set();
  return rows.map(({ev,labels})=>{
    const eid=String(ev.eventId||ev.id||"");
    if(!eid||seen.has(eid))return null;
    const meta=Array.isArray(eventMeta)?eventMeta.find(x=>String(x.id)===eid)||ev:eventMeta[eid]||ev;
    const date=meta.gameDate||meta.date||ev.gameDate||ev.date;
    const ms=Date.parse(date||"");
    if(!Number.isFinite(ms)||ms>=cutoffMs)return null;
    const vals=Array.isArray(ev.stats)?ev.stats:[];
    const columns=labels.length>vals.length?labels.slice(-vals.length):labels;
    const pt=number(get(vals,columns,"PTS","POINTS"));
    const rb=number(get(vals,columns,"REB","REBOUNDS","TRB"));
    const ast=number(get(vals,columns,"AST","ASSISTS"));
    const t3=made(get(vals,columns,"3PT","3PM","3P","THREEPOINTFIELDGOALSMADE"));
    const min=minutes(get(vals,columns,"MIN","MINUTES"));
    if(min===null||min<=0||[pt,rb,ast].every(x=>x===null))return null;
    seen.add(eid);
    return {eventId:eid,date:new Date(ms).toISOString(),opponent:meta.opponent?.abbreviation||meta.opponent?.displayName||"—",
      result:meta.gameResult||"",min,pts:pt,reb:rb,ast,threes:t3,
      pra:pt!==null&&rb!==null&&ast!==null?pt+rb+ast:null};
  }).filter(Boolean).sort((a,b)=>new Date(b.date)-new Date(a.date));
}
const average=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
export function describeLogs(current,previous=[]) {
  const keys=["pts","reb","ast","threes","pra","min"];
  const out={};
  for(const k of keys) {
    const c=current.map(x=>x[k]).filter(Number.isFinite);
    const p=previous.map(x=>x[k]).filter(Number.isFinite);
    const last5=c.slice(0,5),last10=c.slice(0,10);
    const recent=last10.length?last10:p.slice(0,10);
    const mean=average(recent),variance=mean===null?null:average(recent.map(x=>(x-mean)**2));
    out[k]={currentGames:c.length,priorGames:p.length,last5:average(last5),
      last10:average(last10),prior10:average(p.slice(0,10)),
      baseline:mean,stdDev:variance===null?null:Math.sqrt(variance)};
  }
  return out;
}
