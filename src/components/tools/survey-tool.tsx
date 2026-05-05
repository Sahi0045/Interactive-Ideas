"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Plus, Send, Trash2, Users } from "lucide-react";

interface SurveyQuestion {
  id: string;
  text: string;
  type: "text" | "multiple_choice";
  options?: string[];
}

interface SurveyResponse {
  id: string;
  respondent: string;
  submittedAt: number;
  answers: Record<string, string>;
}

interface SurveyContent {
  questions: SurveyQuestion[];
  responses?: SurveyResponse[];
  distribution?: {
    channels: string[];
    shareNote: string;
  };
}

interface SurveyToolProps {
  prompt: string;
  onSubmit: (content: SurveyContent) => void;
  initialContent?: SurveyContent;
  isSubmitting?: boolean;
}

const CHANNELS = ["Email", "Community", "Direct outreach", "Interview follow-up"];

export function SurveyTool({
  prompt,
  onSubmit,
  initialContent,
  isSubmitting,
}: SurveyToolProps) {
  const [questions, setQuestions] = useState<SurveyQuestion[]>(
    initialContent?.questions || [{ id: "1", text: "", type: "text" }],
  );
  const [responses, setResponses] = useState<SurveyResponse[]>(
    initialContent?.responses || [],
  );
  const [respondent, setRespondent] = useState("");
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [shareNote, setShareNote] = useState(
    initialContent?.distribution?.shareNote || "",
  );
  const [channels, setChannels] = useState<string[]>(
    initialContent?.distribution?.channels || ["Community"],
  );

  useEffect(() => {
    if (!initialContent) return;
    setQuestions(initialContent.questions || [{ id: "1", text: "", type: "text" }]);
    setResponses(initialContent.responses || []);
    setShareNote(initialContent.distribution?.shareNote || "");
    setChannels(initialContent.distribution?.channels || ["Community"]);
  }, [initialContent]);

  const addQuestion = () => {
    setQuestions((current) => [
      ...current,
      { id: Date.now().toString(), text: "", type: "text" },
    ]);
  };

  const updateQuestion = (id: string, updates: Partial<SurveyQuestion>) => {
    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? { ...question, ...updates } : question,
      ),
    );
  };

  const removeQuestion = (id: string) => {
    if (questions.length <= 1) return;
    setQuestions((current) => current.filter((question) => question.id !== id));
  };

  const addOption = (questionId: string) => {
    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? { ...question, options: [...(question.options || []), ""] }
          : question,
      ),
    );
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? {
              ...question,
              options: (question.options || []).map((option, index) =>
                index === optionIndex ? value : option,
              ),
            }
          : question,
      ),
    );
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? {
              ...question,
              options: (question.options || []).filter(
                (_option, index) => index !== optionIndex,
              ),
            }
          : question,
      ),
    );
  };

  const toggleChannel = (channel: string) => {
    setChannels((current) =>
      current.includes(channel)
        ? current.filter((entry) => entry !== channel)
        : [...current, channel],
    );
  };

  const addResponse = () => {
    const ready =
      respondent.trim() &&
      questions.every((question) => {
        const answer = draftAnswers[question.id]?.trim();
        return !!question.text.trim() && !!answer;
      });

    if (!ready) return;

    setResponses((current) => [
      ...current,
      {
        id: Date.now().toString(),
        respondent: respondent.trim(),
        submittedAt: Date.now(),
        answers: draftAnswers,
      },
    ]);
    setRespondent("");
    setDraftAnswers({});
  };

  const removeResponse = (responseId: string) => {
    setResponses((current) =>
      current.filter((response) => response.id !== responseId),
    );
  };

  const summary = useMemo(() => {
    return questions.map((question) => {
      if (question.type === "multiple_choice") {
        const counts = (question.options || []).map((option) => ({
          option,
          count: responses.filter(
            (response) => response.answers[question.id] === option,
          ).length,
        }));
        return { questionId: question.id, counts };
      }

      return {
        questionId: question.id,
        textResponses: responses
          .map((response) => response.answers[question.id])
          .filter(Boolean),
      };
    });
  }, [questions, responses]);

  const handleSubmit = () => {
    const allFilled = questions.every((question) => question.text.trim());
    const optionsValid = questions.every(
      (question) =>
        question.type !== "multiple_choice" ||
        ((question.options || []).length >= 2 &&
          (question.options || []).every((option) => option.trim())),
    );

    if (!allFilled || !optionsValid || responses.length === 0) return;

    onSubmit({
      questions,
      responses,
      distribution: {
        channels,
        shareNote,
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Build Your Survey</CardTitle>
        <CardDescription>{prompt}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="builder">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="responses">Responses</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="space-y-6">
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-2">
                <Send className="h-4 w-4 text-indigo-500" />
                <Label>Distribution</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => toggleChannel(channel)}
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      channels.includes(channel)
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                        : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {channel}
                  </button>
                ))}
              </div>
              <Textarea
                className="mt-3 min-h-[90px]"
                placeholder="How did you distribute this survey, and what audience did it reach?"
                value={shareNote}
                onChange={(event) => setShareNote(event.target.value)}
              />
            </div>

            {questions.map((question, questionIndex) => (
              <div key={question.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Question {questionIndex + 1}
                  </Label>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeQuestion(question.id)}
                    disabled={questions.length <= 1}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <Input
                  placeholder="Enter your question..."
                  value={question.text}
                  onChange={(event) =>
                    updateQuestion(question.id, { text: event.target.value })
                  }
                />

                <RadioGroup
                  value={question.type}
                  onValueChange={(value: "text" | "multiple_choice") =>
                    updateQuestion(question.id, {
                      type: value,
                      options: value === "multiple_choice" ? ["", ""] : undefined,
                    })
                  }
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="text" id={`survey-text-${question.id}`} />
                    <Label htmlFor={`survey-text-${question.id}`} className="text-xs">
                      Text response
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value="multiple_choice"
                      id={`survey-mc-${question.id}`}
                    />
                    <Label htmlFor={`survey-mc-${question.id}`} className="text-xs">
                      Multiple choice
                    </Label>
                  </div>
                </RadioGroup>

                {question.type === "multiple_choice" && (
                  <div className="space-y-2 pl-2">
                    {(question.options || []).map((option, optionIndex) => (
                      <div key={`${question.id}-${optionIndex}`} className="flex items-center gap-2">
                        <Input
                          placeholder={`Option ${optionIndex + 1}`}
                          value={option}
                          onChange={(event) =>
                            updateOption(question.id, optionIndex, event.target.value)
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOption(question.id, optionIndex)}
                          disabled={(question.options?.length || 0) <= 2}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => addOption(question.id)}>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add option
                    </Button>
                  </div>
                )}
              </div>
            ))}

            <Button variant="outline" onClick={addQuestion} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Question
            </Button>
          </TabsContent>

          <TabsContent value="responses" className="space-y-4">
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />
                <Label>Capture response</Label>
              </div>
              <Input
                placeholder="Respondent name or segment"
                value={respondent}
                onChange={(event) => setRespondent(event.target.value)}
              />

              {questions.map((question) => (
                <div key={`response-${question.id}`} className="space-y-2">
                  <Label>{question.text || "Untitled question"}</Label>
                  {question.type === "multiple_choice" ? (
                    <RadioGroup
                      value={draftAnswers[question.id] || ""}
                      onValueChange={(value) =>
                        setDraftAnswers((current) => ({
                          ...current,
                          [question.id]: value,
                        }))
                      }
                    >
                      {(question.options || []).map((option) => (
                        <div key={option} className="flex items-center gap-2">
                          <RadioGroupItem
                            value={option}
                            id={`${question.id}-${option}`}
                          />
                          <Label htmlFor={`${question.id}-${option}`}>{option || "Untitled option"}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <Textarea
                      placeholder="Enter the respondent's answer"
                      value={draftAnswers[question.id] || ""}
                      onChange={(event) =>
                        setDraftAnswers((current) => ({
                          ...current,
                          [question.id]: event.target.value,
                        }))
                      }
                    />
                  )}
                </div>
              ))}

              <Button variant="outline" onClick={addResponse} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Response
              </Button>
            </div>

            <div className="space-y-3">
              {responses.map((response) => (
                <div key={response.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{response.respondent}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(response.submittedAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeResponse(response.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="space-y-2 text-sm">
                    {questions.map((question) => (
                      <div key={`${response.id}-${question.id}`}>
                        <span className="font-medium">{question.text}: </span>
                        <span className="text-muted-foreground">
                          {response.answers[question.id] || "No answer"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="summary" className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{responses.length} responses</Badge>
              <Badge variant="outline">{channels.length} channels used</Badge>
            </div>

            {questions.map((question) => {
              const entry = summary.find((item) => item.questionId === question.id);
              if (!entry) return null;

              if ("counts" in entry) {
                const counts = entry.counts || [];
                const maxCount = Math.max(
                  1,
                  ...counts.map((count) => count.count),
                );

                return (
                  <div key={question.id} className="rounded-lg border p-4 space-y-3">
                    <Label>{question.text}</Label>
                    {counts.map((count) => (
                      <div key={`${question.id}-${count.option}`} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{count.option || "Untitled option"}</span>
                          <span>{count.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className="h-2 rounded-full bg-indigo-500"
                            style={{ width: `${(count.count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }

              return (
                <div key={question.id} className="rounded-lg border p-4 space-y-3">
                  <Label>{question.text}</Label>
                  <div className="space-y-2">
                    {entry.textResponses.length > 0 ? (
                      entry.textResponses.map((answer, index) => (
                        <p
                          key={`${question.id}-answer-${index}`}
                          className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950"
                        >
                          {answer}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No text responses yet.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>

        <Button
          onClick={handleSubmit}
          disabled={
            isSubmitting ||
            responses.length === 0 ||
            !questions.every((question) => question.text.trim())
          }
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
              Submit Survey
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
