(() => {
  // Prevent address/phone/legal copy on packaging being offered as the product name.
  const knownBrands = /\b(vaseline|nivea|carmex|blistex|burt'?s bees|eos|dove|neutrogena|cerave|olay|garnier|l'?oreal|maybelline|gillette|oral-b|colgate|pantene|dyson|philips|bosch|apple|samsung|sony|bose|jbl|nike|adidas|lego)\b/i;
  const contactNoise = /\b(tel|telephone|phone|fax|www|https?|email|e-mail|address|street|road|avenue|boulevard|postcode|postal|customer service|consumer care|puh\/?tel)\b|@|\b\d{4,}\s+\d{3,}\b/i;

  function clean(root = document) {
    root.querySelectorAll('.snap-match-head').forEach((head) => {
      const heading = head.querySelector('strong')?.textContent?.trim() || '';
      if (heading !== 'Label read from the photo') return;
      const list = head.nextElementSibling;
      if (!list?.classList.contains('snap-match-list')) return;
      const card = list.querySelector('.snap-match');
      if (!card) return;
      const title = card.querySelector('strong')?.textContent?.trim() || '';
      const meta = card.querySelector('small')?.textContent || '';
      const confidence = Number((meta.match(/(\d+)%/) || [])[1] || 0);
      const digitCount = (title.match(/\d/g) || []).length;
      const letterCount = (title.match(/[A-Za-z]/g) || []).length;
      const digitHeavy = digitCount >= 5 && digitCount > letterCount * 0.35;
      const lowUnbranded = confidence < 65 && !knownBrands.test(title);
      if (!(contactNoise.test(title) || digitHeavy || lowUnbranded)) return;

      head.remove();
      list.remove();
      const cardRoot = root.closest?.('[data-snap-card]') || document.querySelector('[data-snap-card]');
      const status = cardRoot?.querySelector('.snap-status');
      if (status && !/barcode matched/i.test(status.textContent || '')) {
        status.textContent = 'No reliable product name was found in the small print. Confirm a barcode match or product type below.';
      }
    });
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.('.snap-match-head, .snap-match-list, .snap-candidates') || node.querySelector?.('.snap-match-head')) clean(node.closest?.('[data-snap-card]') || node);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();