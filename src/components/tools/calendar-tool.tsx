"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Check,
  Calendar as CalendarIcon,
  Clock,
  Milestone as MilestoneIcon,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  type: "event" | "milestone";
  date: Date;
  time?: string;
  title: string;
  description: string;
}

interface CalendarToolProps {
  prompt: string;
  onSubmit: (content: {
    events: CalendarEvent[];
    view: string;
    timestamp: number;
  }) => void;
  initialContent?: { events: CalendarEvent[]; view: string; timestamp: number };
  isSubmitting?: boolean;
  isStandalone?: boolean;
}

export function CalendarTool({
  prompt,
  onSubmit,
  initialContent,
  isSubmitting,
  isStandalone,
}: CalendarToolProps) {
  const [view, setView] = useState<"week" | "month">("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>(
    initialContent?.events?.map((e) => ({ ...e, date: new Date(e.date) })) ||
      [],
  );

  useEffect(() => {
    if (initialContent?.events) {
      setEvents(initialContent.events.map((e) => ({ ...e, date: new Date(e.date) })));
    }
  }, [initialContent]);

  // Form state
  const [showEventForm, setShowEventForm] = useState(false);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [eventFormData, setEventFormData] = useState({
    date: new Date(),
    time: "",
    title: "",
    description: "",
  });
  const [milestoneFormData, setMilestoneFormData] = useState({
    date: new Date(),
    title: "",
    description: "",
  });

  const addEvent = () => {
    if (!eventFormData.title.trim()) return;

    const newEvent: CalendarEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "event",
      date: eventFormData.date,
      time: eventFormData.time,
      title: eventFormData.title.trim(),
      description: eventFormData.description.trim(),
    };

    setEvents([...events, newEvent]);
    setEventFormData({
      date: new Date(),
      time: "",
      title: "",
      description: "",
    });
    setShowEventForm(false);
  };

  const addMilestone = () => {
    if (!milestoneFormData.title.trim()) return;

    const newMilestone: CalendarEvent = {
      id: `milestone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "milestone",
      date: milestoneFormData.date,
      title: milestoneFormData.title.trim(),
      description: milestoneFormData.description.trim(),
    };

    setEvents([...events, newMilestone]);
    setMilestoneFormData({ date: new Date(), title: "", description: "" });
    setShowMilestoneForm(false);
  };

  const deleteEvent = (id: string) => {
    setEvents(events.filter((e) => e.id !== id));
  };

  const getEventsForDate = (date: Date) => {
    return events.filter((e) => isSameDay(e.date, date));
  };

  const getWeekDays = () => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 0 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  };

  const handleSubmit = () => {
    if (events.length === 0) return;
    onSubmit({
      events,
      view,
      timestamp: Date.now(),
    });
  };

  const sortedEvents = [...events].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  const hasEvents = events.some((e) => e.type === "event");
  const hasMilestones = events.some((e) => e.type === "milestone");

  return (
    <div className="space-y-4">
      {/* Premium Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-white/10 shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-1">
            {format(selectedDate, "EEEE")}
          </p>
          <h2 className="text-2xl font-black text-white tracking-tight">
            {format(selectedDate, "MMMM d, yyyy")}
          </h2>
        </div>
        <CalendarIcon className="absolute right-[-10px] bottom-[-10px] w-24 h-24 text-white/5 -rotate-12" />
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as "week" | "month")}
            className="bg-black/20 p-1 rounded-xl border border-white/5"
          >
            <TabsList className="bg-transparent h-8">
              <TabsTrigger value="week" className="text-[10px] uppercase font-black px-3 h-6 rounded-lg data-[state=active]:bg-indigo-500 data-[state=active]:text-white">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-[10px] uppercase font-black px-3 h-6 rounded-lg data-[state=active]:bg-indigo-500 data-[state=active]:text-white">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-1 rounded-md">
          {events.length} {events.length === 1 ? "Item" : "Items"}
        </div>
      </div>

      {/* Calendar Display */}
      <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden shadow-2xl">
        {view === "month" ? (
          <div className="p-4">
            {/* Custom Month Grid */}
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400">
                {format(selectedDate, "MMMM yyyy")}
              </h3>
              <div className="flex gap-1">
                <button 
                  onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}
                  className="h-7 w-7 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg flex items-center justify-center transition-all"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </button>
                <button 
                  onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}
                  className="h-7 w-7 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg flex items-center justify-center transition-all"
                >
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 mb-2">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div key={day} className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {(() => {
                const start = startOfMonth(selectedDate);
                const end = endOfMonth(selectedDate);
                const startDay = startOfWeek(start);
                const endDay = endOfWeek(end);
                const days = eachDayOfInterval({ start: startDay, end: endDay });

                return days.map((day) => {
                  const isSelected = isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());
                  const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                  const dayEvents = getEventsForDate(day);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "h-10 w-full rounded-xl flex flex-col items-center justify-center text-xs font-bold transition-all duration-200 relative",
                        isSelected
                          ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 scale-110 z-10"
                          : isToday
                            ? "bg-indigo-500/10 border border-indigo-500/30 text-indigo-400"
                            : isCurrentMonth
                              ? "hover:bg-white/10 text-slate-300"
                              : "text-slate-700 opacity-20"
                      )}
                    >
                      <span>{format(day, "d")}</span>
                      {dayEvents.length > 0 && !isSelected && (
                        <div className="absolute bottom-1.5 w-1 h-1 rounded-full bg-indigo-400" />
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400/60 pb-2 border-b border-white/5">
              Week of {format(startOfWeek(selectedDate, { weekStartsOn: 0 }), "MMM d, yyyy")}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {getWeekDays().map((day) => {
                const dayEvents = getEventsForDate(day);
                const isToday = isSameDay(day, new Date());
                const isSelected = isSameDay(day, selectedDate);

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "flex flex-col items-center py-3 rounded-xl cursor-pointer transition-all duration-300 border",
                      isSelected
                        ? "bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/20 scale-105 z-10"
                        : isToday
                          ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                          : "bg-white/5 border-white/5 hover:bg-white/10 text-slate-400"
                    )}
                    onClick={() => setSelectedDate(day)}
                  >
                    <span className="text-[8px] font-black uppercase tracking-widest mb-1 opacity-60">
                      {format(day, "EEE")}
                    </span>
                    <span className="text-sm font-black">
                      {format(day, "d")}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="mt-1.5 flex gap-0.5">
                        {dayEvents.slice(0, 3).map((evt) => (
                          <div
                            key={evt.id}
                            className={cn(
                              "w-1 h-1 rounded-full",
                              evt.type === "event" ? "bg-blue-400" : "bg-amber-400"
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Quick Add Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowEventForm(!showEventForm);
            setShowMilestoneForm(false);
          }}
          className={cn(
            "flex-1 h-10 rounded-xl border-white/5 bg-white/5 font-black uppercase text-[10px] tracking-widest transition-all",
            showEventForm ? "bg-indigo-500 text-white border-indigo-500" : "hover:bg-white/10 text-slate-400"
          )}
        >
          <Plus className="h-3 w-3 mr-2" />
          Add Event
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowMilestoneForm(!showMilestoneForm);
            setShowEventForm(false);
          }}
          className={cn(
            "flex-1 h-10 rounded-xl border-white/5 bg-white/5 font-black uppercase text-[10px] tracking-widest transition-all",
            showMilestoneForm ? "bg-amber-500 text-white border-amber-500" : "hover:bg-white/10 text-slate-400"
          )}
        >
          <Plus className="h-3 w-3 mr-2" />
          Add Milestone
        </Button>
      </div>

      {/* Forms and Lists */}
      <div className="space-y-4">
        {/* Event Form */}
        {showEventForm && (
          <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-black text-white uppercase tracking-wider">New Event</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Time</Label>
                <Input
                  type="time"
                  value={eventFormData.time}
                  onChange={(e) => setEventFormData({ ...eventFormData, time: e.target.value })}
                  className="bg-black/20 border-white/10 h-9 text-xs rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Title</Label>
                <Input
                  placeholder="Event title..."
                  value={eventFormData.title}
                  onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                  className="bg-black/20 border-white/10 h-9 text-xs rounded-lg"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Description</Label>
              <Textarea
                placeholder="Details..."
                value={eventFormData.description}
                onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                className="bg-black/20 border-white/10 text-xs rounded-lg min-h-[60px]"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={addEvent} disabled={!eventFormData.title.trim()} className="flex-1 bg-indigo-500 hover:bg-indigo-600 h-9 text-xs font-bold rounded-lg">Create Event</Button>
              <Button variant="ghost" onClick={() => setShowEventForm(false)} className="text-xs font-bold h-9 rounded-lg">Cancel</Button>
            </div>
          </div>
        )}

        {/* Milestone Form */}
        {showMilestoneForm && (
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 mb-2">
              <MilestoneIcon className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-black text-white uppercase tracking-wider">New Milestone</h3>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Title</Label>
              <Input
                placeholder="Milestone title..."
                value={milestoneFormData.title}
                onChange={(e) => setMilestoneFormData({ ...milestoneFormData, title: e.target.value })}
                className="bg-black/20 border-white/10 h-9 text-xs rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Description</Label>
              <Textarea
                placeholder="Details..."
                value={milestoneFormData.description}
                onChange={(e) => setMilestoneFormData({ ...milestoneFormData, description: e.target.value })}
                className="bg-black/20 border-white/10 text-xs rounded-lg min-h-[60px]"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={addMilestone} disabled={!milestoneFormData.title.trim()} className="flex-1 bg-amber-500 hover:bg-amber-600 h-9 text-xs font-bold rounded-lg text-black">Create Milestone</Button>
              <Button variant="ghost" onClick={() => setShowMilestoneForm(false)} className="text-xs font-bold h-9 rounded-lg">Cancel</Button>
            </div>
          </div>
        )}

        {/* Events and Milestones List */}
        {sortedEvents.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Scheduled Items</h4>
              <div className="h-px flex-1 bg-white/5 mx-3" />
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {sortedEvents.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "p-3 rounded-xl border transition-all hover:scale-[1.01]",
                    item.type === "event"
                      ? "bg-indigo-500/5 border-indigo-500/10 hover:border-indigo-500/30"
                      : "bg-amber-500/5 border-amber-500/10 hover:border-amber-500/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {item.type === "event" ? (
                          <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                        )}
                        <span className="text-sm font-bold text-white">{item.title}</span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                        <span>{format(item.date, "MMM d")}</span>
                        {item.time && (
                          <>
                            <div className="w-1 h-1 rounded-full bg-slate-700" />
                            <span>{item.time}</span>
                          </>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-slate-400 leading-relaxed mt-1">{item.description}</p>
                      )}
                    </div>
                    <button
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all"
                      onClick={() => deleteEvent(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Section */}
        <div className="pt-4 border-t border-white/5 space-y-3">
          <Button
            onClick={handleSubmit}
            disabled={events.length === 0 || isSubmitting}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white h-12 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-500/20 transition-all"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                {isStandalone ? `Save Plan (${events.length})` : `Submit Plan (${events.length})`}
              </>
            )}
          </Button>

          {events.length === 0 && (
            <p className="text-[10px] text-center text-slate-600 font-bold uppercase tracking-widest">
              Add at least one item to proceed
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
