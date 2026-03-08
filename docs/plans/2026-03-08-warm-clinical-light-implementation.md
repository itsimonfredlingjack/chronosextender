# Warm Clinical Light Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fully replace Chronos dark styling with a consistent warm light visual system while preserving behavior and UI state contracts.

**Architecture:** Introduce light semantic design tokens in global CSS, then migrate shared primitives and page/component styles from hardcoded dark values to token-driven classes. Keep all existing state/data contracts (`UIVisualState`, mission timeline semantics, status precedence) unchanged and validate via targeted UI tests plus full build checks.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (`@theme`), Vite, Node test runner (`node --test --import tsx`)

**Decomposition Strategy:** Feature-based

**Target Model:** Sonnet 30min chunks

---

### Task 1: Establish Light Token Foundation

**Chunk estimate:** ~30 min (Sonnet)

**Files:**
- Modify: `src/index.css`
- Test: `test/ui/visual-state.test.ts`

**Step 1: Write the failing test**

Add a new test in `test/ui/visual-state.test.ts`:

```ts
test("visual-state labels remain stable during theme migration", () => {
  const state = resolveUIVisualState({
    ollamaConnected: true,
    trackingActive: true,
    pendingCount: 0,
    inFlow: false,
  });
  assert.equal(state, "normal");
  assert.equal(getVisualStateLabel(state), "All systems normal");
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx test/ui/visual-state.test.ts`  
Expected: FAIL because `getVisualStateLabel` is not imported in the test yet.

**Step 3: Write minimal implementation**

Update imports in test and add light token foundation in `src/index.css`:

```css
@theme {
  --color-canvas: #f5f4f1;
  --color-surface: #fdfbf7;
  --color-surface-elevated: #ffffff;
  --color-border-subtle: #e4e0d8;
  --color-text-primary: #1f2937;
  --color-text-secondary: #475569;
  --color-text-muted: #64748b;
}

body {
  color-scheme: light;
  background: var(--color-canvas);
  color: var(--color-text-primary);
}
```

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx test/ui/visual-state.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add test/ui/visual-state.test.ts src/index.css
git commit -m "feat: add warm light theme token foundation"
```

**Verification Gate:**
1. Automated: `node --test --import tsx test/ui/visual-state.test.ts` -- passes
2. Manual: open app, confirm background is light and text is dark
3. Regression: `npm run build` -- passes
4. Review: no behavior/state logic changed

> **GATE RULE:** Do not proceed to Task 2 until all four checks pass.

### Task 2: Migrate Shared Command Deck Primitives

**Chunk estimate:** ~30 min (Sonnet)

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/MissionTimeline.tsx`
- Modify: `src/components/PageTopStrip.tsx`
- Test: `test/ui/mission-timeline.test.tsx`

**Step 1: Write the failing test**

Add a test in `test/ui/mission-timeline.test.tsx`:

```tsx
test("MissionTimeline renders light shell class contract", () => {
  const html = renderToStaticMarkup(
    <MissionTimeline
      visualState="normal"
      statusLabel="All systems normal"
      segments={[{ type: "tracked", startPct: 0, endPct: 100, durationSeconds: 3600 }]}
      totals={{ trackedSeconds: 3600, flowSeconds: 0, untrackedSeconds: 0, pausedSeconds: 0 }}
      playheadPct={100}
    />
  );
  assert.match(html, /mission-timeline-shell/);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx test/ui/mission-timeline.test.tsx`  
Expected: FAIL due to missing import or assertion mismatch before style migration updates.

**Step 3: Write minimal implementation**

Re-theme shared primitives in `src/index.css`:

```css
.mission-timeline-shell {
  background: linear-gradient(165deg, rgba(255, 253, 249, 0.96), rgba(246, 243, 236, 0.92));
  border: 1px solid var(--color-border-subtle);
}

.page-top-strip {
  background: linear-gradient(145deg, rgba(255, 253, 249, 0.95), rgba(247, 244, 238, 0.9));
  border: 1px solid var(--color-border-subtle);
}
```

