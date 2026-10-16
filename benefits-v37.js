(() => {
  'use strict';

  const isPlusMember = () => Boolean(user && subscription?.tier === 'plus' && ['active','trialing'].includes(String(subscription?.status || '')));

  function originalCard(title, tag, copy, bullets, locked) {
    return `<article class="tw36-benefit-card ${locked ? 'locked' : ''}"><div class="tw36-benefit-content"><span class="tag">${esc(tag)}</span><h3>${esc(title)}</h3><p>${esc(copy)}</p><ul>${bullets.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>${locked ? `<div class="tw36-card-lock"><strong>TruWorth+ toolkit</strong><span>Available with TruWorth+.</span></div>` : ''}</article>`;
  }

  function bookCard({ title, subtitle, focus, href, format }) {
    return `<article class="tw36-book-card"><div class="tw36-book-spine" aria-hidden="true"><span>THE FINANCIAL<br>EDUCATION SERIES</span><strong>${esc(title.split(':')[0])}</strong><small>Tyronne T Ramella</small></div><div class="tw36-book-copy"><span class="tag">Optional reading · ${esc(format)}</span><h3>${esc(title)}</h3><p>${esc(subtitle)}</p><strong>Useful if you want to go further</strong><p>${esc(focus)}</p><a class="secondary-button" href="${esc(href)}" target="_blank" rel="noopener noreferrer">View on Amazon UK ↗</a></div></article>`;
  }

  window.benefitsPage = function benefitsPageV37() {
    const plus = isPlusMember();
    layout('Member Benefits', 'Useful extras for better buying, better financial habits and more value from your membership.', `
      <section class="tw36-benefits-hero">
        <div><p class="kicker">Member Benefits</p><h2>More value, <em>as TruWorth grows.</em></h2><p>Use the tools, browse the learning resources and come back for new member offers as we add partners.</p></div>
        <span class="tw36-plan-pill">${plus ? 'TruWorth+ unlocked' : 'Preview mode'}</span>
      </section>

      <section class="tw36-return-callout"><div><span class="tw36-live-dot" aria-hidden="true"></span><div><strong>Check back regularly.</strong><p>New benefits will be added as partnerships go live. We would rather add useful offers gradually than fill the page with deals nobody needs.</p></div></div><a href="#partner-benefits">See partner benefits ↓</a></section>

      <section class="tw36-section"><div class="tw36-section-head"><div><p class="kicker">TruWorth Originals</p><h2>Practical tools for the next decision</h2></div><p>Short exercises you can use before and after a purchase.</p></div><div class="tw36-benefit-grid">
        ${originalCard('24-hour Purchase Reset','Decision discipline','Useful when a purchase feels urgent, exciting or difficult to put down.',['State the problem the purchase solves.','Write down the cheaper alternative.','Wait 24 hours for a discretionary purchase.','Re-run TruWorth and compare the result.'],!plus)}
        ${originalCard('Opportunity Cost Check','Financial literacy','See what else the same money could do for you.',['Compare the price with your monthly free cash.','Name the saving or debt goal the purchase delays.','Ask whether the purchase is still worth that trade-off.'],!plus)}
        ${originalCard('The Upgrade Test','Better buying','Work out whether you need an upgrade or simply want the latest version.',['What is actually holding you back today?','What improves in a measurable way?','How long will you keep the new one?','Would you still upgrade if nobody else saw it?'],!plus)}
        ${originalCard('Decision Discipline Playbook','Behaviour','Use your Decision Discipline setting deliberately instead of changing it until you get the answer you want.',['1–3 gives lifestyle and enjoyment more room.','4–7 balances enjoyment with value.','8–10 pushes harder against avoidable spending.'],!plus)}
        ${originalCard('Value-For-Money Stress Test','Maths','Check whether the purchase still makes sense if your first assumptions were too optimistic.',['Estimate lifetime use.','Include upkeep and accessories.','Halve expected use.','Lower expected enjoyment and check again.'],!plus)}
        ${originalCard('Post-Purchase Review','Learning loop','Look back after the novelty wears off and see whether the purchase delivered what you expected.',['Record actual use.','Update how much you really enjoy it.','Note any surprise costs or hassle.','Use what you learned on the next assessment.'],!plus)}
      </div></section>

      <section class="tw36-section tw36-books-section"><div class="tw36-section-head"><div><p class="kicker">Financial literacy</p><h2>Want to go deeper?</h2></div><p>Two practical books are available on Amazon if you want to build your financial knowledge beyond individual purchase decisions.</p></div>
        <div class="tw36-books-grid">
          ${bookCard({title:'Money Matters: The Financial Education You Should Have Been Taught',subtitle:'A practical introduction to personal finance and the everyday decisions that shape your financial position.',focus:'Money Matters steps back from a single purchase and looks at the wider habits, knowledge and choices behind your finances.',href:'https://www.amazon.co.uk/dp/B0HJNJSSWJ',format:'Kindle / Amazon'})}
          ${bookCard({title:'The Cost of Owing: How to Clear Your Debt, Rebuild Your Finances and Reclaim Your Income',subtitle:'A practical guide to understanding debt, choosing a repayment approach and creating more room in your income.',focus:'Useful if debt repayments are limiting what you can save, spend or do with your money each month.',href:'https://www.amazon.co.uk/dp/B0HLDL4PVJ',format:'Amazon'})}
        </div>
        <p class="tw36-books-disclosure">Both books are written by TruWorth founder Tyronne T Ramella and are sold separately through Amazon. They are completely optional.</p>
      </section>

      <section id="partner-benefits" class="tw36-section tw36-partner-section"><div class="tw36-section-head"><div><p class="kicker">Partner Benefits</p><h2>New offers will appear here as we add partners</h2></div><p>If there is nothing useful for you today, check back. This section will grow as new partnerships become available.</p></div>
        <div class="tw36-partner-state"><div><span class="tag">What you will see</span><h3>Clear offers, with the important details upfront.</h3><p>Each live offer will tell you what you get and how to use it.</p><div class="tw36-benefit-standard"><div><strong>The benefit</strong><span>The discount, perk or added service.</span></div><div><strong>Who can use it</strong><span>Membership level, location and any eligibility rules.</span></div><div><strong>How long it lasts</strong><span>Dates or availability, where relevant.</span></div><div><strong>How to redeem it</strong><span>Code, link or simple instructions.</span></div><div><strong>Partner details</strong><span>Who the offer comes from.</span></div><div><strong>Anything important</strong><span>Key terms you should know before using it.</span></div></div></div>
          <aside class="tw36-checkback"><span>Coming over time</span><strong>Benefits will be added as partnerships go live.</strong><p>${plus ? 'As a TruWorth+ member, you will be able to use eligible member offers as they become available.' : 'You can browse what is available; some offers may be reserved for TruWorth+ members.'}</p><div class="tw36-partner-categories"><span>Technology</span><span>Repair & trade-in</span><span>Home</span><span>Travel</span><span>Fitness</span><span>Lifestyle</span><span>Learning</span></div>${plus ? '' : '<a class="primary-button" href="plans.html">See TruWorth+</a>'}</aside>
        </div>
      </section>

      <p class="tw36-benefits-footnote">Partner offers may have their own terms. See our <a href="commercial-disclosure.html">commercial disclosure</a> for details.</p>
    `, { kicker: 'TruWorth+' });
  };
})();
