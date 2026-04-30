# Roadmap: Example — Auth Rewrite

Migrate from session-cookie auth to JWT-based stateless auth across the API and admin dashboard, preserving sign-in/sign-out UX and adding a feature flag for staged rollout.

## Tasks

```yaml
tasks:
  - id: 1
    title: "Add JWT verification middleware and types"
    deps: []
    status: pending
  - id: 2
    title: "Migrate session store to Redis"
    deps: [1]
    status: pending
  - id: 3
    title: "Wire feature flag for staged rollout to 10% traffic"
    deps: [1, 2]
    status: pending
```
