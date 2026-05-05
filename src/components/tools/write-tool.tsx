"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bold,
  Check,
  Heading2,
  Italic,
  Lightbulb,
  Link2,
  List,
  Loader2,
  MessageSquareQuote,
  Sparkles,
  WandSparkles,
} from "lucide-react";

interface WriteToolProps {
  prompt: string;
  onSubmit: (content: { text: string; wordCount: number; markdown: string }) => void;
  initialContent?: string;
  isSubmitting?: boolean;
  layout?: "compact" | "wide";
}

interface WriteAssistPayload {
  suggestion: string;
  bullets: string[];
  rewrite: string;
  modelUsed: string;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);

  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-slate-200 px-1 py-0.5 text-[12px] dark:bg-slate-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="text-indigo-600 underline underline-offset-2 dark:text-indigo-300"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <Fragment key={index}>{part}</Fragment>;
  });
}

function renderMarkdownPreview(text: string) {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    nodes.push(
      <ul key={`list-${nodes.length}`} className="list-disc space-y-1 pl-5">
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      nodes.push(<div key={`spacer-${index}`} className="h-2" />);
      return;
    }

    if (trimmed.startsWith("- ")) {
      listItems.push(trimmed.slice(2));
      return;
    }

    flushList();

    if (trimmed.startsWith("## ")) {
      nodes.push(
        <h3 key={`h3-${index}`} className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          {renderInlineMarkdown(trimmed.slice(3))}
        </h3>,
      );
      return;
    }

    if (trimmed.startsWith("# ")) {
      nodes.push(
        <h2 key={`h2-${index}`} className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          {renderInlineMarkdown(trimmed.slice(2))}
        </h2>,
      );
      return;
    }

    if (trimmed.startsWith("> ")) {
      nodes.push(
        <blockquote
          key={`quote-${index}`}
          className="border-l-2 border-indigo-400 pl-3 italic text-slate-600 dark:text-slate-300"
        >
          {renderInlineMarkdown(trimmed.slice(2))}
        </blockquote>,
      );
      return;
    }

    nodes.push(
      <p key={`p-${index}`} className="leading-7 text-slate-700 dark:text-slate-200">
        {renderInlineMarkdown(trimmed)}
      </p>,
    );
  });

  flushList();
  return nodes;
}

