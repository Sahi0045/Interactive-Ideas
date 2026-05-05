/**
 * @file event-bridge.ts
 * @description Bidirectional React ↔ Phaser event system.
 *
 * Architecture overview
 * ─────────────────────
 * React and Phaser run in separate execution contexts (React component tree vs
 * Phaser game loop). This singleton EventBridge acts as the shared bus between
 * them without coupling either side to the other.
 *
 * Flow:
 *   React  ──dispatchToPhaser──▶  EventBridge  ──▶  Phaser listeners
 *   Phaser ──dispatchToReact───▶  EventBridge  ──▶  React  listeners
 *
 * Usage — React side:
 *   // Subscribe inside a component
 *   useGameEvent('PHASER_READY', () => console.log('game ready'))
 *
 *   // Or subscribe manually
 *   eventBridge.on('CHECKPOINT_CLICKED', handleClick)
 *
 *   // Send an event to Phaser
 *   eventBridge.dispatchToPhaser({ type: 'UPDATE_BRIGHTNESS', brightness: 75 })
 *
 * Usage — Phaser scene:
 *   // Subscribe to events from React
 *   eventBridge.on('UPDATE_BRIGHTNESS', (e) => this.applyBrightness(e.brightness))
 *
 *   // Notify React
 *   eventBridge.dispatchToReact({ type: 'PHASER_READY' })
 *
 * No external runtime dependencies — pure TypeScript with a Map-backed
 * listener registry. The optional `useGameEvent` hook is the only place
 * that imports from React, and only runs in a React context.
 */

