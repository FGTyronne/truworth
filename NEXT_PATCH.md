# TruWorth next patch staging

This commit is intentionally not attached to main yet. It stages the next bundled production patch without triggering a Vercel deployment.

Included so far:
- Find a product flow that hands the query to Google Search and brings the chosen page back into TruWorth via URL import.
- Product terminology across the assessor.
- Accessible contextual help stars for ambiguous assessment inputs, usable by hover, keyboard focus and tap.
- Concrete examples for lifetime costs, expected uses, setup/upkeep hours, post-novelty enjoyment, minutes saved per use, value of time and existing alternatives.

Google note: unrestricted Custom Search JSON API access is no longer available to new customers, so this stage uses a zero-cost Google search handoff rather than pretending a deprecated public-web API is available. The UI can later be connected to a licensed search-results provider without changing the assessment flow.
