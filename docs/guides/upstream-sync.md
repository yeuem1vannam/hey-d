# Upstream Sync Guide

This fork (`yeuem1vannam/hey-d`) tracks upstream `obra/superpowers` while preserving local customizations (skill renames, added skills, branding, configs). Use this guide whenever upstream ships a new release and you want to pull in the relevant changes.

---

## Prerequisites

**One-time setup:** Add the upstream remote (read-only is fine).

```bash
git remote add upstream https://github.com/obra/superpowers.git
git fetch upstream --tags
```

Verify:

```bash
git remote -v                                # should show both origin and upstream
git ls-remote --tags upstream | tail -5      # latest upstream tags
```

---

## Sync Workflow

### 1. Identify versions

Determine the **base** (the last upstream version we synced to) and the **target** (the new upstream release).

```bash
./scripts/bump-version.sh --check            # our current version (stripped of -d.N suffix = base)
git tag --sort=-v:refname | grep -v -- '-d\.' | head -3   # upstream tags we've fetched
```

Example: we're on `5.0.6-d.1`, upstream just released `v5.0.7` → base is `v5.0.6`, target is `v5.0.7`.

### 2. Scope the diff

Always split the diff by area so each sync commit stays focused.

```bash
# Skills only
git diff --stat v<BASE>..v<TARGET> -- skills/

# Everything else
git diff --stat v<BASE>..v<TARGET> -- . ':!skills/'
```

For every changed file, check whether our fork has diverged from the base. If yes, the port is manual — don't blindly apply.

```bash
# Check our drift from the base
git diff v<BASE>..HEAD -- <path>

# Read upstream's new version
git show v<TARGET>:<path>
```

### 3. Plan the commits

One commit per logical sync area. Typical scopes:

| Scope | Example |
|-------|---------|
| `sync(skills)` | Skill content changes |
| `sync(hooks)` | `hooks/session-start` changes |
| `sync(opencode)` | `.opencode/plugins/hey-d.js` changes |
| `sync(scripts)` | Tooling like `bump-version.sh` |
| `sync(tests)` | Test infrastructure updates |

**Non-sync changes** (our own features, not from upstream) keep their regular types: `feat`, `fix`, `refactor`, etc. Never mix sync and non-sync changes in the same commit — history should make it trivial to answer "what came from upstream v5.0.7?"

### 4. Apply each sync commit

For each file in scope:

- **Clean port** (our file is unchanged from base): copy upstream's new version directly.
  ```bash
  git show v<TARGET>:<path> > <path>
  ```
- **Manual port** (our file has customizations): read upstream's diff, apply the equivalent edit to our file, preserving our customizations. Test after every port where possible (e.g., `node --check` for JS, run the script for shell).

Commit message format:

```
sync(<scope>): <short summary> from upstream v<TARGET>

Upstream: obra/superpowers@v<TARGET> — <path>

<What changed and why. Reference upstream issue numbers if they drove the change.>

Co-authored-by: <Model> <ai@botfi.dev>
```

### 5. Release

After all sync commits land, release a mirror version.

**Naming convention:** `<upstream-version>-d.<N>` where:
- `<upstream-version>` matches the upstream tag without the `v` prefix (e.g. `5.0.7`)
- `d` = hey-d fork marker (replaces the older `-local.N` convention)
- `<N>` starts at `1` for a fresh upstream version; bump to `2`, `3`... for subsequent fork-only releases against the same upstream base.

```bash
./scripts/bump-version.sh 5.0.7-d.1
git add .claude-plugin/ .cursor-plugin/ gemini-extension.json package.json
git commit -m "chore: release 5.0.7-d.1"
git tag 5.0.7-d.1
```

The bump script updates all 5 declared files atomically and audits for undeclared occurrences. Always run it — don't edit version fields by hand.

### 6. Push (when ready)

```bash
git push origin hey-d
git push origin 5.0.7-d.1
```

---

## Commit History Example

Here's a reference sync (hey-d `5.0.6-local.2` → `5.0.7-d.1`, upstream `v5.0.6` → `v5.0.7`):

```
53ccb57 chore: release 5.0.7-d.1
29e634b sync(scripts): add bump-version.sh tooling from upstream v5.0.7
d773563 sync(opencode): port chat transform fix from upstream v5.0.7
0bbac9f sync(hooks): port Copilot CLI session-start format from upstream v5.0.7
26dbe45 sync(skills): port Copilot CLI support from upstream v5.0.7
```

Grep for `sync(` in history to see every upstream port; grep for `chore: release` to see every mirror release.

---

## When to Skip Changes from Upstream

Not every upstream change needs to come over. Skip if:

- It reverts or undoes something we deliberately customized (e.g., upstream removes a skill we rely on differently)
- It's release-engineering noise specific to upstream's release process (e.g., CHANGELOG.md entries, their own release notes)
- It touches a file we've fully rewritten for our fork

When skipping, **note it in the release commit body** so future maintainers see the decision:

```
chore: release 5.0.7-d.1

Intentionally skipped from v5.0.7:
- RELEASE-NOTES.md additions (our fork keeps its own)
- tests/opencode/setup.sh (our test setup has diverged)
```

---

## Troubleshooting

**Version drift detected by `--check`:** Run `./scripts/bump-version.sh <current-version>` to force-sync all declared files, then commit.

**Undeclared file contains version string (from `--audit`):** Either add the file to `.version-bump.json` if it should be bumped, or add the path to `audit.exclude` if it shouldn't.

**`node --check` fails after an OpenCode plugin port:** Re-read the upstream diff carefully — transform hooks are named exactly (`experimental.chat.messages.transform` is different from `...system.transform`), and a typo breaks the plugin silently.

**Upstream renamed a file we rely on:** Keep our name. Port the content changes into our renamed file manually. Document the rename in the commit body so the link back to upstream is discoverable.
