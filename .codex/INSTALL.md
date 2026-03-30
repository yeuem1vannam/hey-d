# Installing Hey D for Codex

Enable hey-d skills in Codex via native skill discovery. Just clone and symlink.

## Prerequisites

- Git

## Installation

1. **Clone the hey-d repository:**
   ```bash
   git clone https://github.com/obra/hey-d.git ~/.codex/hey-d
   ```

2. **Create the skills symlink:**
   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/hey-d/skills ~/.agents/skills/hey-d
   ```

   **Windows (PowerShell):**
   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
   cmd /c mklink /J "$env:USERPROFILE\.agents\skills\hey-d" "$env:USERPROFILE\.codex\hey-d\skills"
   ```

3. **Restart Codex** (quit and relaunch the CLI) to discover the skills.

## Migrating from old bootstrap

If you installed hey-d before native skill discovery, you need to:

1. **Update the repo:**
   ```bash
   cd ~/.codex/hey-d && git pull
   ```

2. **Create the skills symlink** (step 2 above) — this is the new discovery mechanism.

3. **Remove the old bootstrap block** from `~/.codex/AGENTS.md` — any block referencing `hey-d-codex bootstrap` is no longer needed.

4. **Restart Codex.**

## Verify

```bash
ls -la ~/.agents/skills/hey-d
```

You should see a symlink (or junction on Windows) pointing to your hey-d skills directory.

## Updating

```bash
cd ~/.codex/hey-d && git pull
```

Skills update instantly through the symlink.

## Uninstalling

```bash
rm ~/.agents/skills/hey-d
```

Optionally delete the clone: `rm -rf ~/.codex/hey-d`.
