# Answer Authority

When AUTO returns at a blocking gate (Step 2 clarifying question, Gate A spec preview, or Gate B proceed-to-code preview), conductor must decide: **answer the gate from artifacts, or halt to human?**

This file codifies the heuristic. The bar is intentionally high — getting this wrong wastes tokens, ships wrong code, or worse, silently encodes a product decision conductor was never authorised to make.

## The rule

> **Answer ONLY if every part of the answer is grounded in concrete artifacts the conductor can read.**
>
> Allowed grounding sources:
>
> 1. `roadmap.md` — task description, dependency graph, status.
> 2. `roadmap-meta.md` — base branch, integration branch name, owner.
> 3. Prior `task-<N>/summary.md` files — what previous tasks built, decided, touched, and flagged.
> 4. The visible repo state at the conductor's worktree HEAD — `git log`, file contents, package.json, existing tests, etc.
>
> If the answer requires anything beyond these sources — a product preference, a domain assumption, a "we usually do X here" instinct, a guess about user intent — **halt**.

Halt is not failure. It is the cheap, correct outcome whenever the question outruns the available grounding.

## Categories of gate question

### Category A — Almost always answerable

These map directly onto artifacts. Conductor SHOULD answer.

- "Is this spec aligned with the task description?" — read `roadmap.md` task title + the dispatched prompt; compare with the spec preview. Answer `approve` if aligned, `edit <specific change>` otherwise.
- "Does this plan touch only the expected files?" — compare plan's expected-files list to the task description's scope. Answer or specify the edit.
- "Should I depend on the convention used in `<file mentioned in spec>`?" — read the file. Yes if it exists and the convention is clear; halt if ambiguous.

### Category B — Sometimes answerable, with care

These can be grounded, but the grounding must be explicit. Conductor MUST cite the source in its SendMessage answer ("per task-2/summary.md gotchas, X is required") so it's auditable.

- "Should I add error handling for case X?" — answerable IF a prior task summary's gotchas mention X, OR an existing helper in the codebase shows the convention. Otherwise halt.
- "Is this dependency already in the project, or do I need to add it?" — answerable from `package.json` / lockfile. Answer with the cited source.
- "Should the migration be reversible?" — answerable IF `roadmap-meta.md` or a prior summary specifies. Otherwise halt.

### Category C — Almost always halt

These are product or design decisions outside conductor's authority.

- Anything starting with "should we…" that has no answer in the artifacts.
- "Which library should I use for X?" — this is a design call, even if the technical considerations are visible. Halt.
- "What should the user-facing copy say?" — UX content; halt.
- "Is this acceptable performance?" — quantitative judgment; halt.
- Schema migrations that touch shared tables — halt regardless of grounding (blast radius too high).

## The halt protocol

When halting:

1. Update `state.json`: set `phase = auto-blocked-on-gate`, set `lastHaltAt` to now, set `lastHaltQuestion` to the verbatim AUTO question.
2. Surface to the user a single message:

   > Conductor halted at task `<N>` (phase: `auto-blocked-on-gate`).
   >
   > AUTO is asking: `<lastHaltQuestion>`
   >
   > Conductor cannot ground this answer in the available artifacts. Reasoning: `<one sentence — which Category, why no source applied>`.
   >
   > Provide an answer (or `cancel` to abort the task). Conductor will SendMessage your reply to AUTO and continue.

3. Exit the turn. On the user's next message, treat it as the SendMessage payload (after lightly validating it's plausibly an answer to the question), update `state.json` (`phase` back to `auto-running`, clear halt fields), and SendMessage AUTO.

## The answer protocol (Category A and B)

When answering:

1. Update `state.json`: ensure `phase = auto-running` (it was `auto-blocked-on-gate` for the duration of the decision).
2. Compose the answer message. For Category B, include a citation: `"per task-<N>/summary.md, decision: <X>"`.
3. SendMessage to `subAgentId`.
4. Move on. Do NOT also surface the question to the user — the whole point is silent autonomy when grounding is sufficient.

## Anti-patterns

- **Hedging.** Don't answer "probably approve, but maybe edit if X" — pick one and SendMessage it. AUTO's gate expects a single decision.
- **Synthesizing across categories.** A Category A part + Category C part = halt. Don't answer the easy half and leave AUTO to guess the hard half.
- **Answering with `wait`.** If conductor cannot answer, halt — do not stall AUTO with a hold-message hoping clarity emerges later.
