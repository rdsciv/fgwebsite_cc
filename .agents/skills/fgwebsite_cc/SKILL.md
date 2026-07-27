```markdown
# fgwebsite_cc Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches you the core development patterns and workflows for the `fgwebsite_cc` repository, a TypeScript project using the Vite framework. The codebase is centered around seasonal sports data, with workflows for updating datasets, building scripts, and developing new features that span data, UI, and utility modules. You'll learn the project's coding conventions, how to add or update seasonal data, and how to develop new features that integrate data, scripts, and UI components.

## Coding Conventions

### File Naming

- **Components, Pages, and Modules:** Use PascalCase for filenames.
  - Example: `PlayerStats.tsx`, `RosterAge.ts`, `BoxscorePage.tsx`
- **Scripts and Data:** Use kebab-case or snake_case as appropriate.
  - Example: `build-boxscores.mjs`, `player-bio.json`

### Imports

- **Relative imports** are used throughout the codebase.
  ```typescript
  import { PlayerStats } from '../components/PlayerStats';
  import { calculateAge } from '../lib/ageUtils';
  ```

### Exports

- **Named exports** are preferred.
  ```typescript
  // src/lib/ageUtils.ts
  export function calculateAge(birthDate: string): number {
    // ...
  }
  ```

### Commit Patterns

- **Freeform commit messages** with no strict prefixes.
- **Average length:** ~44 characters.

## Workflows

### Add or Update Seasonal Data

**Trigger:** When adding or updating data for a new season (e.g., new year of stats, rosters, or boxscores).  
**Command:** `/add-season-data`

1. **Add or update JSON data files** for the new season in `public/data/` or `data/` directories.
   - Example: `public/data/boxscores/2024.json`, `public/data/roster-age/2024.json`
2. **Update or create scripts** in `scripts/` to process or build the new data.
   - Example: `scripts/build-boxscores.mjs`
3. **Modify or extend UI components/pages** in `src/components/` and `src/pages/` to use or display the new data.
   - Example: Update `src/components/BoxscoreTable.tsx` to read from the new season's file.
4. **Update utility modules** in `src/lib/` if the data structure or calculations change.
   - Example: Adjust parsing logic in `src/lib/boxscoreUtils.ts` if new fields are added.

**Example:**
```typescript
// src/components/BoxscoreTable.tsx
import boxscores from '../../public/data/boxscores/2024.json';
```

---

### Feature Development with Data and UI

**Trigger:** When developing a new feature or enhancing an existing one that requires changes across data, scripts, UI, and utility code.  
**Command:** `/new-feature`

1. **Update or add data files** as needed for the feature.
   - Example: Add `data/new-feature-data.json`
2. **Modify or add scripts** in `scripts/` to process or generate new data.
   - Example: Create `scripts/build-new-feature.mjs`
3. **Update or create UI components/pages** in `src/components/` and `src/pages/`.
   - Example: Add `src/components/NewFeatureWidget.tsx`
4. **Update or create utility modules** in `src/lib/` to support new logic.
   - Example: Add `src/lib/newFeatureUtils.ts`
5. **Update types** in `src/types.ts` if new data structures are introduced.
   - Example:
     ```typescript
     // src/types.ts
     export interface NewFeatureData {
       id: string;
       value: number;
     }
     ```
6. **Update styling or config files** if necessary.
   - Example: Edit `src/index.css` for new styles.

**Example:**
```typescript
// src/components/NewFeatureWidget.tsx
import { NewFeatureData } from '../types';
import newFeatureData from '../../data/new-feature-data.json';

export function NewFeatureWidget() {
  // Render logic here
}
```

## Testing Patterns

- **Test files** follow the pattern `*.test.*` (e.g., `BoxscoreUtils.test.ts`).
- **Testing framework:** Not explicitly detected; likely to use a standard TypeScript/React test runner (e.g., Jest, Vitest).
- **Test location:** Typically alongside the module or in a dedicated `__tests__` directory.

**Example:**
```typescript
// src/lib/ageUtils.test.ts
import { calculateAge } from './ageUtils';

test('calculates age correctly', () => {
  expect(calculateAge('2000-01-01')).toBe(24);
});
```

## Commands

| Command           | Purpose                                                      |
|-------------------|--------------------------------------------------------------|
| /add-season-data  | Add or update data and scripts for a new season              |
| /new-feature      | Scaffold and implement a new feature across data and UI      |
```
