---
name: add-or-update-seasonal-data
description: Workflow command scaffold for add-or-update-seasonal-data in fgwebsite_cc.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-or-update-seasonal-data

Use this workflow when working on **add-or-update-seasonal-data** in `fgwebsite_cc`.

## Goal

Adds or updates data files for new seasons (e.g., player bios, boxscores, roster ages), updates scripts to process new data, and updates components/pages to reflect new data.

## Common Files

- `public/data/boxscores/YYYY.json`
- `public/data/roster-age/YYYY.json`
- `data/player-bio.json`
- `scripts/build-*.mjs`
- `scripts/fetch-*.mjs`
- `src/components/*.tsx`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Add or update JSON data files for the new season in public/data or data/ directories.
- Update or create scripts in scripts/ to process or build the new data.
- Modify or extend src/components/ and src/pages/ to use or display the new data.
- Update src/lib/ modules to handle new data structure or calculations if needed.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.