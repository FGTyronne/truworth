const allowedOrigins=new Set(['https://truworth.vercel.app','https://www.truworth.vercel.app','http://localhost:3000','http://127.0.0.1:3000']);
const cors=(req:Request)=>{const origin=req.headers.get('origin')||'';return{'Access-Control-Allow-Origin':allowedOrigins.has(origin)?origin:'https://truworth.vercel.app','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}};
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json','Cache-Control':'no-store'}});
const clean=(v:unknown,max=180)=>String(v||'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const brands=['Apple','Samsung','Sony','Meta','Dyson','Bose','Nintendo','Microsoft','Xbox','PlayStation','Canon','Nikon','Dell','HP','Lenovo','ASUS','Acer','LG','Philips','Bosch','DeLonghi','Nespresso','Nike','Adidas','LEGO','Garmin','Fitbit','GoPro','JBL','Pepsi','Coca-Cola','Coke','Red Bull','Nestle','Nescafe','Amazon','Kindle','Vaseline','Nivea','Carmex','Blistex','Dove','Neutrogena','CeraVe','Olay','Garnier','Maybelline','Gillette','Oral-B','Colgate','Pantene'];
const weakWords=new Set(['the','and','with','for','from','this','that','made','warning','caution','model','serial','barcode','product','item','new','use','only']);
function tokensFor(value:string){return clean(value,220).toLowerCase().split(/[^a-z0-9]+/).filter(t=>t.length>=3&&!weakWords.has(t));}
function quality(raw:string){
  const text=clean(raw,160),tokens=text.split(/\s+/).filter(Boolean),singles=tokens.filter(t=>t.replace(/[^A-Za-z0-9]/g,'').length<=1).length,alnum=(text.match(/[A-Za-z0-9]/g)||[]).length,letters=(text.match(/[A-Za-z]/g)||[]).length;
  const meaningful=tokens.filter(t=>/[A-Za-z]{3,}/.test(t)||/[A-Za-z]{2,}\d{1,4}/.test(t)||/\d{1,4}[A-Za-z]{2,}/.test(t));
  const known=brands.find(b=>text.toLowerCase().includes(b.toLowerCase()));
  const modelLike=meaningful.find(t=>/[A-Za-z].*\d|\d.*[A-Za-z]/.test(t));
  const useful=tokensFor(text);
  const structurallyClean=tokens.length>0&&singles/Math.max(1,tokens.length)<.25&&letters/Math.max(1,alnum)>=.55;
  const enoughSignal=Boolean(known||modelLike||(useful.length>=2&&meaningful.length>=2));
  return{ok:structurallyClean&&enoughSignal,query:clean(known?[known,...meaningful.filter(x=>x.toLowerCase()!==known.toLowerCase())].join(' '):meaningful.join(' ')||text,120),tokens:useful,known:modelLike?known||'':known||'',modelLike:modelLike||''};
}
function relevant(item:any,q:{tokens:string[],known:string,modelLike:string}){
  const hay=tokensFor(`${item?.brand||item?.brands||''} ${item?.title||item?.product_name||''} ${item?.description||''}`);
  const haySet=new Set(hay);
  if(q.known&&String(item?.brand||item?.brands||'').toLowerCase().includes(q.known.toLowerCase()))return true;
  if(q.modelLike&&haySet.has(q.modelLike.toLowerCase()))return true;
  const matches=q.tokens.filter(t=>haySet.has(t));
  return matches.length>=Math.min(2,q.tokens.length)&&matches.length>=2;
}
async function fetchJson(url:string){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);try{const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'TruWorth/1.0 product-resolution'},signal:controller.signal,redirect:'follow'});if(!r.ok)throw new Error(`provider ${r.status}`);return await r.json()}finally{clearTimeout(timer)}}
function candidate(item:any,source:'barcode'|'ocr'){const offers=Array.isArray(item?.offers)?item.offers:[],offer=offers.find((o:any)=>o?.link&&o?.price!=null)||offers.find((o:any)=>o?.link)||offers[0]||{},currency=/^[A-Z]{3}$/i.test(String(offer?.currency||''))?String(offer.currency).toUpperCase():null,n=Number(offer?.price);return{title:clean(item?.title||item?.description||'',220),brand:clean(item?.brand||'',100),category:clean(item?.category||'',140),image_url:Array.isArray(item?.images)&&/^https?:\/\//i.test(String(item.images[0]||''))?clean(item.images[0],700):null,source_url:/^https?:\/\//i.test(String(offer?.link||''))?clean(offer.link,700):null,source_label:source==='barcode'?'Barcode database match':'Structured catalogue text match',price:currency&&Number.isFinite(n)&&n>0?n:null,currency,retailer:clean(offer?.merchant||offer?.domain||'',120)||null,barcode:clean(item?.ean||item?.upc||'',40)||null,confidence:source==='barcode'?98:62}}
function openFactsCandidate(p:any,label:string,base:string){return{title:clean(p?.product_name||p?.generic_name||'',220),brand:clean(p?.brands||'',100),category:clean(p?.categories||'',140),image_url:/^https?:\/\//i.test(String(p?.image_front_url||''))?clean(p.image_front_url,700):null,source_url:p?.code?`${base}/product/${encodeURIComponent(String(p.code))}`:null,source_label:label,price:null,currency:null,retailer:null,barcode:clean(p?.code||'',40)||null,confidence:96}}
async function openBarcodeCandidate(base:string,barcode:string,label:string){try{const data=await fetchJson(`${base}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,generic_name,brands,image_front_url,categories`),p=data?.product;if(!p?.product_name)return null;return openFactsCandidate(p,label,base)}catch{return null}}
async function openProductCandidate(barcode:string){
  const sources=[
    ['https://world.openbeautyfacts.org','Open Beauty Facts barcode match'],
    ['https://world.openproductsfacts.org','Open Products Facts barcode match'],
    ['https://world.openfoodfacts.org','Open Food Facts barcode match']
  ] as const;
  for(const [base,label] of sources){const hit=await openBarcodeCandidate(base,barcode,label);if(hit)return hit}
  return null;
}
async function openFactsTextSearch(base:string,query:string,q:{tokens:string[],known:string,modelLike:string},label:string){
  try{
    const url=`${base}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=6&fields=code,product_name,generic_name,brands,image_front_url,categories`;
    const data=await fetchJson(url);
    return (data?.products||[]).filter((p:any)=>p?.product_name&&relevant(p,q)).map((p:any)=>openFactsCandidate(p,label,base)).slice(0,4);
  }catch(e){console.warn(`${label} search failed`,e);return[]}
}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405);
  const origin=req.headers.get('origin')||'';if(origin&&!allowedOrigins.has(origin))return json(req,{error:'Origin not allowed'},403);
  try{
    const body=await req.json(),barcode=clean(body?.barcode,40).replace(/[^0-9A-Za-z-]/g,''),raw=clean(body?.text,160);
    if(!barcode&&!raw)return json(req,{error:'Barcode or product text required'},400);
    let candidates:any[]=[],resolution=barcode?'barcode':'ocr',low=false,suggested='';
    if(barcode&&/^\d{8,14}$/.test(barcode)){
      const openHit=await openProductCandidate(barcode);if(openHit)candidates=[openHit];
      if(!candidates.length){try{const data=await fetchJson(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`);candidates=(data?.items||[]).map((x:any)=>candidate(x,'barcode')).filter((x:any)=>x.title).slice(0,4)}catch(e){console.warn('UPC lookup failed',e)}}
    }
    if(!candidates.length&&raw){
      const q=quality(raw);suggested=q.query;
      if(!q.ok)return json(req,{candidates:[],resolution:'ocr',low_confidence:true,detected_text:raw,suggested_query:'',photo_stored:false});
      try{
        const data=await fetchJson(`https://api.upcitemdb.com/prod/trial/search?s=${encodeURIComponent(q.query)}&offset=0`);
        candidates=(data?.items||[]).filter((x:any)=>relevant(x,q)).map((x:any)=>candidate(x,'ocr')).filter((x:any)=>x.title).slice(0,4);
      }catch(e){console.warn('Text catalogue lookup failed',e)}
      if(!candidates.length){
        const beauty=/\b(lip|balm|vaseline|nivea|carmex|blistex|cosmetic|cream|lotion|shampoo|conditioner|deodorant|perfume|mascara|skincare|moistur)/i.test(q.query);
        const base=beauty?'https://world.openbeautyfacts.org':'https://world.openproductsfacts.org';
        candidates=await openFactsTextSearch(base,q.query,q,beauty?'Open Beauty Facts text match':'Open Products Facts text match');
      }
      if(!candidates.length)low=true;
    }
    return json(req,{candidates,resolution,low_confidence:low,detected_text:raw||null,suggested_query:suggested||null,photo_stored:false});
  }catch(e){console.error(e);return json(req,{error:'We could not resolve that product right now.'},500)}
});