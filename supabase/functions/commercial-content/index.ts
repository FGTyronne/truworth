import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const APP='https://truworth-web.onrender.com';
const allowed=new Set([APP,'http://localhost:3000','http://127.0.0.1:3000']);
const PLACEMENTS=new Set(['home','result','compare','watchlist','insights','benefits']);
function adminKey(){try{const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');if(keys?.default)return keys.default;}catch{}return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';}
function cors(req:Request){const o=req.headers.get('origin')||'';return {'Access-Control-Allow-Origin':allowed.has(o)?o:APP,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};}
function reply(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, max-age=60'}});}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  if(req.method!=='POST')return reply(req,{error:'Method not allowed.'},405);
  const origin=req.headers.get('origin')||'';if(origin&&!allowed.has(origin))return reply(req,{error:'Origin not allowed.'},403);
  try{
    const body=await req.json().catch(()=>({}));const placement=String(body?.placement||'').trim();if(!PLACEMENTS.has(placement))return reply(req,{error:'Unsupported placement.'},400);
    const url=Deno.env.get('SUPABASE_URL')||'',key=adminKey();if(!url||!key)return reply(req,{campaign:null});
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await admin.from('ad_campaigns').select('id,name,campaign_type,disclosure,headline,body,cta,destination_url,image_url,starts_at,ends_at,placements,free_only,affiliate,sponsored,category,priority').eq('status','active').order('priority',{ascending:true}).order('created_at',{ascending:false}).limit(25);
    if(error)throw error;const now=Date.now();const campaign=(data||[]).find((row:any)=>{const starts=!row.starts_at||new Date(row.starts_at).getTime()<=now,ends=!row.ends_at||new Date(row.ends_at).getTime()>now,places=Array.isArray(row.placements)?row.placements:[];return starts&&ends&&(!places.length||places.includes(placement));})||null;
    return reply(req,{campaign:campaign?{id:campaign.id,campaign_type:campaign.campaign_type,disclosure:campaign.disclosure||((campaign.sponsored||campaign.campaign_type==='direct')?'Sponsored':campaign.affiliate?'Affiliate':'Partner'),headline:campaign.headline,body:campaign.body,cta:campaign.cta,destination_url:campaign.destination_url,image_url:campaign.image_url||null,affiliate:Boolean(campaign.affiliate),sponsored:Boolean(campaign.sponsored),category:campaign.category||null}:null});
  }catch(error){console.error('commercial-content',error instanceof Error?error.message:String(error));return reply(req,{campaign:null},200);}
});
