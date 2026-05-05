"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Rocket, Skull, Shield, Loader2, Tags } from "lucide-react";
import { BOSS_DEFINITIONS } from "@convex/ventureConstants";
import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { SkillsMultiSelect } from "@/components/SkillsMultiSelect";
import { IndustriesMultiSelect } from "@/components/IndustriesMultiSelect";
import { Label } from "@/components/ui/label";

export default function VentureCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ideaId = searchParams.get("ideaId");
  const [creating, setCreating] = useState(false);
  const [selectedGender, setSelectedGender] = useState<
    "male" | "female" | null
  >(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);

  const ideas = useQuery(api.ideas.getUserIdeas, {});
  const createVenture = useMutation(api.ventures.createVenture);

  const selectedIdea = ideas?.find((i: { _id: string }) => i._id === ideaId);

  const handleCreate = async () => {
    if (!ideaId || !selectedGender) return;
    setCreating(true);
    try {
      const ventureId = await createVenture({
        ideaId: ideaId as Id<"ideas">,
        skills: selectedSkills.length > 0 ? selectedSkills : undefined,
        industries:
          selectedIndustries.length > 0 ? selectedIndustries : undefined,
      });

      // Save persona gender selection to localStorage for /map/world
      if (typeof window !== "undefined") {
        localStorage.setItem("selectedGender", selectedGender);
        localStorage.setItem("activeVentureId", ventureId);
      }

      // Redirect to world map with the new venture
      router.push(`/map/world?ventureId=${ventureId}`);
    } catch (error) {
      console.error("Failed to create venture:", error);
      setCreating(false);
    }
  };

  if (!ideas) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Convert to Venture</h1>
            <p className="text-sm text-muted-foreground">
              Turn your idea into a guided 8-stage journey
            </p>
          </div>
        </div>

        {!selectedIdea && ideas.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Select an Idea</CardTitle>
              <CardDescription>
                Choose which idea you want to turn into a venture
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ideas.map((idea) => (
                  <Button
                    key={idea._id}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-3 px-4"
                    onClick={() =>
                      router.push(`/venture/create?ideaId=${idea._id}`)
                    }
                  >
                    <div>
                      <div className="font-medium">{idea.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {idea.description}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {selectedIdea && (
          <>
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>{selectedIdea.title}</CardTitle>
                <CardDescription>{selectedIdea.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline">{selectedIdea.category}</Badge>
                    {selectedIdea.visibility === "private" && (
                      <Badge variant="secondary">Private</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5" />
                  What You'll Get
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />8
                    structured stages from ideation to scale
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    36 checkpoints with guided tasks
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Built-in tools for writing, tables, links, uploads
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Boss encounters that challenge your progress
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Points and badges for completing milestones
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Skull className="h-5 w-5" />
                  Boss Encounters
                </CardTitle>
                <CardDescription>
                  Each venture faces 1 random super boss from a pool of 12
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2">
                  {BOSS_DEFINITIONS.slice(0, 6).map((boss) => (
                    <div
                      key={boss.id}
                      className="flex items-center gap-2 p-2 rounded border text-sm"
                    >
                      <Shield className="h-4 w-4 shrink-0" />
                      <span className="truncate">{boss.name}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  + 6 more bosses you might encounter
                </p>
              </CardContent>
            </Card>

            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tags className="h-5 w-5" />
                  Tags & Focus Areas
                </CardTitle>
                <CardDescription>
                  Select skills and industries to help personalize your venture
                  journey
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Skills */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Skills (Max 5)
                    </Label>
                    <SkillsMultiSelect
                      selectedSkills={selectedSkills}
                      onChange={(skills) => setSelectedSkills(skills)}
                      maxSelection={5}
                      placeholder="Select relevant skills..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional: Choose skills relevant to this venture
                    </p>
                  </div>

                  {/* Industries */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Industries (Max 4)
                    </Label>
                    <IndustriesMultiSelect
                      selectedIndustries={selectedIndustries}
                      onChange={(industries) =>
                        setSelectedIndustries(industries)
                      }
                      maxSelection={4}
                      placeholder="Select target industries..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional: Choose industries this venture targets
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Choose Your Persona</CardTitle>
                <CardDescription>
                  Select the character that will represent you on your journey
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <button
                    onClick={() => setSelectedGender("male")}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedGender === "male"
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-border hover:border-blue-500/50"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-4xl mb-2">👨‍💼</div>
                      <div className="font-semibold">Male</div>
                      <div className="text-xs text-muted-foreground">
                        The Strategic Engineer
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedGender("female")}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedGender === "female"
                        ? "border-purple-500 bg-purple-500/10"
                        : "border-border hover:border-purple-500/50"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-4xl mb-2">👩‍💼</div>
                      <div className="font-semibold">Female</div>
                      <div className="text-xs text-muted-foreground">
                        The Visionary Lead
                      </div>
                    </div>
                  </button>
                </div>
              </CardContent>
            </Card>

            <Button
              size="lg"
              onClick={handleCreate}
              disabled={creating || !selectedGender}
              className="w-full"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating Venture...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-5 w-5" />
                  {selectedGender
                    ? "Start This Venture"
                    : "Select Persona First"}
                </>
              )}
            </Button>
          </>
        )}

        {ideas.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">
                You don't have any ideas yet. Create an idea first, then convert
                it to a venture.
              </p>
              <Button
                className="mt-4"
                onClick={() => router.push("/create-idea")}
              >
                Create an Idea
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
