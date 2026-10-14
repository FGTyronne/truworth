(() => {
  'use strict';
  const isPlus = () => Boolean(user && subscription?.tier === 'plus' && ['active','trialing'].includes(subscription?.status));
  const originalNavItems = navItems;
  navItems = function(){
    const items = originalNavItems();
    if (!items.some((x)=>x[0]==='benefits')) items.splice(Math.max(0,items.length-1),0,['benefits','Benefits','member-benefits.html','saved']);
    return items;
  };

  function injectStyles(){
    if(document.getElementById('twBenefitsV25Styles')) return;
    const s=document.createElement('style');s.id='twBenefitsV25Styles';s.textContent=`
      .benefits-hero{border-radius:28px;padding:30px;background:linear-gradient(135deg,#171820,#292c38);color:#fff;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:center}.benefits-hero h2{font-size:clamp(1.6rem,4vw,2.6rem);margin:4px 0 10px}.benefits-hero p{color:rgba(255,255,255,.75);max-width:720px}.benefits-plan{background:#d8fa69;color:#171820;border-radius:999px;padding:10px 14px;font-weight:850;white-space:nowrap}.benefits-section{margin-top:28px}.benefits-head{display:flex;justify-content:space-between;gap:18px;align-items:end;margin-bottom:14px}.benefits-head h2{margin:0}.benefits-head p{margin:4px 0 0;color:#696d79}.benefits-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.benefit-card{position:relative;background:#fff;border:1px solid rgba(23,24,32,.1);border-radius:22px;padding:20px;min-height:210px;overflow:hidden}.benefit-card .tag{display:inline-flex;padding:6px 9px;border-radius:999px;background:#f1f2ed;font-size:.72rem;font-weight:800}.benefit-card h3{margin:14px 0 8px}.benefit-card p,.benefit-card li{color:#666a77;font-size:.88rem;line-height:1.5}.benefit-card ul{padding-left:18px;margin:10px 0 0}.benefit-card.locked .benefit-content{filter:blur(7px);user-select:none;pointer-events:none;opacity:.72}.benefit-lock{position:absolute;inset:0;display:grid;place-items:center;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.88));z-index:2}.benefit-lock>div{background:#171820;color:#fff;border-radius:16px;padding:14px 16px;text-align:center;box-shadow:0 12px 35px rgba(0,0,0,.16)}.benefit-lock strong{display:block}.benefit-lock span{display:block;font-size:.76rem;color:rgba(255,255,255,.7);margin-top:4px}.partner-state{border:1px dashed rgba(23,24,32,.22);border-radius:22px;padding:22px;background:#fafaf7}.partner-categories{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.partner-categories span{border-radius:999px;background:#eceee7;padding:7px 10px;font-size:.78rem;font-weight:700}.benefits-trust{margin-top:24px;border-radius:20px;padding:18px;background:#eef8c9}.benefits-trust strong{display:block;margin-bottom:6px}.settings-legal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}.settings-legal-grid a{display:block;border:1px solid rgba(23,24,32,.1);border-radius:16px;padding:14px;text-decoration:none;color:inherit;background:#fff}.settings-legal-grid strong{display:block}.settings-legal-grid span{display:block;color:#6d7080;font-size:.8rem;margin-top:4px}.site-footer{position:relative!important;z-index:5!important;pointer-events:auto!important;display:flex!important;gap:12px!important;flex-wrap:wrap!important}.site-footer a,.site-footer button{pointer-events:auto!important;position:relative!important;z-index:6!important}.tw-cookie-link{border:0;background:none;padding:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit}
      @media(max-width:850px){.benefits-grid{grid-template-columns:1fr 1fr}.benefits-hero{grid-template-columns:1fr}.settings-legal-grid{grid-template-columns:1fr}}
      @media(max-width:620px){.benefits-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function internalCard(title, tag, copy, bullets){
    const locked=!isPlus();
    return `<article class="benefit-card ${locked?'locked':''}"><div class="benefit-content"><span class="tag">${esc(tag)}</span><h3>${esc(title)}</h3><p>${esc(copy)}</p><ul>${bullets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>${locked?`<div class="benefit-lock"><div><strong>TruWorth+ benefit</strong><span>Unlock the full toolkit with membership.</span></div></div>`:''}</article>`;
  }

  window.benefitsPage = function(){
    injectStyles();
    const plus=isPlus();
    layout('Member Benefits','Extra value for people who want TruWorth to help before, during and after a purchase.',`
      <section class="benefits-hero"><div><p class="kicker">Member Benefits</p><h2>Make the better decision. Then get more value from it.</h2><p>TruWorth Originals are created by us to improve financial discipline and purchase judgement. Partner Benefits are commercially separate and never change a TruWorth recommendation.</p></div><span class="benefits-plan">${plus?'TruWorth+ unlocked':'Preview mode'}</span></section>
      <section class="benefits-section"><div class="benefits-head"><div><h2>TruWorth Originals</h2><p>Internal tools, exercises and financial-literacy frameworks built around the TruWorth method.</p></div></div><div class="benefits-grid">
        ${internalCard('24-hour Purchase Reset','Decision discipline','A short reset for purchases driven by urgency, novelty or status.',['Name the problem the purchase solves.','Write the cheaper alternative.','Wait 24 hours for discretionary purchases.','Re-run TruWorth after the cooling-off period.'])}
        ${internalCard('Opportunity Cost Check','Financial literacy','Translate a purchase into what it displaces from your real financial goals.',['Compare cost with one month of free cash.','Identify the saving or debt goal delayed.','Ask whether the benefit still wins after that trade-off.'])}
        ${internalCard('The Upgrade Test','Better buying','A practical filter for phones, laptops, cars, fashion and other repeat upgrades.',['What is materially broken or constrained today?','What measurable improvement will the upgrade create?','How long will you keep it?','Would you still buy it without status or novelty?'])}
        ${internalCard('Decision Discipline Playbook','Behaviour','Use your 1–10 Decision Discipline setting deliberately instead of emotionally.',['1–3 prioritises enjoyment and lifestyle fit.','4–7 balances value and restraint.','8–10 actively challenges avoidable spending.'])}
        ${internalCard('Value-For-Money Worksheet','Maths','Pressure-test price against realistic lifetime use instead of headline desire.',['Estimate lifetime uses.','Include maintenance and accessories.','Calculate cost per use.','Stress-test at half the expected use.'])}
        ${internalCard('Post-Purchase Review','Learning loop','Turn purchases into evidence for better future decisions.',['Record actual usage.','Score satisfaction after novelty fades.','Note regret and unexpected costs.','Feed the result back into your buyer profile.'])}
      </div></section>
      <section class="benefits-section"><div class="benefits-head"><div><h2>Partner Benefits</h2><p>Verified member offers will live here as TruWorth partnerships activate.</p></div></div>
        <div class="partner-state">${plus?`<strong>No live partner benefit is being represented as active yet.</strong><p>As partners are onboarded, this area will show the exact benefit, validity period, eligibility, redemption method and whether TruWorth receives affiliate or sponsorship compensation.</p>`:`<strong>Partner benefits are member-only.</strong><p>You can see the categories, but exact discounts, codes, redemption links and terms will be available only to active TruWorth+ members when verified benefits go live.</p>`}<div class="partner-categories"><span>Technology</span><span>Repair & trade-in</span><span>Home</span><span>Travel</span><span>Fitness</span><span>Lifestyle</span><span>Learning</span></div>${!plus?`<div style="margin-top:16px"><a class="primary-button" href="plans.html">Unlock Member Benefits</a></div>`:''}</div>
      </section>
      <section class="benefits-trust"><strong>Recommendation independence</strong><span>A discount, affiliate payment, sponsorship or partner relationship cannot increase a product's TruWorth score or make the engine recommend BUY. The decision is calculated first; benefits are shown afterwards.</span></section>
    `,{kicker:'TruWorth+'});
  };

  function repairFooter(){
    const footer=document.querySelector('.site-footer'); if(!footer)return;
    footer.innerHTML=`<a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="cookies.html">Cookies</a><a href="security.html">Security</a><a href="decision-support.html">How TruWorth works</a><a href="member-benefits.html">Member Benefits</a><a href="partner-with-truworth.html">Partner with us</a><a href="plans.html">Membership</a><a href="settings.html">Settings</a><button class="tw-cookie-link" type="button" data-tw-cookie-settings>Cookie settings</button>`;
  }

  function enhanceSettings(){
    if(page()!=='settings')return; const list=document.querySelector('.settings-list'); if(!list||document.getElementById('settingsLegalV25'))return;
    const card=document.createElement('article');card.id='settingsLegalV25';card.innerHTML=`<div style="width:100%"><h2>Privacy, cookies & legal</h2><p>Review how TruWorth uses data, manage optional cookie choices, read service terms and see our security information.</p><div class="settings-legal-grid"><a href="privacy.html"><strong>Privacy Notice</strong><span>Data, purposes, rights and decision profiling</span></a><a href="cookies.html"><strong>Cookie Policy</strong><span>Browser storage, categories and controls</span></a><a href="terms.html"><strong>Terms of Service</strong><span>Subscriptions, acceptable use and consumer rights</span></a><a href="security.html"><strong>Security</strong><span>Safeguards and responsible disclosure</span></a><a href="decision-support.html"><strong>How TruWorth works</strong><span>Formula concepts and recommendation boundaries</span></a><a href="#" data-tw-cookie-settings><strong>Cookie settings</strong><span>Change optional analytics and marketing choices</span></a></div></div>`;list.appendChild(card);
  }

  injectStyles();
  const previousLayout=layout;
  layout=function(...args){ previousLayout(...args); repairFooter(); enhanceSettings(); };
  window.addEventListener('truworth:routed',()=>{repairFooter();enhanceSettings();});
})();