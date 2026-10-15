import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const APP='https://truworth-web.onrender.com';
const allowed=new Set([APP,'http://localhost:3000','http://127.0.0.1:3000']);
const TYPES=new Set(['advertising','member_benefit','affiliate','distribution','research','other']);

function adminKey(){
  try { const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}'); if(keys?.default) return keys.default; } catch {}
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
}
function cors(req:Request){const o=req.headers.get('origin')||'';return {'Access-Control-Allow-Origin':allowed.has(o)?o:APP,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};}
function reply(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
function ip(req:Request){return req.headers.get('cf-connecting-ip')?.trim()||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')?.trim()||'';}
function clean(v:unknown,max:number){return String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
function uaFamily(v:string){const s=v.toLowerCase();if(s.includes('edg/'))return'Edge';if(s.includes('chrome/'))return'Chrome';if(s.includes('firefox/'))return'Firefox';if(s.includes('safari/')&&!s.includes('chrome/'))return'Safari';return'Other';}
function validEmail(v:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=254;}
function validUrl(v:string){if(!v)return true;try{const u=new URL(v);return u.protocol==='http:'||u.protocol==='https:';}catch{return false;}}
async function hmac(secret:string,value:string){const enc=new TextEncoder();const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(value)));return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  if(req.method!=='POST')return reply(req,{error:'Method not allowed.'},405);
  const origin=req.headers.get('origin')||'';
  if(origin&&!allowed.has(origin))return reply(req,{error:'Origin not allowed.'},403);
  try{
    const body=await req.json().catch(()=>({}));
    if(clean(body?.company_fax,200)) return reply(req,{ok:true});
    const contact_name=clean(body?.contact_name,120),work_email=clean(body?.work_email,254).toLowerCase(),company_name=clean(body?.company_name,180),company_website=clean(body?.company_website,500),enquiry_type=clean(body?.enquiry_type,40),message=clean(body?.message,4000),privacy_acknowledged=body?.privacy_acknowledged===true;
    if(contact_name.length<2||company_name.length<2||message.length<20||!validEmail(work_email)||!TYPES.has(enquiry_type)||!privacy_acknowledged||!validUrl(company_website)) return reply(req,{error:'Please check the required fields and try again.'},400);

    const url=Deno.env.get('SUPABASE_URL')||'',key=adminKey();
    if(!url||!key)return reply(req,{error:'Enquiries are temporarily unavailable.'},503);
    const sourceIp=ip(req);if(!sourceIp)return reply(req,{error:'We could not verify this request.'},503);
    const ip_hash=await hmac(key,`truworth-partner-enquiry-v1:${sourceIp}`);
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const since15=new Date(Date.now()-15*60*1000).toISOString(),since24=new Date(Date.now()-24*60*60*1000).toISOString();
    const [{count:shortCount,error:shortError},{count:dailyCount,error:dailyError}]=await Promise.all([
      admin.from('partner_enquiries').select('id',{head:true,count:'exact'}).eq('ip_hash',ip_hash).gte('created_at',since15),
      admin.from('partner_enquiries').select('id',{head:true,count:'exact'}).eq('ip_hash',ip_hash).gte('created_at',since24)
    ]);
    if(shortError||dailyError)throw shortError||dailyError;
    if(Number(shortCount||0)>=2||Number(dailyCount||0)>=5)return reply(req,{error:'Too many enquiries were submitted from this connection. Please try again later.'},429);

    const {error}=await admin.from('partner_enquiries').insert({contact_name,work_email,company_name,company_website:company_website||null,enquiry_type,message,privacy_acknowledged:true,ip_hash,user_agent_family:uaFamily(req.headers.get('user-agent')||''),source_page:'partner-with-truworth',metadata:{form_version:'2026-10-15'}});
    if(error)throw error;
    return reply(req,{ok:true,message:'Thanks. Your enquiry has been received.'},201);
  }catch(error){console.error('partner-enquiry',error instanceof Error?error.message:String(error));return reply(req,{error:'We could not submit your enquiry. Please try again.'},500);}
});
