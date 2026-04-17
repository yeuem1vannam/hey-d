#!/usr/bin/env bash
# Test: completion-verifier agent definition
# Verifies the agent is discoverable and its contract is correctly described.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

echo "=== Test: completion-verifier agent ==="
echo ""

# Test 1: Agent is discoverable and correctly identified
echo "Test 1: Agent discovery..."

output=$(run_claude "Describe the 'completion-verifier' agent defined in this repo (agents/completion-verifier.md). What is its role and what model does it use?" 30)

if assert_contains "$output" "completion-verifier" "Agent name recognized"; then : ; else exit 1; fi
if assert_contains "$output" "sonnet\|Sonnet" "Model is Sonnet"; then : ; else exit 1; fi
if assert_contains "$output" "evidence\|verify\|verification" "Role mentions evidence/verification"; then : ; else exit 1; fi

echo ""

# Test 2: Four required inputs
echo "Test 2: Four required inputs..."

output=$(run_claude "The completion-verifier agent requires four specific inputs before it will produce a PASS status. What are they? Name each one." 30)

if assert_contains "$output" "[Vv]erification commands\|commands.*run\|test.*commands" "Input: verification commands"; then : ; else exit 1; fi
if assert_contains "$output" "[Rr]equirements source\|requirements\|plan file" "Input: requirements source"; then : ; else exit 1; fi
if assert_contains "$output" "[Cc]hanged files\|modified files\|files changed" "Input: changed files"; then : ; else exit 1; fi
if assert_contains "$output" "[Ww]orking directory\|work.*dir\|project root" "Input: working directory"; then : ; else exit 1; fi

echo ""

# Test 3: Iron Law — no PASS without evidence
echo "Test 3: Iron Law (evidence before claims)..."

output=$(run_claude "Can the completion-verifier agent report STATUS: PASS without actually running the verification commands? Explain its rule about this." 30)

if assert_contains "$output" "[Nn]o\|[Cc]annot\|[Mm]ust\|refuses" "Agent refuses PASS without evidence"; then : ; else exit 1; fi
if assert_contains "$output" "[Rr]un.*command\|fresh.*evidence\|actually.*ran" "References running commands"; then : ; else exit 1; fi

echo ""

# Test 4: Scope boundaries — what the agent will NOT do
echo "Test 4: Scope boundaries..."

output=$(run_claude "List three things the completion-verifier agent is explicitly NOT supposed to do when verifying work." 30)

if assert_contains "$output" "[Rr]etry\|flak\|[Ff]ix\|[Ss]uggest\|remediat\|review\|debug" "References out-of-scope behaviors"; then : ; else exit 1; fi

echo ""

# Test 5: Structured report format
echo "Test 5: Structured report format..."

output=$(run_claude "What sections appear in every report from the completion-verifier agent? Name at least four." 30)

if assert_contains "$output" "STATUS" "Report has STATUS"; then : ; else exit 1; fi
if assert_contains "$output" "TEST RESULTS\|test.*results" "Report has TEST RESULTS"; then : ; else exit 1; fi
if assert_contains "$output" "REQUIREMENTS\|requirements" "Report has REQUIREMENTS"; then : ; else exit 1; fi
if assert_contains "$output" "CONFIDENCE\|confidence" "Report has CONFIDENCE NOTES"; then : ; else exit 1; fi

echo ""
echo "=== All completion-verifier tests passed ==="
