---
name: feature-development-with-data-and-ui
description: Workflow command scaffold for feature-development-with-data-and-ui in fgwebsite_cc.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-development-with-data-and-ui

Use this workflow when working on **feature-development-with-data-and-ui** in `fgwebsite_cc`.

## Goal

Implements a new feature or enhancement that involves updating data, scripts, UI components, and utility libraries.

## Common Files

- `data/*.json`
- `public/data/**/*.json`
- `scripts/*.mjs`
- `src/components/*.tsx`
- `src/pages/*.tsx`
- `src/lib/*.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Update or add data files as needed for the feature.
- Modify or add scripts in scripts/ to process or generate new data.
- Update or create src/components/ and src/pages/ for UI changes.
- Update or create src/lib/ utility modules to support new logic.
- Update types in src/types.ts if new data structures are introduced.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.