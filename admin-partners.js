(() => {
  'use strict';
  const SUPABASE_URL='https://npfdkbqjoxolxxtmprmr.supabase.co';
  const SUPABASE_KEY='sb_publishable_0Sohm-jtjfxMQ8fpM3zsAg_iF7oF1fo';
  const root=document.getElementById('partnerAdminApp');
  const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const statuses=['new','in_review','qualified','declined','closed'];
  let current='all';
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label=(v)=>({new:'New',in_review:'In review',qualified:'Qualified',declined:'Declined',closed:'Closed',active:'Active',paused:'Paused',ended:'Ended',draft:'Draft'}[v]||v);
  const date=(v)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v));
  const number=(v)=>new Intl.NumberFormat('en-GB').format(Number(v||0));

  async function call(payload){
    const {data:{session}}=await sb.auth.getSession();
    if(!session)return{status:401,data:{error:'Sign in required'}};
    const res=await fetch(`${SUPABASE_URL}/functions/v1/partner-admin`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':SUPABASE_KEY},body:JSON.stringify(payload)});
    const data=await res.json().catch(()=>({error:'Unexpected server response'}));
    return{status:res.status,data};
  }

  function denied(message='This account does not have administrator access.'){
    root.innerHTML=`<section class="partner-admin-panel"><h1>Partner administration</h1><p class="partner-admin-error">${esc(message)}</p><p><a href="account.html">Back to account</a></p></section>`;
  }

  function enquiryCard(row){
    const website=row.company_website?`<a href="${esc(row.company_website)}" target="_blank" rel="noopener noreferrer">Website</a>`:'';
    return `<article class="partner-enquiry" data-id="${esc(row.id)}"><div class="partner-enquiry-head"><div><h2>${esc(row.company_name)} · ${esc(row.contact_name)}</h2><div class="partner-enquiry-meta">${esc(row.enquiry_type.replaceAll('_',' '))} · ${esc(date(row.created_at))} · <a href="mailto:${esc(row.work_email)}">${esc(row.work_email)}</a>${website?` · ${website}`:''}</div></div><span class="status-pill">${esc(label(row.status))}</span></div><div class="partner-enquiry-message">${esc(row.message)}</div><div class="partner-enquiry-actions"><label>Pipeline status <select data-status>${statuses.map(s=>`<option value="${s}" ${s===row.status?'selected':''}>${label(s)}</option>`).join('')}</select></label></div></article>`;
  }

  function metric(labelText,value,note=''){
    return `<div class="partner-metric"><span>${esc(labelText)}</span><strong>${esc(value)}</strong>${note?`<small>${esc(note)}</small>`:''}</div>`;
  }

  function campaignCard(row){
    const placements=(row.placements||[]).join(', ')||'all eligible';
    return `<article class="partner-campaign"><div><strong>${esc(row.name)}</strong><span>${esc(row.campaign_type)} · ${esc(label(row.status))} · ${esc(placements)}</span></div><div class="partner-campaign-numbers"><span><strong>${number(row.impressions_30d)}</strong> impressions</span><span><strong>${number(row.clicks_30d)}</strong> clicks</span><span><strong>${Number(row.ctr_30d||0).toFixed(2)}%</strong> CTR</span></div></article>`;
  }

  function shell(rows,dashboard){
    const filters=['all',...statuses];
    const summary=dashboard?.summary||{};
    const campaigns=dashboard?.campaigns||[];
    root.innerHTML=`
      <section class="partner-admin-panel partner-admin-overview">
        <div class="kicker">Private admin</div><h1>Partner & commercial dashboard</h1>
        <div class="partner-metrics">
          ${metric('New enquiries',number(summary.enquiries_new),'pipeline')}
          ${metric('In review',number(summary.enquiries_in_review),'pipeline')}
          ${metric('Qualified',number(summary.enquiries_qualified),'pipeline')}
          ${metric('Active partners',number(summary.active_partners))}
          ${metric('Active benefits',number(summary.active_benefits))}
          ${metric('Active campaigns',number(summary.active_campaigns))}
          ${metric('30d impressions',number(summary.impressions_30d),'consented measurement')}
          ${metric('30d clicks',number(summary.clicks_30d),'consented measurement')}
          ${metric('30d CTR',`${Number(summary.ctr_30d||0).toFixed(2)}%`)}
        </div>
        ${summary.event_sample_limited?'<p class="partner-admin-note">The 30-day event view reached the 10,000-event reporting cap. Use a direct data export for an exhaustive report.</p>':''}
        <div class="partner-admin-section-head"><div><span class="kicker">Campaigns</span><h2>30-day performance</h2></div></div>
        <div class="partner-campaign-list">${campaigns.length?campaigns.slice(0,30).map(campaignCard).join(''):'<div class="partner-admin-empty">No campaigns configured yet.</div>'}</div>
      </section>
      <section class="partner-admin-panel">
        <div class="partner-admin-toolbar"><div><div class="kicker">Pipeline</div><h2>Partner enquiries</h2></div><div class="partner-admin-filter">${filters.map(s=>`<button type="button" data-filter="${s}" class="${s===current?'active':''}">${s==='all'?'All':label(s)}</button>`).join('')}</div></div>
        <div class="partner-admin-list">${rows.length?rows.map(enquiryCard).join(''):'<div class="partner-admin-empty">No enquiries in this view.</div>'}</div>
      </section>`;
    root.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{current=btn.dataset.filter;void load();}));
    root.querySelectorAll('[data-status]').forEach(select=>select.addEventListener('change',async()=>{
      const article=select.closest('[data-id]');select.disabled=true;
      const result=await call({action:'update_status',id:article.dataset.id,status:select.value});
      if(result.status===200&&result.data?.ok)await load();
      else{alert(result.data?.error||'Status update failed.');select.disabled=false;}
    }));
  }

  async function load(){
    root.innerHTML='<div class="partner-admin-loading">Loading partner dashboard…</div>';
    const [dashboardResult,listResult]=await Promise.all([call({action:'dashboard'}),call({action:'list',status:current})]);
    if(dashboardResult.status===401||listResult.status===401){location.href='account.html';return;}
    if(dashboardResult.status===403||listResult.status===403){denied();return;}
    if(dashboardResult.status!==200){denied(dashboardResult.data?.error||'Partner dashboard could not be loaded.');return;}
    if(listResult.status!==200){denied(listResult.data?.error||'Partner enquiries could not be loaded.');return;}
    shell(listResult.data?.enquiries||[],dashboardResult.data||{});
  }

  void load();
})();