// React hooks used by useGameEvent — imported at module level so they are
// always called unconditionally (satisfies rules-of-hooks).
import { useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint state (shared vocabulary between React and Phaser)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Client-side representation of a single checkpoint's state for the Phaser
 * world map. Differs from the raw DB record — `gold` and `locked` are derived
 * UI states rather than stored values.
 *
 * Mapping from DB → CheckpointState:
 *   DB `not_started` + not current checkpoint → `locked`
 *   DB `not_started` + is  current checkpoint → `active`
 *   DB `in_progress`                          → `in_progress`
 *   DB `completed`   + goldBonusEarned=false  → `completed`
 *   DB `completed`   + goldBonusEarned=true   → `gold`
 */
export interface CheckpointState {
  /** Convex document `_id` as a plain string. */
  id: string;
  /** Stage number 1–8. */
  stage: number;
  /** Checkpoint number within the stage (1-based). */
  checkpoint: number;
  /** Derived display status for the Phaser map node. */
  status:
    | "locked"
    | "active"
    | "in_progress"
    | "partial"
    | "completed"
    | "gold";
  /** Whether Task 1 has been submitted and accepted. */
  t1: boolean;
  /** Whether Task 2 has been submitted and accepted. */
  t2: boolean;
  /** Whether Task 3 has been submitted and accepted. */
  t3: boolean;
  /** Whether the gold bonus has been earned (all 3 tasks completed). */
  goldBonusEarned?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// React → Phaser events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All events that the React layer may send to the Phaser game.
 * Use `eventBridge.dispatchToPhaser(event)` to emit these.
 *
 * Phaser scenes subscribe with `eventBridge.on(event.type, handler)`.
 */
export type ReactToPhaserEvent =
  /** Push a new world-brightness percentage (0–100) into the game. */
  | { type: "UPDATE_BRIGHTNESS"; brightness: number }
  /** Replace the full checkpoint state array rendered on the world map. */
  | { type: "UPDATE_CHECKPOINTS"; checkpoints: CheckpointState[] }
  /**
   * Tell the game which venture is active and which character sprite to use.
   * Should be dispatched once after the game boots and whenever the user
   * switches the active venture.
   */
  | {
      type: "SET_ACTIVE_VENTURE";
      ventureId: string;
      personaGender: "male" | "female";
      assignedBosses?: string[];
      currentStage?: number;
      corruptionLevel?: number;
      superBoss?: {
        bossSlug: string;
        bossName: string;
        visualStatus: "silhouette" | "present" | "foreground";
      };
    }
  /** Ask the camera to pan/zoom to bring a checkpoint node into view. */
  | { type: "SCROLL_TO_CHECKPOINT"; checkpointId: string }
  /** Pause the Phaser game loop (e.g. modal is open). */
  | { type: "GAME_PAUSE" }
  /** Resume the Phaser game loop after a pause. */
  | { type: "GAME_RESUME" }
  /**
   * Notify the game that the canvas container has been resized so it can
   * call `game.scale.resize()`.
   */
  | { type: "RESIZE"; width: number; height: number }
  /** Request to play a checkpoint completion animation. */
  | {
      type: "PLAY_CHECKPOINT_ANIMATION";
      checkpointId: string;
      stage: number;
      variant: "standard" | "gold";
    };

// ─────────────────────────────────────────────────────────────────────────────
// Phaser → React events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All events that the Phaser game may send to the React layer.
 * Use `eventBridge.dispatchToReact(event)` to emit these from a Phaser scene.
 *
 * React components subscribe with `useGameEvent(event.type, handler)` or
 * directly with `eventBridge.on(event.type, handler)`.
 */
export type PhaserToReactEvent =
  /** Emitted once the boot scene has finished and the game is interactive. */
  | { type: "PHASER_READY" }
  /**
   * User tapped/clicked a checkpoint node on the world map.
   * React should open the relevant checkpoint modal.
   */
  | {
      type: "CHECKPOINT_CLICKED";
      checkpointId: string;
      stage: number;
      checkpoint: number;
    }
  /** A Phaser scene has finished its `create()` lifecycle. */
  | { type: "SCENE_LOADED"; scene: string }
  /** Periodic frame-rate report from the game loop (throttled to ~1 Hz). */
  | { type: "FPS_UPDATE"; fps: number }
  /** An unrecoverable error occurred inside the game; React may show a fallback UI. */
  | { type: "ERROR"; message: string }
  /**
   * A badge has been awarded to the user.
   * React should display the BadgeAwardSequence overlay.
   */
  | {
      type: "BADGE_AWARDED";
      id: string;
      name: string;
      description: string;
      icon: string;
      rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
    }
  /**
   * A level-up has occurred.
   * React should display the LevelUpSequence overlay.
   */
  | {
      type: "LEVEL_UP";
      oldLevel: number;
      newLevel: number;
    }
  /** Checkpoint animation has completed playing. */
  | {
      type: "CHECKPOINT_ANIMATION_COMPLETE";
      checkpointId: string;
      stage: number;
    };

// ─────────────────────────────────────────────────────────────────────────────
// Internal listener registry types
// ─────────────────────────────────────────────────────────────────────────────

/** Generic event handler. Typed loosely so handlers can be stored uniformly. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventHandler = (event: any) => void;

/**
 * Internal namespace keys that separate Phaser-bound from React-bound
 * subscriber registries. A listener registered via `on('UPDATE_BRIGHTNESS')`
 * without a namespace lives in the global registry and receives events from
 * both directions.
 *
 * `dispatchToPhaser` emits to the `PHASER:` namespace.
 * `dispatchToReact`  emits to the `REACT:`  namespace.
 *
 * Phaser scenes should subscribe with the raw event type (no prefix) — the
 * bridge internally routes to the correct namespace.
 */
const PHASER_NS = "PHASER:" as const;
const REACT_NS = "REACT:" as const;

// ─────────────────────────────────────────────────────────────────────────────
// EventBridge class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Singleton bidirectional event bus for React ↔ Phaser communication.
 *
 * Key design decisions:
 * - **No dependencies**: plain `Map<string, Set<Function>>`, zero imports.
 * - **Namespaced routing**: `dispatchToPhaser` emits under a `PHASER:` prefix
 *   while `dispatchToReact` emits under `REACT:`. Subscribers registered with
 *   `on()` (without a prefix) are attached to *both* namespaces, making the
 *   common cases ergonomic while still allowing directional subscribers.
 * - **Idempotent off**: calling `off` for an unregistered handler is a no-op.
 * - **Synchronous emit**: handlers are invoked in insertion order, synchronously.
 *   This mirrors DOM event semantics and keeps the call graph predictable.
 */
class EventBridge {
  /**
   * Central listener registry.
   * Keys are plain event-type strings OR namespace-prefixed strings.
   *
   * Examples of keys in use:
   *   'PHASER:UPDATE_BRIGHTNESS'  ← only fired by dispatchToPhaser
   *   'REACT:PHASER_READY'        ← only fired by dispatchToReact
   */
  private readonly listeners: Map<string, Set<EventHandler>>;

  /** Tracks whether a warning about unhandled events has been issued. */
  private readonly warnedTypes: Set<string>;

  constructor() {
    this.listeners = new Map();
    this.warnedTypes = new Set();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Ensure a listener set exists for `key` and return it.
   */
  private bucket(key: string): Set<EventHandler> {
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    return set;
  }

  /**
   * Fire all handlers stored under `key`, passing `event` to each.
   * Errors thrown by individual handlers are caught and re-thrown after all
   * handlers have run, so one bad handler cannot silently block others.
   */
  private fire(key: string, event: unknown): void {
    const set = this.listeners.get(key);
    if (!set || set.size === 0) return;

    const errors: unknown[] = [];
    for (const handler of set) {
      try {
        handler(event);
      } catch (err) {
        errors.push(err);
      }
    }

    if (errors.length > 0) {
      // Re-throw the first error; remaining are logged.
      for (let i = 1; i < errors.length; i++) {
        console.error("[EventBridge] handler error:", errors[i]);
      }
      throw errors[0];
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Subscribe `handler` to events of `eventType`.
   *
   * The same handler registered for the same event type more than once is
   * deduplicated — only one invocation will occur per emit.
   *
   * @param eventType  The event `type` string, e.g. `'PHASER_READY'`.
   * @param handler    Callback invoked with the full event object.
   * @returns          An unsubscribe function for convenience.
   *
   * @example
   * // Phaser scene
   * const unsub = eventBridge.on('UPDATE_BRIGHTNESS', (e) => {
   *   this.applyBrightness(e.brightness)
   * })
   * // Later, in scene shutdown:
   * unsub()
   */
  on(eventType: string, handler: EventHandler): () => void {
    this.bucket(PHASER_NS + eventType).add(handler);
    this.bucket(REACT_NS + eventType).add(handler);
    return () => this.off(eventType, handler);
  }

  /**
   * Subscribe `handler` **only** to events dispatched toward Phaser
   * (`dispatchToPhaser`). Useful when a subscriber must not receive events
   * coming from the Phaser side.
   *
   * @param eventType  The `ReactToPhaserEvent` type string.
   * @param handler    Callback.
   * @returns          Unsubscribe function.
   */
  onPhaser(
    eventType: ReactToPhaserEvent["type"],
    handler: EventHandler,
  ): () => void {
    this.bucket(PHASER_NS + eventType).add(handler);
    return () => {
      this.listeners.get(PHASER_NS + eventType)?.delete(handler);
    };
  }

  /**
   * Subscribe `handler` **only** to events dispatched toward React
   * (`dispatchToReact`). Useful when a Phaser scene must not accidentally
   * pick up its own outgoing events reflected back.
   *
   * @param eventType  The `PhaserToReactEvent` type string.
   * @param handler    Callback.
   * @returns          Unsubscribe function.
   */
  onReact(
    eventType: PhaserToReactEvent["type"],
    handler: EventHandler,
  ): () => void {
    this.bucket(REACT_NS + eventType).add(handler);
    return () => {
      this.listeners.get(REACT_NS + eventType)?.delete(handler);
    };
  }

  /**
   * Remove a previously registered `handler` for `eventType`.
   * Safe to call with a handler that was never registered (no-op).
   *
   * @param eventType  The event `type` string.
   * @param handler    The exact handler reference passed to `on`.
   */
  off(eventType: string, handler: EventHandler): void {
    this.listeners.get(PHASER_NS + eventType)?.delete(handler);
    this.listeners.get(REACT_NS + eventType)?.delete(handler);
  }

  /**
   * Emit an arbitrary event to all subscribers of `eventType`.
   * Both the `PHASER:` and `REACT:` namespaced listeners will be invoked.
   *
   * Prefer `dispatchToPhaser` / `dispatchToReact` for typed dispatch.
   *
   * @param eventType  The event `type` string.
   * @param event      The full event payload (must include at minimum `{ type }`).
   */
  emit(eventType: string, event: unknown): void {
    let handled = false;

    const phaserSet = this.listeners.get(PHASER_NS + eventType);
    if (phaserSet && phaserSet.size > 0) {
      this.fire(PHASER_NS + eventType, event);
      handled = true;
    }

    const reactSet = this.listeners.get(REACT_NS + eventType);
    if (reactSet && reactSet.size > 0) {
      this.fire(REACT_NS + eventType, event);
      handled = true;
    }

    if (!handled && !this.warnedTypes.has(eventType)) {
      this.warnedTypes.add(eventType);
      console.warn(
        `[EventBridge] No listeners registered for event type "${eventType}". ` +
          `This warning is shown once per type.`,
      );
    }
  }

  /**
   * Send a typed event **from React toward the Phaser game**.
   *
   * Only listeners subscribed via `on()` or `onPhaser()` for this event type
   * will be invoked. Listeners that exclusively subscribed via `onReact()` will
   * NOT receive it.
   *
   * @param event  A well-typed `ReactToPhaserEvent` object.
   *
   * @example
   * eventBridge.dispatchToPhaser({ type: 'UPDATE_BRIGHTNESS', brightness: 65 })
   * eventBridge.dispatchToPhaser({ type: 'GAME_PAUSE' })
   */
  dispatchToPhaser(event: ReactToPhaserEvent): void {
    const key = PHASER_NS + event.type;
    const set = this.listeners.get(key);

    if (!set || set.size === 0) {
      if (!this.warnedTypes.has(key)) {
        this.warnedTypes.add(key);
        console.warn(
          `[EventBridge] dispatchToPhaser("${event.type}"): no Phaser listeners. ` +
            `Has the Phaser scene subscribed yet?`,
        );
      }
      return;
    }

    this.fire(key, event);
  }

  /**
   * Send a typed event **from the Phaser game toward React**.
   *
   * Only listeners subscribed via `on()` or `onReact()` for this event type
   * will be invoked.
   *
   * @param event  A well-typed `PhaserToReactEvent` object.
   *
   * @example
   * // Inside a Phaser scene:
   * eventBridge.dispatchToReact({ type: 'CHECKPOINT_CLICKED', checkpointId: id, stage: 2, checkpoint: 3 })
   */
  dispatchToReact(event: PhaserToReactEvent): void {
    const key = REACT_NS + event.type;
    const set = this.listeners.get(key);

    if (!set || set.size === 0) {
      if (!this.warnedTypes.has(key)) {
        this.warnedTypes.add(key);
        console.warn(
          `[EventBridge] dispatchToReact("${event.type}"): no React listeners. ` +
            `Is the relevant component mounted?`,
        );
      }
      return;
    }

    this.fire(key, event);
  }

  /**
   * Remove **all** listeners for every event type. Primarily useful in tests
   * to reset state between cases, or during full app teardown.
   *
   * @example
   * afterEach(() => eventBridge.removeAllListeners())
   */
  removeAllListeners(): void {
    this.listeners.clear();
    this.warnedTypes.clear();
  }

  /**
   * Returns the total number of handlers currently registered across all event
   * types and namespaces. Useful for debugging and leak detection.
   */
  listenerCount(): number {
    let total = 0;
    for (const set of this.listeners.values()) {
      total += set.size;
    }
    return total;
  }

  /**
   * Returns a snapshot of all currently registered event-type keys (with
   * namespace prefixes). Useful for debugging.
   *
   * @example
   * console.log(eventBridge.registeredTypes())
   * // ['PHASER:UPDATE_BRIGHTNESS', 'REACT:PHASER_READY', ...]
   */
  registeredTypes(): string[] {
    return Array.from(this.listeners.keys()).filter(
      (k) => (this.listeners.get(k)?.size ?? 0) > 0,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The application-wide singleton instance of the event bridge.
 *
 * Import this in both React components and Phaser scenes:
 * ```
 * import { eventBridge } from '@/lib/phaser/utils/event-bridge'
 * ```
 *
 * The same object reference is guaranteed across the entire module graph
 * (Next.js module caching) so React and Phaser always share one bus.
 */
export const eventBridge = new EventBridge();

// ─────────────────────────────────────────────────────────────────────────────
// React convenience hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * React hook that subscribes a handler to a bridge event type and
 * automatically unsubscribes when the component unmounts or when `eventType`
 * or `handler` change.
 *
 * The hook targets **both** directions (Phaser→React and React→Phaser) via
 * `eventBridge.on`. If you need to receive only events from one direction,
 * call `eventBridge.onReact` / `eventBridge.onPhaser` directly inside a
 * `useEffect`.
 *
 * @param eventType  Event `type` string to subscribe to.
 * @param handler    Stable callback reference. Wrap in `useCallback` if the
 *                   function is defined inline to avoid re-subscribing on
 *                   every render.
 *
 * @example
 * function WorldMap() {
 *   const handleClick = useCallback((e: PhaserToReactEvent) => {
 *     if (e.type === 'CHECKPOINT_CLICKED') openModal(e.checkpointId)
 *   }, [openModal])
 *
 *   useGameEvent('CHECKPOINT_CLICKED', handleClick)
 *   // ...
 * }
 */
export function useGameEvent(eventType: string, handler: EventHandler): void {
  // useGameEvent is a React hook — must only be called from React components.
  // React hooks are imported at the top of the file so they are never
  // called conditionally (satisfies the rules-of-hooks lint rule).

  // Keep a stable ref to the latest handler so the effect does not need to
  // re-subscribe every time an inline lambda changes identity.
  const handlerRef = useRef<EventHandler>(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const stableHandler: EventHandler = (event) => handlerRef.current(event);
    const unsubscribe = eventBridge.on(eventType, stableHandler);
    return unsubscribe;
  }, [eventType]); // Only re-subscribe when eventType changes.
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-export the class type for consumers that need it (e.g. for mocking)
// ─────────────────────────────────────────────────────────────────────────────
export type { EventBridge };
