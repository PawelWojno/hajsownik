---
starter_id: 10x-astro-starter
package_manager: npm
project_name: hajsownik
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

Hajsownik is a small-scale, solo-owned household budgeting web app with a tight 5-week after-hours MVP timeline and a hard requirement for email+password auth with email verification and password reset. The recommended default for `(web, js)`, 10x Astro Starter, clears all four agent-friendly gates and bundles auth, a PostgreSQL database, and edge deployment in one pinned stack — matching the PRD's auth-heavy, no-payments/no-realtime/no-AI feature profile without assembling those pieces separately. Its bootstrapper confidence is first-class (registered CLI, not yet battle-tested end-to-end), so scaffolding should mostly be smooth with occasional manual steps. Deployment defaults to Cloudflare Pages (the starter's own default) and CI runs on GitHub Actions with auto-deploy-on-merge, both accepted as the starter's standard shape for a solo build.