export function WriteTool({
  prompt,
  onSubmit,
  initialContent,
  isSubmitting,
  layout = "wide",
}: WriteToolProps) {
  const [text, setText] = useState(initialContent || "");
  const [activeTab, setActiveTab] = useState("editor");
  const [assist, setAssist] = useState<WriteAssistPayload | null>(null);
  const [assistMode, setAssistMode] = useState<
    "outline" | "strengthen" | "sharpen" | null
  >(null);
  const [assistError, setAssistError] = useState<string | null>(null);

  const generateWriteAssist = useAction(api.aiScoring.generateWriteAssist);

  useEffect(() => {
    if (initialContent) setText(initialContent);
  }, [initialContent]);

  const wordCount = useMemo(
    () => (text.trim() ? text.trim().split(/\s+/).length : 0),
    [text],
  );
  const meetsRequirement = wordCount >= 50;

  const handleSubmit = () => {
    if (!text.trim() || wordCount < 50) return;
    onSubmit({ text, wordCount, markdown: text });
  };

  const insertAroundSelection = (prefix: string, suffix = "") => {
    const textarea = document.getElementById("write-response") as HTMLTextAreaElement | null;
    if (!textarea) {
      setText((current) => `${current}${prefix}${suffix}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.slice(start, end);
    const next = `${text.slice(0, start)}${prefix}${selected}${suffix}${text.slice(end)}`;
    setText(next);

    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + prefix.length + selected.length + suffix.length;
      textarea.setSelectionRange(caret, caret);
    });
  };

  const handleAssist = async (mode: "outline" | "strengthen" | "sharpen") => {
    setAssistMode(mode);
    setAssistError(null);
    try {
      const result = (await generateWriteAssist({
        prompt,
        draft: text,
        mode,
      })) as WriteAssistPayload;
      setAssist(result);
    } catch (error) {
      setAssistError(error instanceof Error ? error.message : "Assist failed");
    } finally {
      setAssistMode(null);
    }
  };

  return (
    <Card className="border-white/10 bg-[#0f172a]/70 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle>Write Your Response</CardTitle>
        <CardDescription>{prompt}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`grid gap-4 ${layout === "compact" ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]"}`}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => insertAroundSelection("## ")}>
            <Heading2 className="h-4 w-4" />
            Heading
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => insertAroundSelection("**", "**")}>
            <Bold className="h-4 w-4" />
            Bold
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => insertAroundSelection("*", "*")}>
            <Italic className="h-4 w-4" />
            Italic
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => insertAroundSelection("- ")}>
            <List className="h-4 w-4" />
            List
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => insertAroundSelection("> ")}>
            <MessageSquareQuote className="h-4 w-4" />
            Quote
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => insertAroundSelection("[label](", ")")}
          >
            <Link2 className="h-4 w-4" />
            Link
          </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="editor" className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="write-response">Markdown response</Label>
                  <Textarea
                    id="write-response"
                    placeholder="Write your response here..."
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    className="h-[200px] resize-none font-mono text-sm xl:h-[220px]"
                  />
                </div>
              </TabsContent>

              <TabsContent value="preview">
                <div className="h-[200px] overflow-y-auto space-y-3 rounded-lg border bg-slate-50 p-4 dark:bg-slate-950 xl:h-[220px]">
                  {text.trim() ? (
                    renderMarkdownPreview(text)
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Your markdown preview will render here.
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between gap-3 text-xs">
              <span
                className={
                  meetsRequirement
                    ? "font-medium text-green-600"
                    : "text-muted-foreground"
                }
              >
                {wordCount} / 50 words
              </span>
              {!meetsRequirement && wordCount > 0 && (
                <span className="text-amber-600">
                  {50 - wordCount} more word{50 - wordCount !== 1 ? "s" : ""} needed
                </span>
              )}
              {meetsRequirement && (
                <span className="font-medium text-green-600">Requirement met</span>
              )}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!text.trim() || wordCount < 50 || isSubmitting}
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
                  Submit Response
                </>
              )}
            </Button>
          </div>

          <div className="rounded-lg border bg-slate-50 p-4 dark:bg-slate-950">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  AI Assist
                </div>
                <p className="text-xs text-muted-foreground">
                  Generate an outline, strengthen the draft, or tighten the writing.
                </p>
              </div>
              {assist?.modelUsed && (
                <Badge variant="outline">{assist.modelUsed}</Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAssist("outline")}
                disabled={assistMode !== null}
              >
                {assistMode === "outline" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lightbulb className="h-4 w-4" />
                )}
                Outline
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAssist("strengthen")}
                disabled={assistMode !== null}
              >
                {assistMode === "strengthen" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Strengthen
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAssist("sharpen")}
                disabled={assistMode !== null}
              >
                {assistMode === "sharpen" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <WandSparkles className="h-4 w-4" />
                )}
                Sharpen
              </Button>
            </div>

            {assistError && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                {assistError}
              </p>
            )}

            {assist && (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Coaching note
                  </Label>
                  <p className="text-sm leading-6">{assist.suggestion}</p>
                </div>

                {assist.bullets.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Next additions
                    </Label>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
                      {assist.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {assist.rewrite && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        Suggested rewrite
                      </Label>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setText(assist.rewrite)}
                      >
                        Apply rewrite
                      </Button>
                    </div>
                    <div className="max-h-[180px] overflow-y-auto rounded-md border bg-white p-3 text-sm dark:bg-slate-900">
                      <div className="space-y-3">
                        {renderMarkdownPreview(assist.rewrite)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
