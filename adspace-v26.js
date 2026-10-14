(() => {
  'use strict';
  const isPlus = () => Boolean(user && subscription?.tier === 'plus' && ['active','trialing'].includes(subscription?.status));
  const pageKey = () => page();
  function styles(){
    if(document.getElementById('twAdspaceV26Styles')) return;
    const s=document.createElement('style'); s.id='twAdspaceV26Styles'; s.textContent=`
      .tw-partner-slot{margin:24px 0;border:1px solid rgba(23,24,32,.10);border-radius:18px;background:#f7f7f2;padding:16px 18px;display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center}
      .tw-partner-slot small{display:block;text-transform:uppercase;letter-spacing:.08em;font-size:.68rem;font-weight:800;color:#858977;margin-bottom:5px}.tw-partner-slot strong{display:block;font-size:1rem;margin-bottom:4px}.tw-partner-slot p{margin:0;color:#6c707b;font-size:.84rem;line-height:1.4}.tw-partner-slot a{white-space:nowrap;font-weight:800;text-decoration:none;color:#171820;border-bottom:1px solid rgba(23,24,32,.35);padding-bottom:2px}
      .tw-partner-slot[data-kind="benefit"]{background:#fbfaf6}.tw-partner-slot[data-kind="house"]{background:#f3f5ed}.tw-partner-slot em{font-style:normal;font-size:.72rem;color:#858977;display:block;margin-top:7px}
      @media(max-width:720px){.tw-partner-slot{grid-template-columns:1fr}.tw-partner-slot a{justify-self:start}}
    `; document.head.appendChild(s);
  }
  function slot(kind='advertise'){
    const copy={
      advertise:['Partner space','For brands & retailers','Reach people while they are actively deciding what to buy.','Advertise with TruWorth →'],
      benefit:['Member benefit partner','Give members a genuine perk','Offer a useful discount or service benefit without influencing TruWorth recommendations.','List a member benefit →'],
      house:['TruWorth+','Make the decision personal','Unlock personalised purchase guidance, Decision Discipline and Member Benefits.','Explore TruWorth+ →']
    }[kind]||[];
    const href=kind==='house'?'plans.html':'partner-with-truworth.html';
    return `<section class="tw-partner-slot" data-kind="${kind}" aria-label="${copy[0]}"><div><small>${copy[0]}</small><strong>${copy[1]}</strong><p>${copy[2]}</p>${kind!=='house'?'<em>Commercial relationships never affect TruWorth scores or recommendations.</em>':''}</div><a href="${href}">${copy[3]}</a></section>`;
  }
  function insert(){
    styles();
    if(isPlus()) return;
    const main=document.getElementById('main-content'); if(!main||main.querySelector('.tw-partner-slot')) return;
    const p=pageKey();
    let kind='advertise';
    if(p==='home') kind='house';
    if(p==='benefits') kind='benefit';
    if(['result','compare'].includes(p)){
      const target = p==='compare' ? document.getElementById('comparison') : document.querySelector('.result-layout');
      if(target) target.insertAdjacentHTML('afterend',slot('advertise')); else main.insertAdjacentHTML('beforeend',slot('advertise'));
      return;
    }
    if(['settings','account','plans','assess'].includes(p)) return;
    main.insertAdjacentHTML('beforeend',slot(kind));
  }
  window.addEventListener('truworth:routed',()=>setTimeout(insert,0));
  window.addEventListener('truworth:release-ready',()=>setTimeout(insert,0));
  setTimeout(insert,200);
})();