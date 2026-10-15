(() => {
  'use strict';

  const CONTENT_ENDPOINT = 'https://npfdkbqjoxolxxtmprmr.supabase.co/functions/v1/commercial-content';
  const EVENT_ENDPOINT = 'https://npfdkbqjoxolxxtmprmr.supabase.co/functions/v1/commercial-event';
  const eligible = new Set(['home','result','compare','watchlist','insights','benefits']);
  const isPlus = () => Boolean(user && subscription?.tier === 'plus' && ['active','trialing'].includes(subscription?.status));

  function sessionId() {
    const key = 'truworth_partner_session_v1';
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(key, value);
    }
    return value;
  }

  function consented() {
    return Boolean(window.TruWorthConsent?.allows?.('marketing'));
  }

  function placement() {
    const key = typeof page === 'function' ? page() : '';
    return eligible.has(key) ? key : null;
  }

  async function event(campaignId, placementKey, eventType) {
    if (!consented()) return;
    try {
      await fetch(EVENT_ENDPOINT, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, placement: placementKey, event_type: eventType, session_id: sessionId() })
      });
    } catch {}
  }

  function campaignHtml(campaign) {
    const disclosure = campaign.disclosure || (campaign.sponsored ? 'Sponsored' : campaign.affiliate ? 'Affiliate' : 'Partner');
    return `<div><small>${esc(disclosure)}</small><strong>${esc(campaign.headline)}</strong><p>${esc(campaign.body)}</p><em>Commercial relationships never affect TruWorth scores or recommendations.</em></div><a data-tw-campaign-link href="${esc(campaign.destination_url)}" target="_blank" rel="noopener noreferrer${campaign.affiliate ? ' sponsored' : ''}">${esc(campaign.cta)}</a>`;
  }

  async function hydrate() {
    if (isPlus()) return;
    const placementKey = placement();
    if (!placementKey) return;
    try {
      const response = await fetch(CONTENT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placement: placementKey })
      });
      if (!response.ok) return;
      const body = await response.json();
      const campaign = body?.campaign;
      if (!campaign?.id) return;
      let slot = document.querySelector('.tw-partner-slot');
      if (!slot) {
        await new Promise((resolve) => setTimeout(resolve, 80));
        slot = document.querySelector('.tw-partner-slot');
      }
      if (!slot || slot.closest('#twDecisionMount')) return;
      slot.dataset.campaignId = campaign.id;
      slot.dataset.kind = 'campaign';
      slot.setAttribute('aria-label', campaign.disclosure || 'Commercial partner');
      slot.innerHTML = campaignHtml(campaign);
      const link = slot.querySelector('[data-tw-campaign-link]');
      link?.addEventListener('click', () => { void event(campaign.id, placementKey, 'click'); });
      void event(campaign.id, placementKey, 'impression');
    } catch (error) {
      console.warn('TruWorth commercial content unavailable', error);
    }
  }

  function remeasureVisibleCampaign() {
    const slot = document.querySelector('.tw-partner-slot[data-campaign-id]');
    const placementKey = placement();
    if (!slot || !placementKey || !consented()) return;
    void event(slot.dataset.campaignId, placementKey, 'impression');
  }

  window.addEventListener('truworth:routed', () => setTimeout(hydrate, 120));
  window.addEventListener('truworth:subscription-change', () => setTimeout(hydrate, 120));
  window.addEventListener('truworth:consent-change', remeasureVisibleCampaign);
  setTimeout(() => { if (window.__TRUWORTH_ROUTED__) void hydrate(); }, 220);
})();
