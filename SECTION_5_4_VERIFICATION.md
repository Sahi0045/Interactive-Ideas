# Section 5.4 Stage Final Checkpoint States - Verification Report

**Status: ⚠️ PARTIALLY IMPLEMENTED (40%)**

---

## 📋 PRD Requirements vs Implementation

### 1. Partial Stage

**PRD Spec:**
- At least half the stage CPs completed but final CP not gold
- Monster retreats rather than dying
- One residual path element remains

**Implementation Status:**

✅ **Backend Logic (IMPLEMENTED)**
- Stage outcome types defined: `"partial_stage"` in `convex/ventureConstants.ts:1037-1040`
- Logic exists: `getStageOutcome()` returns `"partial_stage"` when:
  - `completed >= halfThreshold` 
  - Final checkpoint NOT completed (`convex/ventureConstants.ts:1097-1099`)
- Monster state correctly set to `"retreated"` when outcome is `"partial_stage"` (`convex/ventureConstants.ts:1105-1110`)

✅ **Frontend Phaser Logic (IMPLEMENTED)**
- Mini-boss retreat logic in `WorldMapScene.ts:2990-3003`
- Triggers when:
  - Player moved past stage
  - At least half checkpoints completed  
  - Final checkpoint NOT completed
  - Boss hasn't already retreated (tracked via `retreatedStages` Set)

✅ **Mini-Boss Retreat Animation (IMPLEMENTED)**
- Fog of Vagueness: swirls inward, condenses, settles at 40% alpha (`MiniBoss.ts:289-319`)
- Wraith/Golem/Specter: slides underground, re-emerges dimly (`MiniBoss.ts:323-358`)

❌ **Residual Path Element (NOT IMPLEMENTED)**
- No visual "residual path element" remains on the map
- No code found for lingering corruption/path markers on partial completion

---

### 2. Stage Clear

**PRD Spec:**
- Final CP standard-completed (2/3 tasks)
- Monster slain
- Stage biome fully restores visually
- Stage Clear card animation plays (arcade-style banner drop)

**Implementation Status:**

✅ **Backend Logic (IMPLEMENTED)**
- Stage outcome type: `"stage_clear"` defined (`convex/ventureConstants.ts:1037-1040`)
- Returns `"stage_clear"` when final checkpoint completed but not gold (`convex/ventureConstants.ts:1097-1099`)
- Monster state set to `"slain"` (`convex/ventureConstants.ts:1105-1110`)

✅ **Frontend Phaser Monster Slay (IMPLEMENTED)**
- Mini-boss slay logic: `WorldMapScene.ts:2984-2989`
- Triggers when `stageComplete = completed === total && total > 0`
- Boss entities have `slay()` method:
  - Fog of Vagueness: dissipates outward with scale/fade, 2s (`MiniBoss.ts:227-235`)
  - Wraith: shatters and fades, 2s (`MiniBoss.ts:240-263`)

❌ **Stage Biome Visual Restoration (NOT IMPLEMENTED)**
- No code found that "fully restores" the biome visually
- Brightness system exists (`brightness-calculator.ts`) but is NOT tied to stage completion restoration
- No particles, color restoration, or visual biome transformation on stage clear

❌ **Stage Clear Card Animation (NOT IMPLEMENTED)**
- No "arcade-style banner drop" animation
- No modal/overlay that displays "STAGE CLEAR" with dramatic animation
- Feed notification exists for stage completion (`VentureFeed.tsx:129-141`) but not an in-game modal

---

### 3. Gold Stage

**PRD Spec:**
- Final CP gold-completed (3/3 tasks)
- Unique monster slay animation triggers
- Stage biome transforms — colour-floods, particles, landscape elevation change

**Implementation Status:**

✅ **Backend Logic (IMPLEMENTED)**
- Stage outcome type: `"gold_stage"` defined (`convex/ventureConstants.ts:1037-1040`)
- Returns `"gold_stage"` when final checkpoint completed AND gold (`convex/ventureConstants.ts:1095-1096`)
- Monster state set to `"slain"` (`convex/ventureConstants.ts:1105-1110`)

⚠️ **Unique Monster Slay Animation (PARTIALLY IMPLEMENTED)**
- Current implementation: ALL stage completions use the SAME `slay()` animation
- No separate "gold slay" vs "standard slay" animation paths in `MiniBoss.ts:206-266`
- The PRD calls for a "unique" slay animation specifically for gold completion
- Current slay animations are boss-specific, not completion-quality-specific

❌ **Biome Transformation (NOT IMPLEMENTED)**
- No "colour-floods" effect
- No particle system for gold stage completion
- No "landscape elevation change"
- No visual distinction between standard stage completion vs gold stage completion

---

## 🔍 Code References

### Backend Stage Outcome Logic
**File:** `convex/ventureConstants.ts:1037-1120`

```typescript
export type StageOutcome =
  | "not_started"
  | "in_progress"
  | "partial_stage"
  | "stage_clear"
  | "gold_stage";

export function getStageOutcome(
  stageId: number,
  checkpoints: StageCheckpointState[],
): {
  outcome: StageOutcome;
  // ... other fields
  monsterState: "active" | "retreated" | "slain";
}
```

### Frontend Mini-Boss State Logic
**File:** `src/lib/phaser/scenes/WorldMapScene.ts:2970-3007`

```typescript
if (stageComplete) {
  // Slay the boss when stage is complete
  if (miniBoss && miniBoss.active) {
    miniBoss.slay();
    this.retreatedStages.delete(stage);
  }
} else if (
  playerMovedPast &&
  halfComplete &&
  !finalCheckpointCompleted &&
  !this.retreatedStages.has(stage)
) {
  if (miniBoss && miniBoss.active) {
    miniBoss.retreat();
    this.retreatedStages.add(stage);
  }
}
```

