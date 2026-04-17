#!/usr/bin/env bash
# Test: external-researcher agent definition
# Verifies the agent is discoverable, its scope boundary holds, and its report contract is described.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

echo "=== Test: external-researcher agent ==="
echo ""

# Test 1: Agent is discoverable
echo "Test 1: Agent discovery..."

output=$(run_claude "Describe the 'external-researcher' agent defined in this repo (agents/external-researcher.md). What does it research and what model does it use?" 30)

if assert_contains "$output" "external-researcher" "Agent name recognized"; then : ; else exit 1; fi
if assert_contains "$output" "sonnet\|Sonnet" "Model is Sonnet"; then : ; else exit 1; fi
if assert_contains "$output" "library\|librari\|framework\|documentation\|API\|standard" "Role mentions libraries/docs/APIs"; then : ; else exit 1; fi

echo ""

# Test 2: Scope boundary — external = not user's code
echo "Test 2: Scope boundary (external vs user code)..."

output=$(run_claude "What is the scope boundary of the external-researcher agent? What does it NOT answer questions about?" 30)

if assert_contains "$output" "user.*code\|own code\|not.*user\|user's own" "Boundary: not the user's code"; then : ; else exit 1; fi
if assert_contains "$output" "Explore\|explore" "Redirects codebase questions to Explore"; then : ; else exit 1; fi

echo ""

# Test 3: Tool access — can read node_modules, cannot edit/write
echo "Test 3: Tool access..."

output=$(run_claude "What tools can the external-researcher agent use? Specifically, can it read node_modules source? Can it write or edit files?" 30)

if assert_contains "$output" "WebSearch\|WebFetch\|web.*search" "Can search web"; then : ; else exit 1; fi
if assert_contains "$output" "Read\|read.*files" "Can read files"; then : ; else exit 1; fi
if assert_contains "$output" "node_modules\|third-party\|library.*source\|vendor" "Can read third-party source"; then : ; else exit 1; fi
if assert_contains "$output" "[Cc]annot.*[Ee]dit\|[Cc]annot.*[Ww]rite\|no.*[Ee]dit\|no.*[Ww]rite\|[Rr]ead-only" "Cannot edit/write"; then : ; else exit 1; fi

echo ""

# Test 4: Report format and confidence signal
echo "Test 4: Report format..."

output=$(run_claude "What sections appear in every report from the external-researcher agent? What is the purpose of the CONFIDENCE signal?" 30)

if assert_contains "$output" "ANSWER\|answer" "Report has ANSWER"; then : ; else exit 1; fi
if assert_contains "$output" "CONFIDENCE\|confidence" "Report has CONFIDENCE"; then : ; else exit 1; fi
if assert_contains "$output" "SOURCES\|sources" "Report has SOURCES"; then : ; else exit 1; fi
if assert_contains "$output" "HIGH.*MEDIUM.*LOW\|HIGH\|MEDIUM\|LOW" "Confidence has levels HIGH/MEDIUM/LOW"; then : ; else exit 1; fi

echo ""

# Test 5: Synthesis discipline — ≤3 paragraphs
echo "Test 5: Synthesis discipline..."

output=$(run_claude "Does the external-researcher agent write long-form reports? What's the cap on answer length?" 30)

if assert_contains "$output" "3 paragraph\|three paragraph\|short\|compress\|brief\|concise" "Short-form answer discipline"; then : ; else exit 1; fi

echo ""

# Test 6: Behavior on conflicting sources
echo "Test 6: Discrepancy handling..."

output=$(run_claude "If the external-researcher finds that library documentation says X but the actual library source code says Y, what does it do? Does it silently pick one?" 30)

if assert_contains "$output" "[Nn]ot.*silent\|[Rr]eport.*both\|name.*discrepan\|CAVEATS\|caveats\|name.*conflict" "Reports discrepancies, not silent pick"; then : ; else exit 1; fi

echo ""
echo "=== All external-researcher tests passed ==="
