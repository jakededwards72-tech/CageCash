const BASE="https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/";
async function roster(id){
  const r=await fetch(BASE+id+"/roster",{headers:{accept:"application/json"},signal:AbortSignal.timeout(8500)});
  if(!r.ok)throw new Error("ESPN roster HTTP "+r.status);
  const data=await r.json();
  const group=Array.isArray(data.athletes)?data.athletes:
    Array.isArray(data.groups)?data.groups.flatMap(g=>g.athletes||[]):[];
  const athletes=group.flatMap(x=>Array.isArray(x.items)?x.items:[x]);
  return athletes.map(a=>({id:String(a.id||""),name:a.displayName||a.fullName||a.name||"",
    position:a.position?.abbreviation||"",headshot:a.headshot?.href||null,
    status:a.status?.name||a.status?.type||null, injuries:Array.isArray(a.injuries)?a.injuries.map(i=>({status:String(i.status||""),date:i.date||null})).filter(i=>i.status):[]}))
    .filter(x=>/^[0-9]{3,12}$/.test(x.id)&&x.name).sort((a,b)=>a.name.localeCompare(b.name));
}
export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
  const away=String(req.query.away||""),home=String(req.query.home||"");
  if(!/^[0-9]{1,6}$/.test(away)||!/^[0-9]{1,6}$/.test(home))
    return res.status(400).json({ok:false,error:"Valid ESPN team IDs required"});
  const [a,h]=await Promise.allSettled([roster(away),roster(home)]);
  if(a.status==="rejected"&&h.status==="rejected")
    return res.status(502).json({ok:false,error:"Unable to obtain team rosters from ESPN"});
  res.setHeader("Cache-Control","public,s-maxage=900,stale-while-revalidate=1800");
  return res.status(200).json({ok:true,away:a.status==="fulfilled"?a.value:[],home:h.status==="fulfilled"?h.value:[],
    partial:a.status==="rejected"||h.status==="rejected",source:"ESPN NBA rosters"});
}
