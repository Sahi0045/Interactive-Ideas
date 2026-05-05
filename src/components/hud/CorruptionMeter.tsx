"use client";

import { AlertTriangle } from "lucide-react";

interface CorruptionMeterProps {
  level: number;
  phase: "calm" | "creeping" | "desaturated" | "urgent" | "critical";
  bossName: string;
  bossHp: number;
  bossBaseHp: number;
  compact?: boolean;
}

const PHASE_STYLES = {
  calm: {
    label: "Stable",
    color: "text-violet-200",
    bar: "from-violet-500/70 to-fuchsia-400/70",
  },
  creeping: {
    label: "Creeping",
    color: "text-violet-100",
    bar: "from-violet-600 to-fuchsia-500",
  },
  desaturated: {
    label: "Corrupted",
    color: "text-amber-200",
    bar: "from-fuchsia-600 to-amber-500",
  },
  urgent: {
    label: "Urgent",
    color: "text-orange-200",
    bar: "from-amber-500 to-orange-500",
  },
  critical: {
    label: "Critical",
    color: "text-red-200",
    bar: "from-red-600 to-orange-500",
  },
} as const;

export function CorruptionMeter({
  level,
  phase,
  bossName,
  bossHp,
  bossBaseHp,
  compact = false,
}: CorruptionMeterProps) {
  const style = PHASE_STYLES[phase];
  const hpPercent =
    bossBaseHp > 0 ? Math.round((bossHp / bossBaseHp) * 100) : 0;

  if (compact) {
    return (
      <div className="flex min-w-[150px] items-center gap-2">
        <AlertTriangle className={`h-3.5 w-3.5 ${style.color}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[7px] font-black uppercase tracking-widest text-zinc-500">
              Corruption
            </span>
            <span className={`text-[10px] font-black ${style.color}`}>
              {Math.round(level)}%
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/25">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${style.bar}`}
              style={{ width: `${Math.max(4, level)}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[8px] text-zinc-500">
            <span className="truncate">{bossName}</span>
            <span>{hpPercent}% HP</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 ${style.color}`} />
            <span className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              Corruption
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-zinc-400">{bossName}</p>
        </div>
        <div className="text-right">
          <div className={`text-sm font-black ${style.color}`}>
            {Math.round(level)}%
          </div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">
            {style.label}
          </div>
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/25">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${style.bar}`}
          style={{ width: `${Math.max(4, level)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
        <span>Boss HP</span>
        <span>
          {bossHp}/{bossBaseHp}
        </span>
      </div>
    </div>
  );
}
