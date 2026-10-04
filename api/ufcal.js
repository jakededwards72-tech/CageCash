const BASE="https://api.ufcalendar.com/v1";
async function api(path,key){
 const r=await fetch(BASE+path,{headers:{Authorization:"Bearer "+key,Accept:"application/json"}});
 const j=await r.json().catch(()=>null);
 if(!r.ok) throw new Error((j&&j.error&&j.error.message)||("UFCalendar HTTP "+r.status));
 return j;
}
async function find(name,key){
 const j=await api("/fighters?q="+encodeURIComponent(name)+"&limit=8",key);
 const rows=Array.isArray(j&&j.data)?j.data:[];
 const n=name.trim().toLowerCase();
 return rows.find(x=>String(x.name||"").trim().toLowerCase()===n)||rows[0]||null;
}
function recent(v){
 const rows=Array.isArray(v)?v:[];
 return rows.slice(0,8).map(x=>({date:x.date||x.event_date||null,opponent:x.opponent&&x.opponent.name||x.opponent_name||null,result:x.status||x.result||null,method:x.method_normalized||x.method||null,round:x.round||null,promotion:x.promotion||x.org||null}));
}
export default async function handler(req,res){
 if(req.method!=="GET") return res.status(405).json({ok:false,error:"Method not allowed"});
 const key=process.env.UFCAL_API_KEY;
 if(!key) return res.status(500).json({ok:false,code:"UFCAL_KEY_MISSING",error:"UFCAL_API_KEY is not configured."});
 const a=String(req.query&&req.query.a||"").trim(),b=String(req.query&&req.query.b||"").trim();
 if(!a||!b) return res.status(400).json({ok:false,error:"Two fighter names are required."});
 try{
  const [fa,fb]=await Promise.all([find(a,key),find(b,key)]);
  if(!fa||!fb) return res.status(404).json({ok:false,code:"FIGHTER_NOT_FOUND",error:"One or both fighters could not be matched.",matched:{away:fa&&fa.name||null,home:fb&&fb.name||null}});
  const aid=fa.slug||fa.id,bid=fb.slug||fb.id;
  const [pa,pb,ha,hb,cmp]=await Promise.all([
   api("/fighters/"+encodeURIComponent(aid)+"?include=credentials",key),
   api("/fighters/"+encodeURIComponent(bid)+"?include=credentials",key),
   api("/fighters/"+encodeURIComponent(aid)+"/history",key),
   api("/fighters/"+encodeURIComponent(bid)+"/history",key),
   api("/compare?a="+encodeURIComponent(aid)+"&b="+encodeURIComponent(bid),key).catch(()=>null)
  ]);
  res.setHeader("Cache-Control","s-maxage=21600, stale-while-revalidate=86400");
  return res.status(200).json({ok:true,provider:"UFCalendar",updatedAt:new Date().toISOString(),fighters:{away:pa&&pa.data||fa,home:pb&&pb.data||fb},history:{away:recent(ha&&ha.data),home:recent(hb&&hb.data)},comparison:cmp&&cmp.data||null,note:"Third-party predictions are reference-only and are not CageCash model output."});
 }catch(e){return res.status(502).json({ok:false,code:"UFCAL_ERROR",error:e instanceof Error?e.message:"Unable to load fighter intelligence."});}
}