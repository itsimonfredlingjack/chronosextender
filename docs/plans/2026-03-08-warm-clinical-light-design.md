# Warm Clinical Light Design
**Date:** 2026-03-08  
**Status:** Approved

## Summary
Chronos will fully replace the current dark visual language with a light-first system.
The chosen direction is **Warm Clinical Light**:
- warm near-white surfaces (no pure white)
- high-readability, calm visual hierarchy
- restrained semantic accents (indigo primary; amber/red only for warnings/errors)

## Design Direction
This design blends:
- **Wild Card 15:** ban pure white and pure black to avoid harshness and visual fatigue
- **Apple Health-inspired calm:** trustworthy, clear, low-noise presentation of stateful information

The mission timeline remains the top “command deck” element, but in a daylight treatment with reduced glow and softer emphasis.

## Core System Decisions
1. **Full replacement**
Dark mode is not maintained in this pass. Light mode becomes the primary and only surface language for main app screens.

2. **Tokenized foundation**
Hardcoded dark hex values are migrated to shared semantic tokens:
- `canvas`, `surface`, `surface-elevated`
- `border-subtle`, `text-primary`, `text-secondary`, `text-muted`
- semantic state tokens for `normal`, `flow`, `warning`, `critical`, `paused`, `unknown`

3. **Accent discipline**
Only key status moments receive accent emphasis:
- timeline highlight
- active hero indicator
- one status chip

4. **Behavior preserved**
Existing UI contracts and backend/state behavior remain unchanged.

## Component Intent
- **Mission Timeline:** become a refined ink-strip rather than a glowing neon bar.
- **Cards/Panels:** soft frosted light surfaces, subtle warm borders, low-elevation shadows.
- **Status Chips:** muted tinted backgrounds with strong readable text.
- **Navigation rail:** light matte treatment with clean active indicator.
- **Motion:** keep timing, reduce bloom/intensity.

## Accessibility and UX Quality Bar
- Maintain AA-leaning contrast for primary text and status chips.
- Keep visible keyboard focus treatment in light context.
- Keep quick state comprehension (target: under 2 seconds for current state + progress).
- Verify small desktop window fit remains strong (main Tauri size `680x520`).

## What We Are Not Doing
- No dual-theme toggle in this pass
- No backend/API changes
- No layout architecture rewrite
- No extra feature bundling (analytics, workflow logic)

## Next Step
Create a detailed implementation plan for this migration using the `writing-plans` workflow.
