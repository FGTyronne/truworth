(async()=>{
  const version='20261008d';
  const files=[
    'core-v2.js',
    'boot-gate.js',
    'tone-v4.js',
    'assess-v2.js',
    'library-v2.js',
    'account-v2.js',
    'route-gate.js',
    'release-v6.js',
    'snap-v7.js',
    'barcode-polyfill-v19.js',
    'vision-v20.js',
    'snap-ocr-guard-v19.js',
    'snap-nearby-v8.js',
    'patch-v12.js',
    'audit-core-v14.js',
    'audit-product-v14.js',
    'audit-account-v14.js',
    'billing-v15.js',
    'voucher-ui-v16.js'
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