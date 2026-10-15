import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const APP='https://truworth-web.onrender.com';
const allowed=new Set([APP,'http://localhost:3000','http://127.0.0.1:3000']);
const stripeVersion='2025-03-31.basil';

function adminKey(){
  try{const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');if(keys?.default)return keys.default;}catch{}
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
}
const cors=(req:Request)=>{const o=req.headers.get('origin')||'';return {'Access-Control-Allow-Origin':allowed.has(o)?o:APP,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}};
const reply=(req:Request,b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors(req),'Content-Type':'application/json','Cache-Control':'no-store'}});
const form=(obj:Record<string,string|number|boolean|undefined|null>)=>{const p=new URLSearchParams();for(const [k,v] of Object.entries(obj)){if(v===undefined||v===null||v==='')continue;p.set(k,String(v));}return p;};

async function stripe(path:string, secret:string, method='GET', body?:URLSearchParams){
  const r=await fetch(`https://api.stripe.com/v1/${path}`,{method,headers:{Authorization:`Bearer ${secret}`,'Stripe-Version':stripeVersion,...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(`Stripe request failed (${r.status}:${data?.error?.code||data?.error?.type||'unknown'})`);
  return data;
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  if(req.method!=='POST')return reply(req,{error:'Method not allowed'},405);
  const origin=req.headers.get('origin')||'';
  if(origin&&!allowed.has(origin))return reply(req,{error:'Origin not allowed'},403);
  try{
    const auth=req.headers.get('Authorization')||'';
    const token=auth.replace(/^Bearer\s+/i,'');
    if(!token)return reply(req,{error:'Sign in required'},401);
    const url=Deno.env.get('SUPABASE_URL')||'';
    const pub=Deno.env.get('SUPABASE_ANON_KEY')||'';
    const key=adminKey();
    const secret=Deno.env.get('STRIPE_SECRET_KEY')||'';
    if(!url||!pub||!key||!secret)return reply(req,{error:'Server configuration unavailable'},503);
    const userClient=createClient(url,pub,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:u,error:ue}=await userClient.auth.getUser(token);
    if(ue||!u.user)return reply(req,{error:'Invalid session'},401);
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:adminRow,error:adminError}=await admin.from('app_admins').select('user_id').eq('user_id',u.user.id).maybeSingle();
    if(adminError)throw adminError;
    if(!adminRow)return reply(req,{admin:false,bootstrap_available:false},403);

    const body=await req.json().catch(()=>({}));
    const action=String(body?.action||'status');
    if(action==='status')return reply(req,{admin:true});

    if(action==='list'){
      const promos=await stripe('promotion_codes?limit=100&expand[]=data.promotion.coupon',secret);
      const subs=await stripe('subscriptions?limit=100&status=all&expand[]=data.customer&expand[]=data.discounts',secret);
      const vouchers=(promos.data||[]).map((p:any)=>{const coupon=p?.promotion?.coupon||p?.coupon||null;return {id:p.id,code:p.code,active:Boolean(p.active),times_redeemed:Number(p.times_redeemed||0),max_redemptions:p.max_redemptions??null,expires_at:p.expires_at??null,percent_off:coupon?.percent_off??null,duration:coupon?.duration??null,coupon_id:coupon?.id||null,created:p.created};});
      const redemptions=(subs.data||[]).filter((s:any)=>Array.isArray(s.discounts)&&s.discounts.length).map((s:any)=>{const d=s.discounts[0],coupon=d?.source?.coupon||d?.coupon||null,promo=d?.promotion_code||d?.source?.promotion_code||null;return {subscription_id:s.id,status:s.status,cancel_at_period_end:Boolean(s.cancel_at_period_end),customer_email:s.customer?.email||null,customer_id:s.customer?.id||s.customer||null,promotion_code_id:typeof promo==='string'?promo:promo?.id||null,coupon_id:coupon?.id||null,percent_off:coupon?.percent_off??null,current_period_end:s.current_period_end??null};});
      return reply(req,{admin:true,vouchers,redemptions});
    }
    if(action==='create'){
      const percent=Math.max(1,Math.min(100,Number(body?.percent_off||100)));
      const code=String(body?.code||'').trim().toUpperCase();
      if(code&&!/^[A-Z0-9-]{4,32}$/.test(code))return reply(req,{error:'Voucher code must be 4-32 letters, numbers or dashes.'},400);
      const max=Math.max(1,Math.min(1000,Number(body?.max_redemptions||1)));
      const expiresRaw=body?.expires_at?new Date(body.expires_at):null;
      const expires=expiresRaw&&!Number.isNaN(expiresRaw.getTime())?Math.floor(expiresRaw.getTime()/1000):undefined;
      if(expires&&expires<=Math.floor(Date.now()/1000))return reply(req,{error:'Voucher expiry must be in the future.'},400);
      const coupon=await stripe('coupons',secret,'POST',form({duration:'forever',percent_off:percent,name:'TruWorth tester voucher','metadata[purpose]':'tester_voucher'}));
      try{
        const promo=await stripe('promotion_codes',secret,'POST',form({'promotion[type]':'coupon','promotion[coupon]':coupon.id,code:code||undefined,max_redemptions:max,expires_at:expires,'metadata[purpose]':'tester_voucher'}));
        await admin.from('voucher_admin_audit').insert({admin_user_id:u.user.id,action:'create_voucher',stripe_object_id:promo.id,detail:{code:promo.code,percent_off:percent,max_redemptions:max,expires_at:expires||null}});
        return reply(req,{ok:true,voucher:{id:promo.id,code:promo.code,active:promo.active,percent_off:percent,max_redemptions:max,expires_at:promo.expires_at}});
      }catch(e){try{await stripe(`coupons/${encodeURIComponent(coupon.id)}`,secret,'DELETE');}catch{}throw e;}
    }
    if(action==='disable'){
      const id=String(body?.promotion_code_id||'');if(!/^promo_[A-Za-z0-9]+$/.test(id))return reply(req,{error:'Invalid voucher'},400);
      const promo=await stripe(`promotion_codes/${encodeURIComponent(id)}`,secret,'POST',form({active:false}));
      await admin.from('voucher_admin_audit').insert({admin_user_id:u.user.id,action:'disable_voucher',stripe_object_id:id});
      return reply(req,{ok:true,active:promo.active});
    }
    if(action==='remove_discount'){
      const id=String(body?.subscription_id||'');if(!/^sub_[A-Za-z0-9]+$/.test(id))return reply(req,{error:'Invalid subscription'},400);
      await stripe(`subscriptions/${encodeURIComponent(id)}/discount`,secret,'DELETE');
      await admin.from('voucher_admin_audit').insert({admin_user_id:u.user.id,action:'remove_discount',stripe_object_id:id});
      return reply(req,{ok:true});
    }
    if(action==='cancel_subscription'){
      const id=String(body?.subscription_id||'');if(!/^sub_[A-Za-z0-9]+$/.test(id))return reply(req,{error:'Invalid subscription'},400);
      const sub=await stripe(`subscriptions/${encodeURIComponent(id)}`,secret,'DELETE');
      await admin.from('voucher_admin_audit').insert({admin_user_id:u.user.id,action:'cancel_subscription',stripe_object_id:id});
      return reply(req,{ok:true,status:sub.status});
    }
    return reply(req,{error:'Unknown action'},400);
  }catch(e){console.error('voucher-admin',e);return reply(req,{error:'Voucher control failed. Please try again.'},500);}
});
