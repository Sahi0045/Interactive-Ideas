"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Trophy,
  Skull,
  Shield,
  Map,
  Play,
  LayoutDashboard,
  Calendar,
  MessageSquare,
  Video,
  Rss
} from "lucide-react";
import { VENTURE_STAGES } from "@convex/ventureConstants";
import type { Id } from "@convex/_generated/dataModel";
import { MonumentDisplay } from "@/components/venture/monument-display";

export default function VenturePageContent() {
  const params = useParams();
  const router = useRouter();
  const ventureId = params.id as string;

  const venture = useQuery(api.ventures.getVenture, {
    ventureId: ventureId as Id<"ventures">,
  });

  const progress = useQuery(api.ventures.getVentureProgress, {
    ventureId: ventureId as Id<"ventures">,
  });

  // Fetch the idea that this venture is based on for its title
  const idea = useQuery(
    api.ideas.getIdeaById,
    venture?.ideaId ? { ideaId: venture.ideaId } : "skip",
  );

  // Show loading state while data is being fetched
  if (!venture || !progress) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">
          Loading venture...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {idea?.title ??
                (venture.status === "active" ? "Active Venture" : "Venture")}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant={venture.status === "active" ? "default" : "secondary"}
              >
                {venture.status}
              </Badge>
              <Badge variant="outline">
                {venture.projectState.replace(/_/g, " ")}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Stage {venture.currentStage} of 8
              </span>
            </div>
          </div>
          {/* Open World Map CTA */}
          <div className="flex items-center gap-2 mt-4 md:mt-0">
            <Link href={`/map/world?ventureId=${ventureId}`}>
              <Button
                size="lg"
                className="gap-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/40 text-amber-400 hover:from-amber-500/30 hover:to-yellow-500/20 hover:text-amber-300 font-semibold tracking-wide shadow-lg shadow-amber-900/20"
                variant="ghost"
              >
                <Play className="h-4 w-4 fill-current" />
                Play World Map
                <Map className="h-4 w-4 ml-1 opacity-70" />
              </Button>
            </Link>
          </div>
        </div>

        {/* World Map Banner */}
        <div
          className="mb-6 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-950/40 via-yellow-950/20 to-transparent p-4 flex items-center justify-between gap-4"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xl">
              🗺️
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-300">
                Stage {venture.currentStage} —{" "}
                {VENTURE_STAGES.find((s) => s.id === venture.currentStage)
                  ?.name ?? "Unknown"}
              </p>
              <p className="text-xs text-amber-500/70">
                Checkpoint {venture.currentCheckpoint} · Open the world map to
                continue your journey
              </p>
            </div>
          </div>
          <Link href={`/map/world?ventureId=${ventureId}`}>
            <Button
              size="sm"
              className="gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs tracking-widest uppercase"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Enter Map
            </Button>
          </Link>
        </div>

        {/* Universal Tools Quick Access */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-5 gap-4">
          <Link href={`/venture/${ventureId}/feed`}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full border-indigo-500/20 hover:border-indigo-500/50">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
                <div className="p-3 bg-indigo-500/10 rounded-full">
                  <Rss className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Contributions</h3>
                  <p className="text-[10px] text-muted-foreground">Project Feed</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href={`/venture/${ventureId}/chat`}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full border-blue-500/20 hover:border-blue-500/50">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
                <div className="p-3 bg-blue-500/10 rounded-full">
                  <MessageSquare className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Group Chat</h3>
                  <p className="text-[10px] text-muted-foreground">Real-time sync</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href={`/venture/${ventureId}/video-call`}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full border-rose-500/20 hover:border-rose-500/50">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
                <div className="p-3 bg-rose-500/10 rounded-full">
                  <Video className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Video Call</h3>
                  <p className="text-[10px] text-muted-foreground">Live session</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href={`/venture/${ventureId}/kanban`}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full border-amber-500/20 hover:border-amber-500/50">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
                <div className="p-3 bg-amber-500/10 rounded-full">
                  <LayoutDashboard className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Kanban</h3>
                  <p className="text-[10px] text-muted-foreground">Task board</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href={`/venture/${ventureId}/calendar`}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full border-emerald-500/20 hover:border-emerald-500/50">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
                <div className="p-3 bg-emerald-500/10 rounded-full">
                  <Calendar className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Calendar</h3>
                  <p className="text-[10px] text-muted-foreground">Timeline</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Progress Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>Overall Completion</span>
                <span className="font-medium">
                  {progress.completionPercentage}%
                </span>
              </div>
              <Progress value={progress.completionPercentage} className="h-2" />
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">
                    {progress.completedCheckpoints}
                  </div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {progress.goldCheckpoints}
                  </div>
                  <div className="text-xs text-muted-foreground">Gold</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {progress.totalCheckpoints}
                  </div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {venture.projectState !== "in_progress" && (
          <div className="mb-8">
            <MonumentDisplay
              projectState={venture.projectState}
              slainBosses={venture.slainBosses}
            />
          </div>
        )}

        {/* Boss Encounters */}
        {venture.bosses.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Skull className="h-5 w-5" />
                Boss Encounters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {venture.bosses.map(
                  (boss: {
                    bossId: number;
                    status: string;
                    corruptionLevel: number;
                    currentHp?: number;
                    baseHp?: number;
                    visualStatus?: string;
                    definition?: { name: string; represents: string };
                  }) => {
                    const def = boss.definition;
                    if (!def) return null;
                    return (
                      <div
                        key={boss.bossId}
                        className="p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="h-4 w-4" />
                          <span className="font-semibold">{def.name}</span>
                          <Badge
                            variant={
                              boss.status === "slain"
                                ? "default"
                                : boss.status === "retreated"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {boss.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {def.represents}
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                          <span>Corruption:</span>
                          <Progress
                            value={boss.corruptionLevel}
                            className="flex-1 h-1.5"
                          />
                          <span>{boss.corruptionLevel}%</span>
                        </div>
                        {venture.superBoss && venture.superBoss.bossId === boss.bossId && (
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span>Boss HP:</span>
                            <Progress
                              value={
                                venture.superBoss.baseHp > 0
                                  ? (venture.superBoss.currentHp /
                                      venture.superBoss.baseHp) *
                                    100
                                  : 0
                              }
                              className="flex-1 h-1.5"
                            />
                            <span>
                              {venture.superBoss.currentHp}/{venture.superBoss.baseHp}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stage Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Stages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {progress.stageProgress.map(
                (stage: {
                  stage: number;
                  name: string;
                  completed: number;
                  total: number;
                  isComplete: boolean;
                  outcome: string;
                  monsterState: string;
                }) => (
                  <div
                    key={stage.stage}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
                  >
                    <div className="flex items-center gap-2 sm:min-w-[120px]">
                      {stage.isComplete ? (
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 shrink-0" />
                      ) : stage.completed > 0 ? (
                        <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                      )}
                    <span className="text-xs sm:text-sm font-medium truncate">
                      {stage.stage}: {stage.name}
                    </span>
                    <Badge variant="outline" className="ml-auto sm:ml-0">
                      {stage.outcome.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="outline">{stage.monsterState}</Badge>
                  </div>
                    <Progress
                      value={
                        stage.total > 0
                          ? (stage.completed / stage.total) * 100
                          : 0
                      }
                      className="flex-1 h-2"
                    />
                    <span className="text-xs text-muted-foreground sm:min-w-[60px] text-right self-end sm:self-auto">
                      {stage.completed}/{stage.total}
                    </span>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>

        {/* Navigate to current checkpoint */}
        <div className="mt-8 flex justify-center">
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={() =>
              router.push(
                `/venture/${ventureId}/stage/${venture.currentStage}/checkpoint/${venture.currentCheckpoint}`,
              )
            }
          >
            {venture.status === "completed"
              ? `Review Stage ${venture.currentStage}, Checkpoint ${venture.currentCheckpoint}`
              : `Continue to Stage ${venture.currentStage}, Checkpoint ${venture.currentCheckpoint}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
