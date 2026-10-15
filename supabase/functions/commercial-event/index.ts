import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const APP='https://truworth-web.onrender.com';
const allowed=new Set([APP,'http://localhost:3000','http://127.0.0.1:3000']);
const TYPES=new Set(['impression','click']);
const PLACEMENTS=new Set(['home','result','compare','watchlist','insights','benefits']);
function adminKey(){try{const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');if(keys?.default)return keys.default;}catch{}return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';}
function cors(req:Request){const o=req.headers.get('origin')||'';return {'Access-Control-Allow-Origin':allowed.has(o)?o:APP,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};}
function reply(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
async function hmac(secret:string,value:string){const enc=new TextEncoder();const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(value)));return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  if(req.method!=='POST')return reply(req,{error:'Method not allowed.'},405);
  const origin=req.headers.get('origin')||'';if(origin&&!allowed.has(origin))return reply(req,{error:'Origin not allowed.'},403);
  try{
    const body=await req.json().catch(()=>({}));const campaignId=String(body?.campaign_id||''),eventType=String(body?.event_type||''),placement=String(body?.placement||''),session=String(body?.session_id||'').slice(0,200);
    if(!/^[0-9a-f-]{36}$/i.test(campaignId)||!TYPES.has(eventType)||!PLACEMENTS.has(placement))return reply(req,{error:'Invalid event.'},400);
    const url=Deno.env.get('SUPABASE_URL')||'',key=adminKey();if(!url||!key)return reply(req,{ok:false},503);
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:campaign,error:campaignError}=await admin.from('ad_campaigns').select('id,status,starts_at,ends_at,placements').eq('id',campaignId).maybeSingle();
    if(campaignError)throw campaignError;if(!campaign||campaign.status!=='active')return reply(req,{ok:true,ignored:true});
    const now=Date.now(),starts=!campaign.starts_at||new Date(campaign.starts_at).getTime()<=now,ends=!campaign.ends_at||new Date(campaign.ends_at).getTime()>now,places=Array.isArray(campaign.placements)?campaign.placements:[];
    if(!starts||!ends||(places.length&&!places.includes(placement)))return reply(req,{ok:true,ignored:true});
    const session_hash=session?await hmac(key,`truworth-commercial-session-v1:${session}`):null;
    if(session_hash&&eventType==='impression'){
      const since=new Date(Date.now()-30*60*1000).toISOString();const {count,error}=await admin.from('ad_events').select('id',{head:true,count:'exact'}).eq('campaign_id',campaignId).eq('placement',placement).eq('event_type','impression').eq('session_hash',session_hash).gte('created_at',since);if(error)throw error;if(Number(count||0)>0)return reply(req,{ok:true,deduplicated:true});
    }
    const {error}=await admin.from('ad_events').insert({campaign_id:campaignId,placement,event_type:eventType,session_hash,metadata:{consent_basis:'marketing_opt_in'}});if(error)throw error;
    return reply(req,{ok:true},201);
  }catch(error){console.error('commercial-event',error instanceof Error?error.message:String(error));return reply(req,{ok:false},500);}
});
