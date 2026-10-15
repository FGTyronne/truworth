import fs from 'node:fs';

const failures=[];
const read=(p)=>fs.readFileSync(p,'utf8');
const expect=(ok,msg)=>{if(!ok)failures.push(msg);};
const partnerHtml=read('admin-partners.html');
const partnerClient=read('admin-partners.js');
const partnerAdmin=read('supabase/functions/partner-admin/index.ts');
const voucherAdmin=read('supabase/functions/voucher-admin/index.ts');
const config=read('supabase/config.toml');

expect(/name=["']robots["'][^>]+noindex/i.test(partnerHtml),'admin-partners.html must remain noindex.');
expect(/app_admins/.test(partnerAdmin),'Partner admin must check the app_admins gate.');
expect(/app_admins/.test(voucherAdmin),'Voucher admin must check the app_admins gate.');
expect(/action==='dashboard'/.test(partnerAdmin),'Partner admin must expose the protected commercial dashboard action.');
expect(/ad_events/.test(partnerAdmin)&&/ad_campaigns/.test(partnerAdmin),'Partner admin dashboard must report campaign performance.');
expect(/action:'dashboard'/.test(partnerClient),'Partner admin browser client must load the protected dashboard summary.');
expect(/impressions_30d/.test(partnerClient)&&/ctr_30d/.test(partnerClient),'Partner admin UI must surface 30-day commercial metrics.');
expect(/\[functions\.partner-admin\][\s\S]*?verify_jwt\s*=\s*true/.test(config),'partner-admin must require JWT verification.');
expect(/\[functions\.voucher-admin\][\s\S]*?verify_jwt\s*=\s*true/.test(config),'voucher-admin must require JWT verification.');
expect(!/truworth\.vercel\.app/i.test(partnerAdmin),'Partner admin contains legacy Vercel origin.');
expect(!/truworth\.vercel\.app/i.test(voucherAdmin),'Voucher admin contains legacy Vercel origin.');
expect(!/SERVICE_ROLE|SUPABASE_SECRET_KEYS/i.test(partnerClient),'Partner admin browser client contains a server credential reference.');
expect(/partner-admin/.test(partnerClient),'Partner admin client is not calling the protected admin function.');

if(failures.length){failures.forEach(x=>console.error(`FAIL: ${x}`));console.error(`\n${failures.length} admin boundary check(s) failed.`);process.exit(1);}
console.log('Admin boundary checks passed.');
