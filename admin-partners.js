(() => {
  'use strict';
  const SUPABASE_URL='https://npfdkbqjoxolxxtmprmr.supabase.co';
  const SUPABASE_KEY='sb_publishable_0Sohm-jtjfxMQ8fpM3zsAg_iF7oF1fo';
  const root=document.getElementById('partnerAdminApp');
  const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const statuses=['new','in_review','qualified','declined','closed'];
  let current='all';
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label=(v)=>({new:'New',in_review:'In review',qualified:'Qualified',declined:'Declined',closed:'Closed'}[v]||v);
  const date=(v)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v));

  async function call(payload){
    const {data:{session}}=await sb.auth.getSession();
    if(!session)return{status:401,data:{error:'Sign in required'}};
    const res=await fetch(`${SUPABASE_URL}/functions/v1/partner-admin`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':SUPABASE_KEY},body:JSON.stringify(payload)});
    const data=await res.json().catch(()=>({error:'Unexpected server response'}));
    return{status:res.status,data};
  }

  function denied(message='This account does not have administrator access.'){
    root.innerHTML=`<section class="partner-admin-panel"><h1>Partner enquiries</h1><p class="partner-admin-error">${esc(message)}</p><p><a href="account.html">Back to account</a></p></section>`;
  }

  function card(row){
    const website=row.company_website?`<a href="${esc(row.company_website)}" target="_blank" rel="noopener noreferrer">Website</a>`:'';
    return `<article class="partner-enquiry" data-id="${esc(row.id)}"><div class="partner-enquiry-head"><div><h2>${esc(row.company_name)} · ${esc(row.contact_name)}</h2><div class="partner-enquiry-meta">${esc(row.enquiry_type.replaceAll('_',' '))} · ${esc(date(row.created_at))} · <a href="mailto:${esc(row.work_email)}">${esc(row.work_email)}</a>${website?` · ${website}`:''}</div></div><span class="status-pill">${esc(label(row.status))}</span></div><div class="partner-enquiry-message">${esc(row.message)}</div><div class="partner-enquiry-actions"><label>Pipeline status <select data-status>${statuses.map(s=>`<option value="${s}" ${s===row.status?'selected':''}>${label(s)}</option>`).join('')}</select></label></div></article>`;
  }

  function shell(rows){
    const filters=['all',...statuses];
    root.innerHTML=`<section class="partner-admin-panel"><div class="partner-admin-toolbar"><div><div class="kicker">Private admin</div><h1>Partner enquiries</h1></div><div class="partner-admin-filter">${filters.map(s=>`<button type="button" data-filter="${s}" class="${s===current?'active':''}">${s==='all'?'All':label(s)}</button>`).join('')}</div></div><div class="partner-admin-list">${rows.length?rows.map(card).join(''):'<div class="partner-admin-empty">No enquiries in this view.</div>'}</div></section>`;
    root.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{current=btn.dataset.filter;void load();}));
    root.querySelectorAll('[data-status]').forEach(select=>select.addEventListener('change',async()=>{
      const article=select.closest('[data-id]');const prior=article.querySelector('.status-pill').textContent;select.disabled=true;
      const result=await call({action:'update_status',id:article.dataset.id,status:select.value});
      if(result.status===200&&result.data?.ok){article.querySelector('.status-pill').textContent=label(select.value);if(current!=='all'&&current!==select.value)article.remove();}
      else{article.querySelector('.status-pill').textContent=prior;alert(result.data?.error||'Status update failed.');}
      select.disabled=false;
    }));
  }

  async function load(){
    root.innerHTML='<div class="partner-admin-loading">Loading enquiries…</div>';
    const result=await call({action:'list',status:current});
    if(result.status===401){location.href='account.html';return;}
    if(result.status===403){denied();return;}
    if(result.status!==200){denied(result.data?.error||'Partner enquiries could not be loaded.');return;}
    shell(result.data?.enquiries||[]);
  }

  void load();
})();
