(() => {
  function cleanConsumerCopy() {
    document.querySelectorAll('.path-link small').forEach((node) => {
      if (/automatic page import|cloud saving/i.test(node.textContent || '')) {
        node.textContent = 'Paste the link and bring the product straight into your assessment.';
      }
    });

    const importStatus = document.getElementById('importStatus');
    if (importStatus && /Sign in to import details automatically/i.test(importStatus.textContent || '')) {
      importStatus.innerHTML = 'Paste the link and fill in anything TruWorth cannot detect. <a href="account.html">Sign in</a> when you want to keep your history across devices.';
    }
  }

  const observer = new MutationObserver(() => cleanConsumerCopy());
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }), { once: true });

  cleanConsumerCopy();
})();
