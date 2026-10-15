# TruWorth historical patch note

This file records work that has already been merged into `main`. It is not a current release gate or staging branch.

Implemented:
- Product discovery flow that hands a query to Google Search and brings the chosen product page back into TruWorth via URL import.
- Product terminology across the assessor.
- Accessible contextual help for ambiguous assessment inputs, usable by hover, keyboard focus and tap.
- Concrete examples for lifetime costs, expected uses, setup/upkeep effort, post-novelty enjoyment, minutes saved per use, value of time and existing alternatives.

Current deployment model:
- GitHub `main` is the source of truth.
- Render is the canonical production web host.
- The former Vercel deployment exists only for permanent redirects to Render during migration.

Search integration note:
The current discovery flow deliberately uses a zero-cost Google search handoff rather than relying on an unrestricted public-web search API. A licensed search-results provider can replace that handoff later without changing the assessment model.
