(() => {
  function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function mapsUrl(s){return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name} ${s.address||''}`.trim())}`;}
  async function renderNearby(button){
    const selected=button.closest('.snap-selected');
    const title=selected?.querySelector('strong')?.textContent?.trim()||'';
    if(!selected||!title)return;
    let mount=selected.querySelector('.nearby-inline-results');
    if(!mount){mount=document.createElement('div');mount.className='nearby-inline-results';selected.appendChild(mount);}
    mount.innerHTML='<p class="nearby-loading">Finding likely nearby sellers…</p>';
    button.disabled=true;
    if(!navigator.geolocation){mount.innerHTML='<p>Location is not available in this browser.</p>';button.disabled=false;return;}
    navigator.geolocation.getCurrentPosition(async(pos)=>{
      try{
        const {data,error}=await supabaseClient.functions.invoke('nearby-sellers',{body:{query:title,lat:pos.coords.latitude,lon:pos.coords.longitude}});
        if(error)throw error;
        const sellers=data?.sellers||[];
        if(!sellers.length)throw new Error('No nearby sellers returned');
        mount.innerHTML=`<div class="nearby-inline-head"><strong>Likely nearby sellers</strong><small>Distance only. Stock is not confirmed.</small></div><div class="nearby-inline-list">${sellers.map(s=>`<a target="_blank" rel="noopener noreferrer" href="${mapsUrl(s)}"><span><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.address||s.category||'Retailer')}</small></span><span>${Number(s.distance_km).toFixed(1)} km →</span></a>`).join('')}</div>`;
      }catch(error){console.error(error);mount.innerHTML=`<div class="nearby-inline-head"><strong>Nearby search unavailable</strong><small>Try Maps instead.</small></div><a class="secondary-button" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title+' retailer near me')}">Search nearby on Maps</a>`;}
      finally{button.disabled=false;}
    },()=>{mount.innerHTML='<p>Location permission was not granted. You can still assess the product normally.</p>';button.disabled=false;},{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
  }
  document.addEventListener('click',(event)=>{
    const button=event.target.closest?.('.snap-nearby');
    if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();renderNearby(button);
  },true);
})();