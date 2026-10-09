(() => {
  let applying = false;

  const setText = (node, text) => {
    if (node && node.textContent !== text) node.textContent = text;
  };

  function cleanHome() {
    if (page() !== 'home') return;

    setText(document.querySelector('.tw-eyebrow'), 'Check before you spend');
    setText(
      document.querySelector('.tw-home-copy > p'),
      'Use TruWorth for anything from headphones and holidays to subscriptions and home upgrades. Add the details, get a score, and see whether the purchase makes sense for you.'
    );

    const trust = document.querySelector('.tw-home-trust');
    if (trust) {
      const wanted = '<span><b>✓</b>No account needed</span><span><b>✓</b>About 2 minutes</span><span><b>✓</b>Clear 0–100 score</span>';
      if (trust.innerHTML !== wanted) trust.innerHTML = wanted;
    }

    document.querySelectorAll('.tw-stat-strip article').forEach((card) => {
      const label = card.querySelector('b')?.textContent?.trim();
      const note = card.querySelector('small');
      if (!note) return;
      const copy = {
        'Assessments': 'Purchases you have assessed',
        'Purchased': 'Items you have bought',
        'Average score': 'Across your saved assessments',
        'Typical check': 'Quick to complete',
        'Clear score': 'Easy to compare',
        'Try it first': 'Save your results if you want'
      }[label];
      if (copy) setText(note, copy);
    });

    document.querySelectorAll('.tw-section-heading h2').forEach((heading) => {
      if (/three quick steps/i.test(heading.textContent || '')) setText(heading, 'Three quick steps.');
    });

    document.querySelectorAll('.tw-step-card').forEach((card) => {
      const title = card.querySelector('strong');
      const copy = card.querySelector('small');
      const current = title?.textContent?.trim();
      if (current === 'Reality-check it' || current === 'Answer a few questions') {
        setText(title, 'Answer a few questions');
        setText(copy, 'Tell us how often you will use it, how much you want it and what alternatives you have.');
      }
      if (current === 'Decide smarter' || current === 'See your result') {
        setText(title, 'See your result');
        setText(copy, 'Get a score and the main reasons behind it.');
      }
    });
  }

  function cleanAssess() {
    if (page() !== 'assess') return;
    const tip = document.querySelector('.tw-reflection-tip small');
    if (tip) setText(tip, 'Would you still want this in 30 days? Be realistic about how much you will actually use it.');
  }

  function cleanResult() {
    if (page() !== 'result') return;
    const intro = document.querySelector('.page-intro div > p:last-child');
    if (intro) setText(intro, 'See your score and the main reasons behind it.');

    document.querySelectorAll('.tw-result-verdict p, .tw-check-list small').forEach((node) => {
      const text = node.textContent || '';
      if (text.includes('The case is solid')) setText(node, 'It scores well overall, with a few things worth checking.');
      else if (text.includes('strong case for spending the money')) setText(node, 'This purchase does not score well based on the details you entered.');
      else if (text.includes('best way to get the outcome')) setText(node, 'Check one similar option before deciding.');
      else if (text.includes('purchase answered itself')) setText(node, 'If you no longer want it tomorrow, you may not need it today.');
      else if (text.includes('value case dramatically')) setText(node, 'Buying used or refurbished may give you better value.');
    });
  }

  function cleanLibrary() {
    if (page() !== 'watchlist') return;
    const subtitle = document.querySelector('.page-intro div > p:last-child');
    if (subtitle) setText(subtitle, 'Every purchase you have saved, in one place.');
  }

  function removeKnownJargon() {
    document.querySelectorAll('main, .site-footer').forEach((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        let text = node.nodeValue || '';
        const replacements = [
          [/Decisions you have pressure-tested/g, 'Purchases you have assessed'],
          [/Every purchase you have pressure-tested/g, 'Every purchase you have saved'],
          [/Pressure-test anything/g, 'Check anything'],
          [/pressure-tested/g, 'assessed'],
          [/pressure-test/g, 'check'],
          [/No ads steering the answer/g, 'Clear 0–100 score'],
          [/helping or hurting the case/g, 'behind the score'],
          [/strengthens or weakens the purchase/g, 'matters most in the score'],
          [/reality-check it/gi, 'answer a few questions'],
          [/reality-check/gi, 'check']
        ];
        replacements.forEach(([pattern, value]) => { text = text.replace(pattern, value); });
        if (text !== node.nodeValue) node.nodeValue = text;
      });
    });
  }

  function apply() {
    if (applying) return;
    applying = true;
    try {
      cleanHome();
      cleanAssess();
      cleanResult();
      cleanLibrary();
      removeKnownJargon();
    } finally {
      applying = false;
    }
  }

  const observer = new MutationObserver(() => queueMicrotask(apply));
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  window.addEventListener('truworth:release-ready', apply, { once: true });
  if (window.__TRUWORTH_RELEASE_READY__) apply();
})();
