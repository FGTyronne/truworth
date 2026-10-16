(() => {
  'use strict';

  const boughtRecords = () => records.filter((record) => record.status === 'purchased' || purchases?.[record.id]);

  function motiveLabel(motive) {
    if (motive === 'need') return 'practical';
    if (motive === 'joy') return 'enjoyment-led';
    if (motive === 'image') return 'impulse / image-led';
    return 'mixed';
  }

  function dominantMotive(items) {
    const counts = items.reduce((acc, record) => {
      const key = record.inputs?.motive || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  if (typeof login === 'function') {
    login = async function loginV23(event) {
      event.preventDefault();
      const message = $('loginMessage');
      if (message) message.textContent = '';
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: $('loginEmail').value.trim(),
        password: $('loginPassword').value
      });
      if (error) {
        if (message) {
          message.textContent = error.message;
          message.className = 'form-message error';
        }
        return;
      }
      await syncGuestRecords();
      const returnTo = sessionStorage.getItem('truworth-return-to') || 'index.html';
      sessionStorage.removeItem('truworth-return-to');
      location.href = returnTo;
    };
  }

  homePage = function homePageV23() {
    const ranked = sortedRecords().slice(0, 4);
    const bought = boughtRecords();
    const conversion = records.length ? Math.round((bought.length / records.length) * 100) : 0;
    const motive = dominantMotive(records);

    layout('', '', `
      <section class="home-stage">
        <div class="home-copy">
          <span class="home-pill">Before you spend</span>
          <h1>Thinking about buying it?<br><em>Check if it’s worth it for you.</em></h1>
          <p>TruWorth looks at the price, how much you expect to use it, how much you want it and the alternatives. Then it gives you a clear view before you spend.</p>
          <div class="home-primary-actions">
            <a class="primary-button hero-action" href="assess.html">Check a purchase</a>
            <a class="secondary-button" href="assess.html?mode=link">Paste a product link</a>
          </div>
          <div class="home-trust"><span>3 guest checks a day</span><span>About 2 minutes</span><span>Free account: unlimited checks</span></div>
        </div>
        <div class="home-play-card" aria-hidden="true">
          <div class="play-orbit orbit-one"></div><div class="play-orbit orbit-two"></div>
          <div class="play-score"><span>TruWorth</span><strong>82</strong><small>Worth a closer look</small></div>
          <div class="play-chip chip-one">Will you use it?</div>
          <div class="play-chip chip-two">Worth the price?</div>
          <div class="play-chip chip-three">Still want it later?</div>
        </div>
      </section>

      <section class="home-paths" aria-label="How TruWorth helps over time">
        <div class="home-path path-assess"><span>01</span><strong>Check before you buy</strong><small>Put the purchase through TruWorth before the money leaves your account.</small></div>
        <div class="home-path path-search"><span>02</span><strong>Record what you did</strong><small>If you buy it, mark it bought. If you leave it, leave it.</small></div>
        <div class="home-path path-link"><span>03</span><strong>See your patterns</strong><small>Over time, your history shows what you consider, what you buy and what actually works for you.</small></div>
      </section>

      ${records.length ? `
        <section class="buyer-teaser">
          <div>
            <p class="kicker">Your history</p>
            <h2>${records.length} checked · ${bought.length} bought${motive ? ` · mostly ${motiveLabel(motive)}` : ''}</h2>
            <p>${bought.length ? `${conversion}% of the products you have checked are recorded as purchases.` : 'You have started building a useful record of the things you consider.'}</p>
          </div>
          <a class="secondary-button" href="insights.html">See my insights</a>
        </section>` : `
        <section class="buyer-teaser empty-profile">
          <div>
            <p class="kicker">More useful over time</p>
            <h2>One check helps now. Your history helps next time.</h2>
            <p>Record what you buy and, later, whether it lived up to expectations. That is where the useful patterns start.</p>
          </div>
        </section>`}

      <section class="home-library">
        <div class="home-library-head"><h2>${records.length ? 'Recent checks' : 'Start with something you are genuinely considering'}</h2>${records.length ? '<a href="watchlist.html">View saved</a>' : ''}</div>
        ${records.length ? `<div class="product-list">${ranked.map((record, index) => productRow(record, index + 1)).join('')}</div>` : `<div class="home-empty"><p>A phone. Trainers. Headphones. A handbag. A coffee machine. Pick something you are actually thinking about buying.</p><a class="text-button" href="assess.html">Check your first purchase →</a></div>`}
      </section>
    `, { compact: true });
  };

  const baseResultPage = resultPage;
  resultPage = function resultPageV23() {
    baseResultPage();
    const record = findRecord();
    const target = document.querySelector('.result-layout');
    if (!record || !target || document.getElementById('tw23NextStep')) return;

    const bought = record.status === 'purchased' || Boolean(purchases?.[record.id]);
    const section = document.createElement('section');
    section.id = 'tw23NextStep';
    section.className = 'tw-access-note';
    section.innerHTML = bought
      ? '<strong>Keep the loop going.</strong> Come back later and update how much you actually used and enjoyed it. That makes your Insights more useful.'
      : '<strong>If you buy it, mark it bought.</strong> Later, tell TruWorth how it actually turned out. Your history becomes more useful with every real outcome.';
    target.insertAdjacentElement('afterend', section);
  };

  const basePlansPage = plansPage;
  plansPage = function plansPageV23() {
    basePlansPage();

    const intro = document.querySelector('.page-intro div > p:last-child');
    if (intro) intro.textContent = 'Use Free to check purchases. TruWorth+ turns those checks into a deeper picture of how you buy.';

    document.querySelectorAll('.membership-row').forEach((row) => {
      const name = row.querySelector('.membership-name span')?.textContent?.trim();
      const heading = row.querySelector('.membership-copy h2');
      const copy = row.querySelector('.membership-copy p');
      if (name === 'Free') {
        if (heading) heading.textContent = 'Make better purchase decisions';
        if (copy) copy.textContent = 'Unlimited assessments, product comparisons and up to 5 saved products at a time.';
      }
      if (name === 'TruWorth+') {
        if (heading) heading.textContent = 'Build a better buying history';
        if (copy) copy.textContent = 'Unlimited saved history, deeper insights, financial context and growing Member Benefits.';
      }
    });
  };
})();
