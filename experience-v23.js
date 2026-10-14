(() => {
  const privatePages = new Set(['assess','result','compare','watchlist','owned','insights','settings']);
  const originalRouteV23 = typeof route === 'function' ? route : null;
  if (originalRouteV23) {
    route = function routeV23() {
      if (!user && privatePages.has(page())) {
        const file = location.pathname.split('/').pop() || 'index.html';
        sessionStorage.setItem('truworth-return-to', `${file}${location.search || ''}`);
        location.href = 'account.html';
        return;
      }
      return originalRouteV23();
    };
  }

  if (typeof login === 'function') {
    login = async function loginV23(event) {
      event.preventDefault();
      const message = $('loginMessage');
      message.textContent = '';
      const { error } = await supabaseClient.auth.signInWithPassword({ email: $('loginEmail').value.trim(), password: $('loginPassword').value });
      if (error) {
        message.textContent = error.message;
        message.className = 'form-message error';
        return;
      }
      await syncGuestRecords();
      const returnTo = sessionStorage.getItem('truworth-return-to') || 'index.html';
      sessionStorage.removeItem('truworth-return-to');
      location.href = returnTo;
    };
  }

  let applying = false;
  const setText = (node, text) => {
    if (node && node.textContent !== text) node.textContent = text;
  };
  const normalisePattern = (value) => {
    const text = String(value || '').trim();
    if (!text || /^(Exploring|Still learning)$/i.test(text)) return 'Not enough data';
    if (/^Joy-led$/i.test(text)) return 'For enjoyment';
    if (/^Impulse-led$/i.test(text)) return 'Impulse/status';
    return text;
  };

  function buyingHeadline() {
    const bought = records.filter((r) => r.status === 'purchased' || purchases[r.id]);
    if (!records.length) return 'Complete a few assessments to start seeing your buying patterns.';
    if (!bought.length) return 'Mark something as bought when you purchase it. TruWorth will then compare what you consider with what you actually buy.';
    return 'Compare the products you consider with the products you actually buy.';
  }

  function fixHome() {
    if (page() !== 'home') return;
    const trust = document.querySelector('.tw-home-trust');
    if (trust) {
      const wanted = '<span><b>✓</b>Free account</span><span><b>✓</b>About 2 minutes</span><span><b>✓</b>Clear 0–100 score</span>';
      if (trust.innerHTML !== wanted) trust.innerHTML = wanted;
    }
    document.querySelectorAll('.tw-stat-strip article').forEach((card) => {
      const label = card.querySelector('b');
      const value = card.querySelector('strong');
      const note = card.querySelector('small');
      if (/Try it first/i.test(label?.textContent || '') || /No login/i.test(value?.textContent || '')) {
        setText(value, 'Free');
        setText(label, 'Your account');
        setText(note, 'Keeps your assessments saved');
      }
    });
    const teaser = document.querySelector('.buyer-teaser');
    if (teaser) {
      setText(teaser.querySelector('.kicker'), 'Your buying patterns');
      setText(teaser.querySelector('h2'), 'What catches your eye vs what you buy');
      setText(teaser.querySelector('p:not(.kicker)'), 'TruWorth compares the products you assess with the ones you mark as bought.');
      const link = teaser.querySelector('a');
      if (link) setText(link, 'View my patterns');
    }
  }

  function fixInsights() {
    if (page() !== 'insights') return;
    setText(document.querySelector('.page-intro h1'), 'Your buying patterns');
    setText(document.querySelector('.page-intro div > p:last-child'), 'See how the products you consider compare with the products you actually buy.');

    const hero = document.querySelector('.buyer-profile-hero');
    if (hero) {
      setText(hero.querySelector('.kicker'), 'Your buying patterns');
      setText(hero.querySelector('#buyerHeadline'), buyingHeadline());
      const bubbles = [...hero.querySelectorAll('.identity-bubble')];
      if (bubbles[0]) {
        setText(bubbles[0].querySelector('span'), 'What you consider');
        setText(bubbles[0].querySelector('strong'), normalisePattern(bubbles[0].querySelector('strong')?.textContent));
        setText(bubbles[0].querySelector('small'), 'From your saved assessments');
      }
      if (bubbles[1]) {
        setText(bubbles[1].querySelector('span'), 'What you buy');
        setText(bubbles[1].querySelector('strong'), normalisePattern(bubbles[1].querySelector('strong')?.textContent));
        setText(bubbles[1].querySelector('small'), 'From purchases you mark as bought');
      }
    }

    const loading = document.querySelector('.premium-loading');
    setText(loading, 'Building your buying insights…');
    const overlay = document.querySelector('.steam-overlay');
    if (overlay) {
      setText(overlay.querySelector('p'), 'See more from your purchase history.');
      setText(overlay.querySelector('h3'), 'Unlock deeper buying insights');
      setText(overlay.querySelector('span'), 'See financial habits, repeat purchase patterns and personalised guidance.');
    }
    const premiumHead = document.querySelector('.premium-unlocked-head');
    if (premiumHead) {
      setText(premiumHead.querySelector('span'), 'TruWorth+ buying insights');
      const strong = premiumHead.querySelector('strong');
      if (strong) {
        const text = strong.textContent || '';
        const parts = text.split('·').map((x) => x.trim());
        const left = normalisePattern(parts[0]?.replace(/Wants You|What you consider:?/gi, '').trim());
        const right = normalisePattern(parts[1]?.replace(/Real Buyer|What you buy:?/gi, '').trim());
        setText(strong, `What you consider: ${left} · What you buy: ${right}`);
      }
    }
  }

  function fixAccount() {
    if (page() !== 'account' || !user) return;
    const personality = document.querySelector('.profile-personality');
    if (personality) {
      setText(personality.querySelector('.kicker'), 'Buying patterns');
      setText(personality.querySelector('h2'), 'What you consider vs what you buy');
      setText(personality.querySelector('p:not(.kicker)'), buyingHeadline());
      const link = personality.querySelector('a');
      if (link) setText(link, 'View my patterns');
    }
  }

  function fixPlans() {
    if (page() !== 'plans') return;
    setText(document.querySelector('.page-intro div > p:last-child'), 'Use Free for purchase scores. TruWorth+ adds deeper buying insights and unlimited history.');
    document.querySelectorAll('.membership-row').forEach((row) => {
      const name = row.querySelector('.membership-name span')?.textContent?.trim();
      const heading = row.querySelector('.membership-copy h2');
      const copy = row.querySelector('.membership-copy p');
      if (name === 'Free') {
        setText(copy, 'Core assessments, saved history, comparisons and a simple summary of your buying patterns.');
      }
      if (name === 'TruWorth+') {
        setText(heading, 'See deeper buying patterns');
        setText(copy, 'Compare what you consider with what you actually buy, see financial-fit habits and recurring purchase patterns, and keep unlimited saved history.');
      }
    });
  }

  function removePersonaJargon() {
    document.querySelectorAll('main').forEach((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        let text = node.nodeValue || '';
        text = text.replace(/Wants You vs Real Buyer You/g, 'Your buying patterns')
          .replace(/Wants You/g, 'What you consider')
          .replace(/Real Buyer You/g, 'What you buy')
          .replace(/Wants Self/g, 'what you consider')
          .replace(/Real Buyer Me/g, 'what you buy');
        if (text !== node.nodeValue) node.nodeValue = text;
      });
    });
  }

  function apply() {
    if (applying) return;
    applying = true;
    try {
      fixHome();
      fixInsights();
      fixAccount();
      fixPlans();
      removePersonaJargon();
    } finally {
      applying = false;
    }
  }

  const observer = new MutationObserver(() => queueMicrotask(apply));
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener('truworth:release-ready', () => {
    apply();
    [120, 500, 1200, 2500].forEach((delay) => setTimeout(apply, delay));
  }, { once: true });
  if (window.__TRUWORTH_RELEASE_READY__) apply();
})();