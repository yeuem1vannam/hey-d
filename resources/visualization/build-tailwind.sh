#!/usr/bin/env bash
# Rebuild resources/visualization/tailwind.css from components.js + examples/gallery.html.
# Produces pruned output containing only utility classes actually used.
#
# Requires: npx tailwindcss (Tailwind CLI). Install via `npm install -D tailwindcss`
# or similar. No persistent Tailwind config or build is stored long-term — this
# script regenerates tailwind.css on demand.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Generate a minimal config on the fly — content paths are relative to this dir.
CONFIG=".tailwind.config.tmp.js"
cat > "$CONFIG" <<'EOF'
module.exports = {
  content: [
    './components.js',
    './examples/**/*.html',
  ],
  theme: { extend: {} },
};
EOF

# Ensure input.css exists (minimal, uses Tailwind's @tailwind directives).
INPUT=".tailwind.input.tmp.css"
cat > "$INPUT" <<'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF

# Run the CLI. Use --minify for production-grade output.
npx tailwindcss -c "$CONFIG" -i "$INPUT" -o tailwind.css --minify

# Clean up temp files.
rm -f "$CONFIG" "$INPUT"

echo "tailwind.css rebuilt: $(wc -c < tailwind.css | tr -d ' ') bytes"
