# Pulse Command Deck Design
**Date:** 2026-03-08  
**Status:** Implemented

## Summary
This design pass upgrades Chronos into a cinematic command-center experience by focusing on:
- Typography hierarchy (`Space Grotesk`, `Manrope`, `JetBrains Mono`)
- Mission Timeline as the primary top-level state visualization
- Adaptive accent system with constrained state-driven emphasis

The changes are intentionally front-end only and reuse existing backend status sources.

## Core Decisions
1. **Single read path on Dashboard**
Mission Timeline sits first, Active Pulse remains central, and supporting context stays below.

2. **Shared visual-state contract**
`UIVisualState = "normal" | "flow" | "warning" | "critical" | "paused" | "unknown"` defines state styling consistently across screens.

3. **Mission Timeline contract**
`TimelineSegment = { type, startPct, endPct, durationSeconds }` with segment types:
- `tracked`
- `flow`
- `untracked`
- `paused`

4. **Accent budget**
Per screen, accent emphasis is constrained to:
- timeline highlight
- active hero indicator
- one status chip

## Implemented UX/System Changes
- Added a reusable state-mapping helper with deterministic precedence and `unknown` fallback.
- Added mission timeline derivation logic with paused/untracked gap handling and flow segmentation.
- Introduced a reusable Mission Timeline component with semantic legend and status chip.
- Added a shared top-strip frame pattern (title + subtitle + status chip + optional action slot).
- Applied the frame pattern to Reports, Review, and Settings.
- Updated typography usage to enforce distinct display/UI/data roles.

## Quality and Verification
- Added test coverage for:
  - visual-state precedence and fallback behavior
  - mission timeline mixed-segment derivation
  - paused/no-data timeline handling
  - mission timeline fallback rendering copy
- Verified project build passes (`tsc` + Vite production build).

## Explicitly Not Included
- Navigation rail layout overhaul
- Expanded high-drama accent coverage beyond the budget
- New analytics features or backend schema changes

## Next Handoff
Use this design as the baseline for future implementation planning updates via the `writing-plans` workflow when new UI polish phases are scoped.
