(() => {
  'use strict';

  const isPlusMember = () => Boolean(user && subscription?.tier === 'plus' && ['active','trialing'].includes(String(subscription?.status || '')));

  function originalCard(title, tag, copy, bullets, locked) {
    return `<article class="tw36-benefit-card ${locked ? 'locked' : ''}"><div class="tw36-benefit-content"><span class="tag">${esc(tag)}</span><h3>${esc(title)}</h3><p>${esc(copy)}</p><ul>${bullets.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>${locked ? '<div class="tw36-card-lock"><strong>Available with TruWorth+</strong></div>' : ''}</article>`;
  }

  function bookCard({ title, subtitle, focus, href, format }) {
    return `<article class="tw36-book-card"><div class="tw36-book-spine" aria-hidden="true"><span>THE FINANCIAL<br>EDUCATION SERIES</span><strong>${esc(title.split(':')[0])}</strong><small>Tyronne T Ramella</small></div><div class="tw36-book-copy"><span class="tag">Optional reading · ${esc(format)}</span><h3>${esc(title)}</h3><p>${esc(subtitle)}</p><strong>Useful if you want to go further</strong><p>${esc(focus)}</p><a class="secondary-button" href="${esc(href)}" target="_blank" rel="noopener noreferrer">View on Amazon UK ↗</a></div></article>`;
  }

  window.benefitsPage = function benefitsPageV37() {
    const plus = isPlusMember();

    layout('Member Benefits', 'Useful extras for better buying and better financial habits.', `
      <section class="tw36-benefits-hero">
        <div>
          <p class="kicker">Member Benefits</p>
          <h2>Useful extras, <em>when they’re useful.</em></h2>
          <p>Once you have made the decision, come here for practical tools, optional reading and member offers as new partners join TruWorth.</p>
        </div>
        <span class="tw36-plan-pill">${plus ? 'TruWorth+ unlocked' : 'Preview mode'}</span>
      </section>

      <section class="tw36-return-callout">
        <div><span class="tw36-live-dot" aria-hidden="true"></span><div><strong>Check back regularly.</strong><p>New offers will be added as partnerships go live. We will add useful benefits rather than fill the page for the sake of it.</p></div></div>
        <a href="#partner-benefits">See partner benefits ↓</a>
      </section>

      <section class="tw36-section">
        <div class="tw36-section-head"><div><p class="kicker">TruWorth Originals</p><h2>Simple tools you can actually use</h2></div><p>Short exercises for before and after a purchase.</p></div>
        <div class="tw36-benefit-grid">
          ${originalCard('24-hour Purchase Reset','Before you buy','Useful when something suddenly feels urgent.',['Write down why you want it.','Name the cheaper alternative.','Wait 24 hours.','Run the check again.'],!plus)}
          ${originalCard('Opportunity Cost Check','Money','See what else the same money could do for you.',['Compare the price with your free cash.','Name the saving or debt goal it delays.','Decide whether the trade-off is still worth it.'],!plus)}
          ${originalCard('The Upgrade Test','Upgrades','Work out whether you need the upgrade or simply want the newest version.',['What is actually wrong with the current one?','What improves in a measurable way?','How long will you keep the replacement?'],!plus)}
          ${originalCard('Post-Purchase Review','After you buy','Check whether the purchase delivered what you expected.',['Record how much you really use it.','Update how much you actually enjoy it.','Use what you learn next time.'],!plus)}
        </div>
      </section>

      <section class="tw36-section tw36-books-section">
        <div class="tw36-section-head"><div><p class="kicker">Financial literacy</p><h2>Want to go deeper?</h2></div><p>Two practical books are available on Amazon if you want to build your financial knowledge beyond a single purchase.</p></div>
        <div class="tw36-books-grid">
          ${bookCard({title:'Money Matters: The Financial Education You Should Have Been Taught',subtitle:'A practical introduction to personal finance and the everyday choices that shape your financial position.',focus:'Useful for building a stronger foundation around saving, spending and financial decisions.',href:'https://www.amazon.co.uk/dp/B0HJNJSSWJ',format:'Kindle / Amazon'})}
          ${bookCard({title:'The Cost of Owing: How to Clear Your Debt, Rebuild Your Finances and Reclaim Your Income',subtitle:'A practical guide to understanding debt, choosing a repayment approach and creating more room in your income.',focus:'Useful if debt repayments are limiting what you can save, spend or do with your money each month.',href:'https://www.amazon.co.uk/dp/B0HLDL4PVJ',format:'Amazon'})}
        </div>
        <p class="tw36-books-disclosure">Both books are written by TruWorth founder Tyronne T Ramella and are sold separately through Amazon. They are completely optional.</p>
      </section>

      <section id="partner-benefits" class="tw36-section tw36-partner-section">
        <div class="tw36-section-head"><div><p class="kicker">Partner Benefits</p><h2>If you decide to buy, check here before you pay</h2></div><p>New offers will appear as partnerships become available.</p></div>
        <div class="tw36-partner-state">
          <div>
            <span class="tag">What each offer will show</span>
            <h3>The useful details, upfront.</h3>
            <div class="tw36-benefit-standard">
              <div><strong>What you get</strong><span>The discount, perk or added service.</span></div>
              <div><strong>Who can use it</strong><span>Membership level, location and eligibility.</span></div>
              <div><strong>When it ends</strong><span>Dates or availability, where relevant.</span></div>
              <div><strong>How to use it</strong><span>Code, link or simple instructions.</span></div>
            </div>
          </div>
          <aside class="tw36-checkback">
            <span>Growing over time</span>
            <strong>More benefits will appear as new partnerships go live.</strong>
            <p>${plus ? 'As a TruWorth+ member, you will be able to use eligible member offers when they are available.' : 'You can browse what is available; some offers may be reserved for TruWorth+ members.'}</p>
            <div class="tw36-partner-categories"><span>Technology</span><span>Repair & trade-in</span><span>Home</span><span>Travel</span><span>Fitness</span><span>Lifestyle</span><span>Learning</span></div>
            ${plus ? '' : '<a class="primary-button" href="plans.html">See TruWorth+</a>'}
          </aside>
        </div>
      </section>

      <p class="tw36-benefits-footnote">Partner offers may have their own terms. See our <a href="commercial-disclosure.html">commercial disclosure</a> for details.</p>
    `, { kicker: 'TruWorth+' });
  };
})();
