import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const APP='https://truworth-web.onrender.com';
const allowed=new Set([APP,'http://localhost:3000','http://127.0.0.1:3000']);
const statuses=new Set(['new','in_review','qualified','declined','closed']);
function adminKey(){try{const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');if(keys?.default)return keys.default;}catch{}return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';}
const cors=(req:Request)=>{const o=req.headers.get('origin')||'';return {'Access-Control-Allow-Origin':allowed.has(o)?o:APP,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}};
const reply=(req:Request,b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors(req),'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  if(req.method!=='POST')return reply(req,{error:'Method not allowed'},405);
  const origin=req.headers.get('origin')||'';if(origin&&!allowed.has(origin))return reply(req,{error:'Origin not allowed'},403);
  try{
    const auth=req.headers.get('Authorization')||'',token=auth.replace(/^Bearer\s+/i,'');if(!token)return reply(req,{error:'Sign in required'},401);
    const url=Deno.env.get('SUPABASE_URL')||'',pub=Deno.env.get('SUPABASE_ANON_KEY')||'',key=adminKey();if(!url||!pub||!key)return reply(req,{error:'Server configuration unavailable'},503);
    const userClient=createClient(url,pub,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});const {data:u,error:ue}=await userClient.auth.getUser(token);if(ue||!u.user)return reply(req,{error:'Invalid session'},401);
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {data:adminRow,error:adminError}=await admin.from('app_admins').select('user_id').eq('user_id',u.user.id).maybeSingle();if(adminError)throw adminError;if(!adminRow)return reply(req,{admin:false},403);
    const body=await req.json().catch(()=>({})),action=String(body?.action||'status');if(action==='status')return reply(req,{admin:true});
    if(action==='list'){
      const wanted=String(body?.status||'all');let query=admin.from('partner_enquiries').select('id,created_at,contact_name,work_email,company_name,company_website,enquiry_type,message,status,source_page,user_agent_family').order('created_at',{ascending:false}).limit(200);if(statuses.has(wanted))query=query.eq('status',wanted);const {data,error}=await query;if(error)throw error;return reply(req,{admin:true,enquiries:data||[]});
    }
    if(action==='update_status'){
      const id=String(body?.id||''),status=String(body?.status||'');if(!/^[0-9a-f-]{36}$/i.test(id)||!statuses.has(status))return reply(req,{error:'Invalid status update'},400);const {data,error}=await admin.from('partner_enquiries').update({status,updated_at:new Date().toISOString()}).eq('id',id).select('id,status,updated_at').single();if(error)throw error;return reply(req,{ok:true,enquiry:data});
    }
    return reply(req,{error:'Unknown action'},400);
  }catch(error){console.error('partner-admin',error);return reply(req,{error:'Partner administration failed.'},500);}
});
