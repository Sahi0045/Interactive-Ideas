"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Shield, Trophy, Wrench } from "lucide-react";

interface MonumentDisplayProps {
  projectState: "in_progress" | "partial_project" | "project_complete" | "project_perfect";
  slainBosses: Array<{
    bossId: number;
    name: string;
    slayOutcome: string;
    status: string;
  }>;
}

const MONUMENT_META = {
  partial_project: {
    title: "Cracked Monument",
    description:
      "The venture has carved a path forward, but unfinished gold work still shows in the stone.",
    badge: "Partial Project",
    className:
      "border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-slate-900",
    icon: Wrench,
  },
  project_complete: {
    title: "Stone Monument",
    description:
      "The super boss is down. The monument stands solid, engraved with the venture that made it here.",
    badge: "Project Complete",
    className:
      "border-slate-400/30 bg-gradient-to-br from-slate-200/10 to-slate-900",
    icon: Trophy,
  },
  project_perfect: {
    title: "Golden Monument",
    description:
      "Every stage ended in gold. The monument transforms into a permanent legendary marker.",
    badge: "Project Perfect",
    className:
      "border-yellow-500/40 bg-gradient-to-br from-yellow-500/15 to-amber-900/40",
    icon: Crown,
  },
} as const;

export function MonumentDisplay({
  projectState,
  slainBosses,
}: MonumentDisplayProps) {
  if (projectState === "in_progress") return null;

  const meta = MONUMENT_META[projectState];
  const Icon = meta.icon;

  return (
    <Card className={meta.className}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-amber-400" />
            <CardTitle>{meta.title}</CardTitle>
          </div>
          <Badge variant="outline">{meta.badge}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{meta.description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{slainBosses.length} boss outcomes recorded</span>
          {projectState === "project_perfect" && (
            <Badge className="bg-yellow-500 text-black hover:bg-yellow-500">
              Legendary badge awarded
            </Badge>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {slainBosses.map((boss) => (
            <div
              key={boss.bossId}
              className="rounded-lg border border-white/10 bg-black/20 p-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-medium">{boss.name}</span>
                <Badge variant="outline" className="ml-auto">
                  {boss.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{boss.slayOutcome}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