### Mini-Boss Animation Methods
**File:** `src/lib/phaser/entities/MiniBoss.ts`

- `slay()`: L206-266
- `retreat()`: L276-361

---

## 📊 Summary Table

| PRD Feature | Status | Backend | Frontend | Visuals | Notes |
|-------------|--------|---------|----------|---------|-------|
| **Partial Stage** | ⚠️ 75% | ✅ | ✅ | ❌ | Logic complete, missing residual path element |
| **Standard Stage Clear** | ⚠️ 50% | ✅ | ✅ | ❌ | Slay works, no biome restoration or banner |
| **Gold Stage** | ❌ 25% | ✅ | ⚠️ | ❌ | No unique gold slay, no biome transform |

**Overall Section 5.4 Completion: 40%**

---

## ✅ What IS Working

1. ✅ All three stage outcome types (`partial_stage`, `stage_clear`, `gold_stage`) are defined and calculated correctly in backend
2. ✅ Monster state correctly maps to outcome (retreated vs slain)
3. ✅ Frontend Phaser correctly triggers mini-boss `slay()` when stage complete
4. ✅ Frontend Phaser correctly triggers mini-boss `retreat()` when partial + player moved past
5. ✅ Mini-boss retreat animations are implemented and working
6. ✅ Mini-boss slay animations are implemented (basic, not gold-specific)

---

## ❌ What IS NOT Working (Gaps vs PRD)

### High Priority Gaps:

1. ❌ **Stage Clear Card Animation** — No in-game modal/banner for stage completion
2. ❌ **Biome Visual Restoration** — Stage doesn't "restore" visually on clear
3. ❌ **Gold Stage Unique Slay Animation** — Gold completion uses same slay as standard
4. ❌ **Gold Stage Biome Transformation** — No colour-flood/particles/elevation change

### Medium Priority Gaps:

5. ❌ **Residual Path Element** — Partial stage doesn't leave visual marker

---

## 🛠️ Required Work to Fully Implement Section 5.4

### Task 1: Stage Clear Card Animation (2-3 hours)
**Files to create/modify:**
- Create: `src/components/map/StageClearModal.tsx`
- Modify: `src/app/map/world/page.tsx` (trigger on stage completion)
- Modify: `src/lib/phaser/scenes/WorldMapScene.ts` (emit event to React)

**Implementation:**
```tsx
// When stage completes, show arcade-style banner
<StageClearModal 
  show={stageJustCompleted}
  stageNumber={completedStage}
  stageName="Ideation"
  isGold={wasGoldCompletion}
/>
// Banner drops from top with particles, 3s auto-dismiss
```

---

### Task 2: Biome Visual Restoration (3-4 hours)
**Files to modify:**
- `src/lib/phaser/scenes/WorldMapScene.ts`

**Implementation approach:**
- When mini-boss slain, trigger biome restoration effect:
  - Fade brightness overlay to 0 over 2s
  - Spawn particle emitters (stars, sparkles) over biome area
  - Play restoration sound effect

---

### Task 3: Gold Stage Unique Slay + Transformation (4-5 hours)
**Files to modify:**
- `src/lib/phaser/entities/MiniBoss.ts` — Add `slayGold()` method
- `src/lib/phaser/scenes/WorldMapScene.ts` — Call `slayGold()` when gold completion
- `src/lib/phaser/scenes/WorldMapScene.ts` — Add biome transformation effect

**Implementation:**
```typescript
// In WorldMapScene.ts
if (stageComplete && finalCheckpointGold) {
  miniBoss.slayGold(); // Longer, more dramatic animation
  this.transformBiomeGold(stage); // Color flood, particles, elevation
} else if (stageComplete) {
  miniBoss.slay(); // Standard slay
  this.restoreBiome(stage); // Standard restoration
}
```

---

### Task 4: Residual Path Element (2 hours)
**Files to modify:**
- `src/lib/phaser/scenes/WorldMapScene.ts`

**Implementation:**
- When boss retreats, spawn a semi-transparent residual marker at boss position
- Could be: lingering fog wisp, crack in the ground, faded silhouette
- Marker persists until stage is actually completed

---

## 🎯 Recommended Next Steps

### If implementing Section 5.4 fully:

1. **Start with Stage Clear Modal** (highest user-facing impact, easiest to implement)
2. **Then Gold Slay + Transformation** (most visually impressive PRD feature)
3. **Then Biome Restoration** (polish pass)
4. **Finally Residual Path** (nice-to-have)

### If shipping as-is:

The core logic is solid. Players can:
- ✅ Complete stages partially or fully
- ✅ See mini-bosses retreat or die
- ✅ Backend correctly tracks all three outcomes

What they WON'T see:
- ❌ Dramatic in-game celebration for stage completion
- ❌ Visual biome changes tied to completion quality
- ❌ Clear visual distinction between gold vs standard stage completion

---

## 📝 Final Answer

**Section 5.4 Stage Final Checkpoint States:**

**✅ Core logic: IMPLEMENTED**
- All three stage outcome types work correctly
- Backend state correctly differentiates partial/clear/gold
- Mini-bosses retreat or slay as specified

**❌ Visual/UX layer: NOT IMPLEMENTED**
- No stage clear celebration modal/banner
- No biome visual restoration
- No gold-specific slay animation
- No biome transformation effects
- No residual path markers

**Completion: 40%**  
**Shippable: Yes (with reduced visual polish)**  
**PRD-Compliant: No (missing 4 of 7 specified visual features)**