Also update text color classes in `MissionTimeline.tsx` and `PageTopStrip.tsx` to light-theme token classes (`text-slate-*` equivalents or token-driven utility classes).

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx test/ui/mission-timeline.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/index.css src/components/MissionTimeline.tsx src/components/PageTopStrip.tsx test/ui/mission-timeline.test.tsx
git commit -m "feat: migrate command deck primitives to warm light style"
```

**Verification Gate:**
1. Automated: `node --test --import tsx test/ui/mission-timeline.test.tsx` -- passes
2. Manual: command deck and top strips appear light and readable
3. Regression: `node --test --import tsx test/ui/*.test.ts test/ui/*.test.tsx` -- passes
4. Review: semantic segments/state chips unchanged behavior

> **GATE RULE:** Do not proceed to Task 3 until all four checks pass.

### Task 3: Migrate Primary App Pages (Dashboard, Reports, Review, Settings)

**Chunk estimate:** ~30 min (Sonnet)

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/Reports.tsx`
- Modify: `src/pages/ReviewQueue.tsx`
- Modify: `src/pages/Settings.tsx`

**Step 1: Write the failing test**

Add one smoke test in `test/ui/mission-timeline.test.tsx` to guard fallback copy after style migration:

```tsx
test("MissionTimeline still exposes status copy after light migration", () => {
  const html = renderToStaticMarkup(
    <MissionTimeline
      visualState="unknown"
      statusLabel="Status unavailable"
      segments={[{ type: "untracked", startPct: 0, endPct: 100, durationSeconds: 60 }]}
      totals={{ trackedSeconds: 0, flowSeconds: 0, untrackedSeconds: 60, pausedSeconds: 0 }}
      playheadPct={100}
    />
  );
  assert.match(html, /Status unavailable/);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx test/ui/mission-timeline.test.tsx`  
Expected: FAIL if test is added with an intentional wrong string first; then fix to real expected text.

**Step 3: Write minimal implementation**

In each page:
- replace hardcoded dark backgrounds (`bg-[#1a1a2e]`, `bg-[#12121e]`, `border-[#2a2a40]`) with light token classes
- keep hierarchy and spacing behavior intact
- preserve accent-budget rule (timeline highlight + hero accent + one status chip)
- maintain compact `680x520` behavior on Dashboard

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx test/ui/mission-timeline.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/Reports.tsx src/pages/ReviewQueue.tsx src/pages/Settings.tsx test/ui/mission-timeline.test.tsx
git commit -m "feat: migrate core pages to warm clinical light theme"
```

**Verification Gate:**
1. Automated: `npm run build` -- passes
2. Manual: check `/`, `/reports`, `/review`, `/settings` for consistent light treatment
3. Regression: `node --test --import tsx test/ui/*.test.ts test/ui/*.test.tsx` -- passes
4. Review: no route/state/data changes

> **GATE RULE:** Do not proceed to Task 4 until all four checks pass.

### Task 4: Migrate Shared UI Components and Popovers

**Chunk estimate:** ~30 min (Sonnet)

**Files:**
- Modify: `src/components/StatusPopover.tsx`
- Modify: `src/components/WorkBlockCard.tsx`
- Modify: `src/components/TimelineBar.tsx`
- Modify: `src/components/CommandPalette.tsx`
- Modify: `src/components/ai-chat/AIChatPanel.tsx`

**Step 1: Write the failing test**

Create `test/ui/light-surface-smoke.test.tsx`:

```tsx
import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MissionTimeline from "../../src/components/MissionTimeline";

test("light theme migration does not remove timeline semantics", () => {
  const html = renderToStaticMarkup(
    <MissionTimeline
      visualState="flow"
      statusLabel="In flow"
      segments={[{ type: "flow", startPct: 0, endPct: 100, durationSeconds: 120 }]}
      totals={{ trackedSeconds: 0, flowSeconds: 120, untrackedSeconds: 0, pausedSeconds: 0 }}
      playheadPct={100}
    />
  );
  assert.match(html, /In flow/);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx test/ui/light-surface-smoke.test.tsx`  
Expected: FAIL until import/setup is correct.

**Step 3: Write minimal implementation**

For listed components:
- move dark panel backgrounds to light surfaces
- update border/shadow density for light context
- keep semantic accent colors and hierarchy
- ensure popovers and overlays stay readable on warm canvas

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx test/ui/light-surface-smoke.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/StatusPopover.tsx src/components/WorkBlockCard.tsx src/components/TimelineBar.tsx src/components/CommandPalette.tsx src/components/ai-chat/AIChatPanel.tsx test/ui/light-surface-smoke.test.tsx
git commit -m "feat: migrate shared components to light surfaces"
```

**Verification Gate:**
1. Automated: `node --test --import tsx test/ui/light-surface-smoke.test.tsx` -- passes
2. Manual: popovers/palettes remain readable and visually consistent
3. Regression: `npm run test:assistant` -- passes
4. Review: component scope only, no app logic edits

> **GATE RULE:** Do not proceed to Task 5 until all four checks pass.

### Task 5: Overlay and Assistant Surface Harmonization

**Chunk estimate:** ~30 min (Sonnet)

**Files:**
- Modify: `src/pages/OverlayView.tsx`
- Modify: `src/components/overlay/OverlayPulse.tsx`
- Modify: `src/components/overlay/OverlayCommandBar.tsx`
- Modify: `src/components/ai-chat/ChatHeader.tsx`
- Modify: `src/components/ai-chat/ChatInput.tsx`
- Modify: `src/components/ai-chat/ChatMessage.tsx`

**Step 1: Write the failing test**

Add a simple assertion in `test/ui/light-surface-smoke.test.tsx`:

```tsx
test("light migration keeps unknown-state fallback visible", () => {
  const html = renderToStaticMarkup(
    <MissionTimeline
      visualState="unknown"
      statusLabel="Status unavailable"
      segments={[{ type: "untracked", startPct: 0, endPct: 100, durationSeconds: 1 }]}
      totals={{ trackedSeconds: 0, flowSeconds: 0, untrackedSeconds: 1, pausedSeconds: 0 }}
      playheadPct={100}
    />
  );
  assert.match(html, /Status unavailable/);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx test/ui/light-surface-smoke.test.tsx`  
Expected: FAIL on first run while test is introduced incorrectly, then corrected.

**Step 3: Write minimal implementation**

Migrate overlay/assistant dark shells to warm light surfaces with:
- toned-down backdrop blur
- high text contrast
- consistent chip/button semantics
- unchanged interaction behavior

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx test/ui/light-surface-smoke.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/OverlayView.tsx src/components/overlay/OverlayPulse.tsx src/components/overlay/OverlayCommandBar.tsx src/components/ai-chat/ChatHeader.tsx src/components/ai-chat/ChatInput.tsx src/components/ai-chat/ChatMessage.tsx test/ui/light-surface-smoke.test.tsx
git commit -m "feat: harmonize overlay and assistant with light theme"
```

**Verification Gate:**
1. Automated: `node --test --import tsx test/ui/light-surface-smoke.test.tsx` -- passes
2. Manual: overlay and assistant remain legible and usable
3. Regression: `npm run build` -- passes
4. Review: no behavioral regressions in chat/overlay controls

> **GATE RULE:** Do not proceed to Task 6 until all four checks pass.

### Task 6: End-to-End Verification and Cleanup

**Chunk estimate:** ~25 min (Sonnet)

**Files:**
- Modify: `src/index.css` (final token cleanup only if needed)
- Modify: `docs/plans/2026-03-08-warm-clinical-light-design.md` (status update)

**Step 1: Write the failing test**

Add one final cross-test command expectation by running full UI test glob first (expect fail if any regressions remain).

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx test/ui/*.test.ts test/ui/*.test.tsx`  
Expected: If failing, capture exact output and fix before proceeding.

**Step 3: Write minimal implementation**

Fix only residual token/class regressions, then update design doc status to `Implemented`.

**Step 4: Run test to verify it passes**

Run these commands:

```bash
node --test --import tsx test/ui/*.test.ts test/ui/*.test.tsx
npm run test:assistant
npm run build
```

Expected: all PASS

**Step 5: Commit**

```bash
git add src/index.css docs/plans/2026-03-08-warm-clinical-light-design.md
git commit -m "chore: finalize warm clinical light verification"
```

**Verification Gate:**
1. Automated: all commands above pass
2. Manual: viewport checks at `680x520` and desktop large viewport
3. Regression: routes `/`, `/review`, `/reports`, `/settings`, `/overlay` render correctly
4. Review: no dark hardcoded hex left in migrated scope

> **GATE RULE:** Do not declare completion until all checks pass.
