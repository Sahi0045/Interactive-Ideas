"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Megaphone, Plus, Radio, Trash2 } from "lucide-react";

interface PollResult {
  option: string;
  votes: number;
}

interface PollContent {
  question: string;
  options: string[];
  published: boolean;
  audience: string;
  expiresInHours: number;
  broadcastMessage: string;
  results: PollResult[];
}

interface PollToolProps {
  prompt: string;
  onSubmit: (content: PollContent) => void;
  initialContent?: PollContent;
  isSubmitting?: boolean;
}

export function PollTool({
  prompt,
  onSubmit,
  initialContent,
  isSubmitting,
}: PollToolProps) {
  const [question, setQuestion] = useState(initialContent?.question || "");
  const [options, setOptions] = useState<string[]>(initialContent?.options || ["", ""]);
  const [audience, setAudience] = useState(initialContent?.audience || "Community");
  const [expiresInHours, setExpiresInHours] = useState(
    initialContent?.expiresInHours || 72,
  );
  const [broadcastMessage, setBroadcastMessage] = useState(
    initialContent?.broadcastMessage || "",
  );
  const [published, setPublished] = useState(initialContent?.published || false);
  const [results, setResults] = useState<PollResult[]>(
    initialContent?.results ||
      (initialContent?.options || ["", ""]).map((option) => ({
        option,
        votes: 0,
      })),
  );

  useEffect(() => {
    if (!initialContent) return;
    setQuestion(initialContent.question || "");
    setOptions(initialContent.options || ["", ""]);
    setAudience(initialContent.audience || "Community");
    setExpiresInHours(initialContent.expiresInHours || 72);
    setBroadcastMessage(initialContent.broadcastMessage || "");
    setPublished(initialContent.published || false);
    setResults(
      initialContent.results ||
        (initialContent.options || ["", ""]).map((option) => ({
          option,
          votes: 0,
        })),
    );
  }, [initialContent]);

  const syncResults = (nextOptions: string[]) => {
    setResults((current) =>
      nextOptions.map((option, index) => {
        const existing = current[index];
        return {
          option,
          votes: existing?.votes || 0,
        };
      }),
    );
  };

  const addOption = () => {
    if (options.length >= 4) return;
    const nextOptions = [...options, ""];
    setOptions(nextOptions);
    syncResults(nextOptions);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    const nextOptions = options.filter((_option, optionIndex) => optionIndex !== index);
    setOptions(nextOptions);
    syncResults(nextOptions);
  };

  const updateOption = (index: number, value: string) => {
    const nextOptions = options.map((option, optionIndex) =>
      optionIndex === index ? value : option,
    );
    setOptions(nextOptions);
    syncResults(nextOptions);
  };

  const changeVotes = (index: number, delta: number) => {
    setResults((current) =>
      current.map((result, resultIndex) =>
        resultIndex === index
          ? { ...result, option: options[index], votes: Math.max(0, result.votes + delta) }
          : { ...result, option: options[resultIndex] },
      ),
    );
  };

  const totalVotes = useMemo(
    () => results.reduce((sum, result) => sum + result.votes, 0),
    [results],
  );

  const handlePublishToggle = () => {
    setPublished((current) => !current);
  };

  const handleSubmit = () => {
    if (!question.trim() || options.some((option) => !option.trim()) || !published) {
      return;
    }

    onSubmit({
      question,
      options,
      published,
      audience,
      expiresInHours,
      broadcastMessage,
      results: results.map((result, index) => ({
        option: options[index],
        votes: result.votes,
      })),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a Poll</CardTitle>
        <CardDescription>{prompt}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="poll-question">Question</Label>
          <Input
            id="poll-question"
            placeholder="What would you like to ask?"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-indigo-500" />
            <Label>Broadcast settings</Label>
            <Badge variant={published ? "default" : "outline"}>
              {published ? "Published" : "Draft"}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Audience</Label>
              <Input
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                placeholder="Community, beta users, advisors..."
              />
            </div>
            <div className="space-y-2">
              <Label>Expires in (hours)</Label>
              <Input
                type="number"
                min={1}
                value={expiresInHours}
                onChange={(event) =>
                  setExpiresInHours(Math.max(1, Number(event.target.value) || 1))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Broadcast message</Label>
            <Input
              value={broadcastMessage}
              onChange={(event) => setBroadcastMessage(event.target.value)}
              placeholder="Why should people answer this poll?"
            />
          </div>

          <Button type="button" variant="outline" onClick={handlePublishToggle}>
            <Radio className="h-4 w-4" />
            {published ? "Unpublish" : "Publish poll"}
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Options</Label>
          {options.map((option, index) => (
            <div key={`option-${index}`} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder={`Option ${index + 1}`}
                  value={option}
                  onChange={(event) => updateOption(index, event.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= 2}
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => changeVotes(index, -1)}>
                  -1
                </Button>
                <Badge variant="outline">{results[index]?.votes || 0} votes</Badge>
                <Button type="button" variant="outline" size="sm" onClick={() => changeVotes(index, 1)}>
                  +1
                </Button>
              </div>

              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-2 rounded-full bg-indigo-500 transition-all"
                  style={{
                    width: `${totalVotes > 0 ? ((results[index]?.votes || 0) / totalVotes) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addOption} size="sm" disabled={options.length >= 4}>
            <Plus className="mr-1 h-4 w-4" />
            Add Option
          </Button>
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label>Live preview</Label>
            <Badge variant="outline">{totalVotes} total votes</Badge>
          </div>
          <p className="text-sm font-medium">{question || "Untitled poll question"}</p>
          <div className="mt-3 space-y-2">
            {options.map((option, index) => (
              <div key={`preview-${index}`} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{option || `Option ${index + 1}`}</span>
                  <span>{results[index]?.votes || 0}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-indigo-500"
                    style={{
                      width: `${totalVotes > 0 ? ((results[index]?.votes || 0) / totalVotes) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!question.trim() || options.some((option) => !option.trim()) || !published || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Submit Poll
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
