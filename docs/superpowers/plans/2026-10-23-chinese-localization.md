# P(doom) Chinese Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an independent `pdoom-video-zh` copy whose rendered English lyrics and on-screen copy are localized into Simplified Chinese without changing the source project.

**Architecture:** Keep English source lyrics and timings as semantic keys, and derive Chinese display lines with the same source-word slots so existing scene timing and word identity remain stable. Bundle a deterministic CJK font, then localize fixed scene copy at its draw sites while preserving the existing visual system.

**Tech Stack:** TypeScript, Three.js, Canvas 2D, Bun tests, Vite, Playwright/Chrome renderer

**Spec:** `docs/superpowers/specs/2026-10-23-chinese-localization-design.md`

## Global Constraints

- Never modify `/Users/charlotte/code/audio/pdoom-video`.
- Preserve the existing audio and all English alignment timestamps.
- Keep scene timing, palette, camera, motion, and render pipeline unchanged.
- Bundle Noto Sans CJK SC in `app/public/fonts` for deterministic export.
- Keep English only for proper names, code/model identifiers, and the mathematical `P(doom)` notation where its form is integral to the visual motif.

## Review Focus

- Chinese segments must cover every source word window without gaps or reversed timings; Task 1 tests every line and word.
- English lookup queries must still find translated display lines; Task 1 tests representative timeline and scene queries.
- CJK glyph drawing must not fall back to missing glyphs in outline-based scenes; Task 2 adds font registration and render checks.
- Fixed English labels can hide outside the lyric data; Task 3 audits rendered strings and browser frames.
- The duplicate must remain independent of the source repository; Task 4 compares source HEAD/status and filesystem changes.

---

### Task 1: Dual-layer lyric localization

**Files:**
- Create: `app/src/localization/chinese.ts`
- Create: `app/tests/chinese.test.ts`
- Modify: `app/src/engine/lyrics.ts`

**Interfaces:**
- Produces: `localizeLyrics(lines): localized display text`, `sourceText(line)`, and source-preserving word metadata used by scenes.

- [ ] Write failing tests proving all 46 lines have Chinese text, timestamps remain monotonic, and English queries still resolve.
- [ ] Run `bun test tests/chinese.test.ts` and confirm it fails because localization is absent.
- [ ] Implement the Chinese phrase map and dual-layer lyric fields.
- [ ] Run `bun test tests/chinese.test.ts` and confirm it passes.

### Task 2: Deterministic Chinese typography

**Files:**
- Create: `app/public/fonts/NotoSansCJKsc-Medium.otf`
- Modify: `app/src/engine/type.ts`
- Modify: lyric-rendering scene modules under `app/src/scenes/`

**Interfaces:**
- Consumes: localized lyric words from Task 1.
- Produces: `F.zh()` and CJK-capable canvas/outline rendering paths.

- [ ] Add a failing font-registry test that expects the bundled Chinese face.
- [ ] Run the focused test and confirm the missing font failure.
- [ ] Register the font and update lyric drawing/layout paths to use Chinese display text without changing semantic timing branches.
- [ ] Run tests and `bun run check`.

### Task 3: Localize scene and player copy

**Files:**
- Modify: `app/src/scenes/*.ts`
- Modify: `app/src/main.ts`
- Modify: `app/index.html`
- Modify: `app/package.json`
- Create: `app/scripts/verify-zh.ts`

**Interfaces:**
- Consumes: CJK font and localized lyric API.
- Produces: a Chinese preview UI and browser verification report.

- [ ] Add a failing source/display audit for known visible English labels.
- [ ] Run the audit and confirm it reports the original labels.
- [ ] Translate visible labels, annotations, form copy, prompts, status text, and title.
- [ ] Run tests, type checks, and the production build.
- [ ] Launch the preview and run browser verification across scene boundaries and representative lyric frames.

### Task 4: Independence and final verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: localized project instructions and final verification evidence.

- [ ] Document the Chinese copy, preview command, and render command.
- [ ] Run `bun test`, `bun run check`, `bun run build`, and the browser verification command.
- [ ] Compare `/Users/charlotte/code/audio/pdoom-video` HEAD/status with the recorded baseline and confirm no changes.
- [ ] Review `git diff --check` and the complete duplicate diff.
