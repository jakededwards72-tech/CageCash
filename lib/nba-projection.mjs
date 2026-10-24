// Experimental NBA player-stat projection from ESPN pregame game logs.
// This is a transparent minutes × production-rate estimator, not a calibrated betting model.
const finite = x => typeof x === "number" && Number.isFinite(x);
const mean = x => x.length ? x.reduce((a,b)=>a+b,0)/x.length : null;
const weighted = (xs,halfLife=6) => {
  if(!xs.length) return null;
  let sum=0,w=0;
  xs.forEach((v,i)=>{const weight=Math.pow(0.5,i/halfLife);sum+=v*weight;w+=weight});
  return sum/w;
};
const median = xs => {
  if(!xs.length)return null;
  const s=[...xs].sort((a,b)=>a-b), k=Math.floor(s.length/2);
  return s.length%2?s[k]:(s[k-1]+s[k])/2;
};
const validLogs=(xs,key)=>xs.filter(g=>finite(g?.[key])&&finite(g?.min)&&g.min>=8&&g.min<=60&&g[key]>=0).slice(0,24);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function normalCdf(z){
  const t=1/(1+0.2316419*Math.abs(z));
  const q=0.3989422804*Math.exp(-z*z/2)*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
  return clamp(z>=0?1-q:q,0,1);
}
export function americanBreakEven(odds){
  const n=Number(odds);
  if(!Number.isFinite(n)||n===0||Math.abs(n)<100)return null;
  return n>0?100/(100+n):Math.abs(n)/(100+Math.abs(n));
}
export function projectPlayerMetric(current=[],previous=[],metric="pts",options={}){
  if(!["pts","reb","ast","threes","pra"].includes(metric))return null;
  const c=validLogs(current,metric).slice(0,15);
  const p=validLogs(previous,metric).slice(0,20);
  if((c.length<3&&p.length<8)||!c.length&&!p.length)return null;
  const rate=logs=>weighted(logs.map(g=>g[metric]/g.min),6);
  const rateC=rate(c),rateP=rate(p);
  const currentWeight=rateP===null?1:rateC===null?0:c.length/(c.length+8);
  const blendedRate=(rateC??rateP)*currentWeight+(rateP??rateC)*(1-currentWeight);
  const minsC=weighted(c.slice(0,8).map(g=>g.min),4);
  const minsP=weighted(p.slice(0,12).map(g=>g.min),6);
  const minutesWeight=minsP===null?1:minsC===null?0:c.length/(c.length+4);
  const projectedMinutes=(minsC??minsP)*minutesWeight+(minsP??minsC)*(1-minutesWeight);
  const override=options.minutesOverride;
  const minutes=finite(override)&&override>=0&&override<=48?override:clamp(projectedMinutes,0,48);
  const projection=Math.max(0,blendedRate*minutes);
  const all=[...c,...p];
  const normalized=all.map(g=>g[metric]/g.min*minutes);
  const spread=normalized.length>1?Math.sqrt(mean(normalized.map(x=>(x-projection)**2))):0;
  const minutesSigma=all.length>1?Math.sqrt(mean(all.map(g=>(g.min-projectedMinutes)**2))):0;
  const floor=metric==="pts"?Math.max(3,1.45*Math.sqrt(projection)):metric==="pra"?Math.max(4,1.45*Math.sqrt(projection)):metric==="threes"?Math.max(1.1,1.15*Math.sqrt(projection)):Math.max(1.4,1.3*Math.sqrt(projection));
  const deviation=Math.max(floor,Math.sqrt(spread**2+(blendedRate*minutesSigma)**2));
  const start=Math.max(0,projection-1.2816*deviation),end=projection+1.2816*deviation;
  const samples=c.length+p.length;
  const confidence=c.length>=8&&samples>=16?"MODERATE":c.length>=3&&samples>=12?"LIMITED":"VERY_LOW";
  const line=Number(options.line);
  const hasLine=options.line!==""&&options.line!==null&&options.line!==undefined&&Number.isFinite(line)&&line>=0;
  const over=hasLine?clamp(1-normalCdf((line-projection)/deviation),0.001,0.999):null;
  const history=c.length?c:p;
  const hits=hasLine?history.filter(g=>g[metric]>line).length:null;
  return {metric,projection,minutes,automaticMinutes:projectedMinutes,minutesOverrideUsed:finite(override)&&override>=0&&override<=48,
    perMinute:blendedRate,uncertainty:deviation,range80:[start,end],confidence,sampleSize:samples,
    currentGames:c.length,previousGames:p.length,currentWeight,over,under:over===null?null:1-over,
    line:hasLine?line:null,recentHits:hits,recentHitGames:history.length,
    currentL5:mean(c.slice(0,5).map(g=>g[metric])),currentL10:mean(c.slice(0,10).map(g=>g[metric])),
    priorL10:mean(p.slice(0,10).map(g=>g[metric])),
    recentMinutes:median(c.slice(0,5).map(g=>g.min)),
    warning:confidence==="VERY_LOW"?"Few usable games; treat the projection as highly uncertain.":"No injury, lineup, matchup or opponent-specific adjustment is applied."};
}
// Historical one-step-ahead validation: a point may only be predicted from earlier games.
export function walkForwardError(current=[],previous=[],metric="pts"){
  const ordered=[...validLogs(previous,metric).reverse(),...validLogs(current,metric).reverse()];
  let total=0,n=0,baselineTotal=0;
  for(let i=8;i<ordered.length;i++){
    const known=ordered.slice(0,i).reverse();
    const model=projectPlayerMetric(known,[],metric);
    if(!model)continue;
    total+=Math.abs(model.projection-ordered[i][metric]);
    baselineTotal+=Math.abs(mean(known.slice(0,8).map(g=>g[metric]))-ordered[i][metric]);
    n++;
  }
  return n>=5?{n,mae:total/n,baselineMae:baselineTotal/n,description:"Walk-forward historical error (not independent external validation)"}:null;
}
