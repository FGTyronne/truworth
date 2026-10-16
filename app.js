(async()=>{
  const version='20261016m';
  const files=[
    'core-v2.js',
    'boot-gate.js',
    'tone-v4.js',
    'assess-v2.js',
    'library-v2.js',
    'account-v2.js',
    'storage-v21.js',
    'route-gate.js',
    'release-v6.js',
    'patch-v12.js',
    'audit-core-v14.js',
    'audit-product-v14.js',
    'audit-account-v14.js',
    'billing-v15.js',
    'voucher-ui-v16.js',
    'experience-v17.js',
    'copy-v19.js',
    'trial-v20.js',
    'monetization-v22.js',
    'experience-v23.js',
    'decision-engine-v24.js',
    'consent-v25.js',
    'experience-v25.js',
    'route-benefits-v25.js',
    'consent-route-v25.js',
    'adspace-v26.js',
    'guest-access-v27.js',
    'help-v28.js',
    'launch-hardening-v31.js',
    'commercial-v32.js',
    'ux-v33.js',
    'footer-nav-v34.js'
  ];
  for(const file of files){
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=`${file}?v=${version}`;
      s.async=false;
      s.onload=resolve;
      s.onerror=()=>reject(new Error(`Could not load ${file}`));
      document.head.appendChild(s);
    });
  }
  window.__TRUWORTH_RELEASE_READY__=true;
  window.dispatchEvent(new CustomEvent('truworth:release-ready'));
})().catch((error)=>{
  console.error('TruWorth failed to start',error);
  document.body.innerHTML='<main style="font:16px system-ui;padding:40px;max-width:680px;margin:auto"><h1>TruWorth</h1><p>We could not start the app. Refresh the page and try again.</p></main>';
});