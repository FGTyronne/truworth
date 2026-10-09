(() => {
  const key = typeof LOCAL_KEY !== 'undefined' ? LOCAL_KEY : 'truworth_guest_v1';
  const emptyState = () => ({ records: [], owned: {}, settings: { motion: true } });

  function normalise(value) {
    const parsed = value && typeof value === 'object' ? value : {};
    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
      owned: parsed.owned && typeof parsed.owned === 'object' ? parsed.owned : {},
      settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : { motion: true }
    };
  }

  function readSession() {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? normalise(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  function writeSession(value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(normalise(value)));
    } catch (error) {
      console.warn('Could not keep temporary guest data for this session.', error);
    }
  }

  // Core has already read any legacy guest state at this point. Move it into
  // sessionStorage once, then remove the persistent browser copy.
  const sessionState = readSession();
  if (sessionState) {
    local = sessionState;
  } else {
    local = normalise(typeof local !== 'undefined' ? local : emptyState());
    writeSession(local);
  }
  try { localStorage.removeItem(key); } catch {}

  loadLocal = function sessionOnlyLoadLocal() {
    return readSession() || emptyState();
  };

  saveLocal = function sessionOnlySaveLocal() {
    local.records = Array.isArray(records) ? records : [];
    local.owned = purchases && typeof purchases === 'object' ? purchases : {};
    writeSession(local);
    try { localStorage.removeItem(key); } catch {}
  };

  if (typeof syncGuestRecords === 'function') {
    syncGuestRecords = async function sessionOnlySyncGuestRecords() {
      if (!supabaseClient || !local.records?.length) return;
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const currentUser = sessionData.session?.user;
      if (!currentUser) return;

      const guestRecords = local.records.map(normaliseGuestRecord).slice(0, 10);
      for (const record of guestRecords) {
        const inputs = { ...record.inputs, item: record.title };
        const metrics = score(inputs);
        const { error } = await supabaseClient.from('assessments').insert({
          user_id: currentUser.id,
          title: record.title,
          brand: record.brand || null,
          retailer: record.retailer || null,
          source_url: record.source_url || null,
          canonical_url: record.canonical_url || null,
          image_url: record.image_url || null,
          observed_price: record.observed_price,
          currency: record.currency || 'GBP',
          score: record.score ?? metrics.score,
          score_version: record.score_version || metrics.version,
          inputs,
          status: record.status || 'considering'
        });
        if (error && String(error.message).includes('storage limit')) break;
        if (error) throw error;
      }

      local = { records: [], owned: {}, settings: local.settings || { motion: true } };
      writeSession(local);
      try { localStorage.removeItem(key); } catch {}
    };
  }
})();