"use client";

import { useState, useMemo } from "react";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { CalendarIcon, PlusCircle, BookOpen, Clock, Users, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleType = "MWF" | "TTH" | "FS";

type ClassroomSchedule = {
  id: number;
  classroom_name: string;
  subject_name: string;
  instructor: string;
  schedule_type: ScheduleType;
  start_date: string;
  end_date: string;
  time_start: string;
  time_end: string;
  status?: "Active" | "Upcoming" | "Completed";
};

// ─── Constants ────────────────────────────────────────────────────────────────

// 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
const SCHEDULE_DAYS: Record<ScheduleType, number[]> = {
  MWF: [1, 3, 5],
  TTH: [2, 4],
  FS:  [5, 6],
};

const SCHEDULE_LABELS: Record<ScheduleType, string> = {
  MWF: "Mon · Wed · Fri",
  TTH: "Tue · Thu",
  FS:  "Fri · Sat",
};

const scheduleTypeColor: Record<ScheduleType, string> = {
  MWF: "bg-purple-100 text-purple-700 border-purple-200",
  TTH: "bg-amber-100 text-amber-700 border-amber-200",
  FS:  "bg-teal-100 text-teal-700 border-teal-200",
};

const statusColor: Record<string, string> = {
  Active:    "bg-green-100 text-green-700 border-green-200",
  Upcoming:  "bg-blue-100 text-blue-700 border-blue-200",
  Completed: "bg-gray-100 text-gray-500 border-gray-200",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSessionDatesInRange(
  schedule: ClassroomSchedule,
  filterStart: Date,
  filterEnd: Date
): Date[] {
  const schedStart = parseISO(schedule.start_date);
  const schedEnd   = parseISO(schedule.end_date);

  const windowStart = filterStart > schedStart ? filterStart : schedStart;
  const windowEnd   = filterEnd   < schedEnd   ? filterEnd   : schedEnd;

  if (windowStart > windowEnd) return [];

  const allowedDays = SCHEDULE_DAYS[schedule.schedule_type];
  return eachDayOfInterval({ start: windowStart, end: windowEnd }).filter(
    (d) => allowedDays.includes(d.getDay())
  );
}

// ─── Session Chip ─────────────────────────────────────────────────────────────

const SessionChip: React.FC<{ date: Date }> = ({ date }) => (
  <span className="inline-block bg-gray-100 text-gray-700 text-[10px] font-medium px-2 py-0.5 rounded-full border border-gray-200">
    {format(date, "MMM d")}
  </span>
);

// ─── Schedule Card ────────────────────────────────────────────────────────────

type ScheduleCardProps = ClassroomSchedule & {
  sessionDates?: Date[];
  onSelectClick?: (schedule: ClassroomSchedule, sessionDates?: Date[]) => void;
};

const ScheduleCard: React.FC<ScheduleCardProps> = (props) => {
  const {
    classroom_name,
    subject_name,
    instructor,
    schedule_type,
    start_date,
    end_date,
    time_start,
    time_end,
    status = "Active",
    sessionDates,
    onSelectClick,
  } = props;

  const [showAll, setShowAll] = useState(false);
  const PREVIEW_LIMIT = 6;
  const visible = showAll ? (sessionDates ?? []) : (sessionDates ?? []).slice(0, PREVIEW_LIMIT);

  return (
    <Card className="w-full hover:shadow-md transition-shadow border border-gray-200">
      <CardContent className="pt-5 pb-4 space-y-3">

        {/* Subject + Room + Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 p-1.5 rounded-md">
              <BookOpen className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">{subject_name}</p>
              <p className="text-xs text-muted-foreground">{classroom_name}</p>
            </div>
          </div>
          <Badge
            className={`text-[10px] px-2 py-0.5 border font-medium ${statusColor[status]}`}
            variant="outline"
          >
            {status}
          </Badge>
        </div>

        {/* Schedule type */}
        <Badge
          className={`text-[10px] px-2 py-0.5 border font-semibold ${scheduleTypeColor[schedule_type]}`}
          variant="outline"
        >
          {schedule_type} · {SCHEDULE_LABELS[schedule_type]}
        </Badge>

        {/* Instructor */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>{instructor}</span>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>
            {new Date(start_date).toLocaleDateString()} –{" "}
            {new Date(end_date).toLocaleDateString()}
          </span>
        </div>

        {/* Time */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>{time_start} – {time_end}</span>
        </div>

        {/* Session dates (only when date range filter is active) */}
        {sessionDates && sessionDates.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{sessionDates.length} session{sessionDates.length !== 1 ? "s" : ""} in range</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {visible.map((d, i) => <SessionChip key={i} date={d} />)}
              {sessionDates.length > PREVIEW_LIMIT && (
                <button
                  onClick={() => setShowAll((p) => !p)}
                  className="text-[10px] text-blue-500 underline ml-1 self-center"
                >
                  {showAll ? "Show less" : `+${sessionDates.length - PREVIEW_LIMIT} more`}
                </button>
              )}
            </div>
          </div>
        )}

        <Button
          size="sm"
          className="mt-1 w-full bg-blue-500 hover:bg-blue-600 text-white text-xs"
          onClick={() => onSelectClick && onSelectClick(props, sessionDates)}
        >
          View Details
        </Button>
      </CardContent>
    </Card>
  );
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_SCHEDULES: ClassroomSchedule[] = [
  {
    id: 1,
    classroom_name: "Room 101",
    subject_name: "Mathematics",
    instructor: "Mr. Santos",
    schedule_type: "MWF",
    start_date: "2026-03-01",
    end_date: "2026-06-01",
    time_start: "08:00",
    time_end: "10:00",
    status: "Active",
  },
  {
    id: 2,
    classroom_name: "Room 202",
    subject_name: "Science",
    instructor: "Ms. Reyes",
    schedule_type: "TTH",
    start_date: "2026-03-01",
    end_date: "2026-06-15",
    time_start: "10:30",
    time_end: "12:00",
    status: "Active",
  },
  {
    id: 3,
    classroom_name: "Lab A",
    subject_name: "Computer Science",
    instructor: "Mr. Cruz",
    schedule_type: "MWF",
    start_date: "2026-03-15",
    end_date: "2026-07-01",
    time_start: "13:00",
    time_end: "15:00",
    status: "Upcoming",
  },
  {
    id: 4,
    classroom_name: "Room 305",
    subject_name: "Filipino",
    instructor: "Ms. Garcia",
    schedule_type: "FS",
    start_date: "2026-03-01",
    end_date: "2026-05-30",
    time_start: "09:00",
    time_end: "11:00",
    status: "Active",
  },
  {
    id: 5,
    classroom_name: "Room 110",
    subject_name: "English",
    instructor: "Ms. Lim",
    schedule_type: "TTH",
    start_date: "2026-03-05",
    end_date: "2026-06-05",
    time_start: "14:00",
    time_end: "16:00",
    status: "Active",
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

const ClassroomSchedules: React.FC = () => {
  // Filter state
  const [filterClassroom,   setFilterClassroom]   = useState("");
  const [filterSubject,     setFilterSubject]     = useState("");
  const [filterStatus,      setFilterStatus]      = useState("all");
  const [filterSchedType,   setFilterSchedType]   = useState<"all" | ScheduleType>("all");
  const [filterRangeStart,  setFilterRangeStart]  = useState<Date | undefined>();
  const [filterRangeEnd,    setFilterRangeEnd]    = useState<Date | undefined>();

  // New schedule form state
  const [isSheetOpen,    setIsSheetOpen]    = useState(false);
  const [classroomName,  setClassroomName]  = useState("");
  const [subjectName,    setSubjectName]    = useState("");
  const [instructor,     setInstructor]     = useState("");
  const [scheduleType,   setScheduleType]   = useState<ScheduleType | "">("");
  const [startDate,      setStartDate]      = useState<Date | undefined>();
  const [endDate,        setEndDate]        = useState<Date | undefined>();
  const [timeStart,      setTimeStart]      = useState("");
  const [timeEnd,        setTimeEnd]        = useState("");

  // Schedule list
  const [schedules, setSchedules] = useState<ClassroomSchedule[]>(MOCK_SCHEDULES);

  // Detail sheet
  const [isDetailOpen,         setIsDetailOpen]         = useState(false);
  const [selectedSchedule,     setSelectedSchedule]     = useState<ClassroomSchedule | null>(null);
  const [selectedSessionDates, setSelectedSessionDates] = useState<Date[]>([]);

  // ── Computed ─────────────────────────────────────────────────────────────

  const hasDateFilter = !!filterRangeStart && !!filterRangeEnd;

  const filteredResults = useMemo(() => {
    return schedules
      .filter((s) => {
        if (!s.classroom_name.toLowerCase().includes(filterClassroom.toLowerCase())) return false;
        if (!s.subject_name.toLowerCase().includes(filterSubject.toLowerCase())) return false;
        if (filterStatus !== "all" && s.status !== filterStatus) return false;
        if (filterSchedType !== "all" && s.schedule_type !== filterSchedType) return false;

        if (hasDateFilter) {
          const sStart = parseISO(s.start_date);
          const sEnd   = parseISO(s.end_date);
          if (sStart > filterRangeEnd! || sEnd < filterRangeStart!) return false;
        }

        return true;
      })
      .map((s) => ({
        schedule: s,
        sessionDates: hasDateFilter
          ? getSessionDatesInRange(s, filterRangeStart!, filterRangeEnd!)
          : undefined,
      }))
      .filter(({ sessionDates }) =>
        hasDateFilter ? (sessionDates?.length ?? 0) > 0 : true
      );
  }, [schedules, filterClassroom, filterSubject, filterStatus, filterSchedType, filterRangeStart, filterRangeEnd, hasDateFilter]);

  // Preview sessions when creating a new schedule
  const formSessionPreview = useMemo(() => {
    if (!scheduleType || !startDate || !endDate) return [];
    return getSessionDatesInRange(
      { schedule_type: scheduleType as ScheduleType, start_date: startDate.toISOString().split("T")[0], end_date: endDate.toISOString().split("T")[0] } as ClassroomSchedule,
      startDate,
      endDate
    );
  }, [scheduleType, startDate, endDate]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSaveSchedule = () => {
    if (!classroomName || !subjectName || !instructor || !scheduleType || !startDate || !endDate || !timeStart || !timeEnd) {
      alert("Please fill in all fields.");
      return;
    }
    setSchedules((prev) => [
      ...prev,
      {
        id: Date.now(),
        classroom_name: classroomName,
        subject_name: subjectName,
        instructor,
        schedule_type: scheduleType as ScheduleType,
        start_date: startDate.toISOString().split("T")[0],
        end_date:   endDate.toISOString().split("T")[0],
        time_start: timeStart,
        time_end:   timeEnd,
        status: "Upcoming",
      },
    ]);
    setIsSheetOpen(false);
    setClassroomName(""); setSubjectName(""); setInstructor("");
    setScheduleType(""); setStartDate(undefined); setEndDate(undefined);
    setTimeStart(""); setTimeEnd("");
  };

  const handleSelectClick = (schedule: ClassroomSchedule, sessionDates?: Date[]) => {
    setSelectedSchedule(schedule);
    setSelectedSessionDates(sessionDates ?? []);
    setIsDetailOpen(true);
  };

  const handleClearFilters = () => {
    setFilterClassroom(""); setFilterSubject("");
    setFilterStatus("all"); setFilterSchedType("all");
    setFilterRangeStart(undefined); setFilterRangeEnd(undefined);
  };

  const hasActiveFilters =
    filterClassroom || filterSubject || filterStatus !== "all" ||
    filterSchedType !== "all" || hasDateFilter;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="p-4 space-y-4">

        {/* ── Filter Card ── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg font-semibold">Classroom Schedules</CardTitle>
              <div className="flex gap-2">
                {hasActiveFilters && (
                  <Button size="sm" variant="ghost" onClick={handleClearFilters} className="text-xs text-red-500 hover:text-red-600">
                    Clear Filters
                  </Button>
                )}
                <Button
                  size="sm"
                  className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white"
                  onClick={() => setIsSheetOpen(true)}
                >
                  <PlusCircle className="w-4 h-4" />
                  New Schedule
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Row 1 — text search + dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <Input
                placeholder="Search classroom..."
                value={filterClassroom}
                onChange={(e) => setFilterClassroom(e.target.value)}
              />
              <Input
                placeholder="Search subject..."
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
              />

              <Select value={filterSchedType} onValueChange={(v) => setFilterSchedType(v as "all" | ScheduleType)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Schedule Type</SelectLabel>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="MWF">MWF – Mon · Wed · Fri</SelectItem>
                    <SelectItem value="TTH">TTH – Tue · Thu</SelectItem>
                    <SelectItem value="FS">FS – Fri · Sat</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Status</SelectLabel>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Upcoming">Upcoming</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Row 2 — Date range filter */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                Filter sessions by date:
              </span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-start text-left text-xs min-w-[140px]">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {filterRangeStart ? format(filterRangeStart, "MMM d, yyyy") : "From date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={filterRangeStart} onSelect={setFilterRangeStart} initialFocus />
                </PopoverContent>
              </Popover>

              <span className="text-xs text-muted-foreground">to</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-start text-left text-xs min-w-[140px]">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {filterRangeEnd ? format(filterRangeEnd, "MMM d, yyyy") : "To date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={filterRangeEnd} onSelect={setFilterRangeEnd} initialFocus />
                </PopoverContent>
              </Popover>

              {/* Active filter summary pill */}
              {hasDateFilter && filterSchedType !== "all" && (
                <Badge
                  className={`text-xs px-2 py-1 ${scheduleTypeColor[filterSchedType as ScheduleType]}`}
                  variant="outline"
                >
                  {filterSchedType} · {format(filterRangeStart!, "MMM d")} – {format(filterRangeEnd!, "MMM d, yyyy")}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Results summary bar ── */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {filteredResults.length} schedule{filteredResults.length !== 1 ? "s" : ""} found
          </span>
          {hasDateFilter && (
            <span>
              · sessions from{" "}
              <span className="font-medium text-gray-700">{format(filterRangeStart!, "MMM d")}</span>
              {" "}–{" "}
              <span className="font-medium text-gray-700">{format(filterRangeEnd!, "MMM d, yyyy")}</span>
            </span>
          )}
        </div>

        {/* ── Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredResults.length > 0 ? (
            filteredResults.map(({ schedule, sessionDates }) => (
              <ScheduleCard
                key={schedule.id}
                {...schedule}
                sessionDates={sessionDates}
                onSelectClick={handleSelectClick}
              />
            ))
          ) : (
            <div className="col-span-full py-12 text-center space-y-1">
              <p className="text-sm font-medium text-gray-500">No schedules found</p>
              <p className="text-xs text-muted-foreground">Try adjusting your filters or date range.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── New Schedule Sheet ── */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Classroom Schedule</SheetTitle>
            <SheetDescription>Fill in the details to add a new classroom schedule.</SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="classroomName">Classroom Name</Label>
              <Input id="classroomName" placeholder="e.g., Room 101" value={classroomName} onChange={(e) => setClassroomName(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="subjectName">Subject Name</Label>
              <Input id="subjectName" placeholder="e.g., Mathematics" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="instructor">Instructor</Label>
              <Input id="instructor" placeholder="e.g., Mr. Santos" value={instructor} onChange={(e) => setInstructor(e.target.value)} />
            </div>

            {/* Schedule Type */}
            <div className="grid gap-2">
              <Label>Schedule Type</Label>
              <Select value={scheduleType} onValueChange={(v) => setScheduleType(v as ScheduleType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select schedule type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Schedule Type</SelectLabel>
                    <SelectItem value="MWF">MWF – Monday · Wednesday · Friday</SelectItem>
                    <SelectItem value="TTH">TTH – Tuesday · Thursday</SelectItem>
                    <SelectItem value="FS">FS – Friday · Saturday</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {scheduleType && (
                <p className="text-xs text-muted-foreground">
                  Classes run every <span className="font-medium">{SCHEDULE_LABELS[scheduleType as ScheduleType]}</span>
                </p>
              )}
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left text-sm">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-col gap-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left text-sm">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Session preview */}
            {formSessionPreview.length > 0 && (
              <div className="rounded-md bg-blue-50 border border-blue-100 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-blue-700">
                  Session Preview — {formSessionPreview.length} total sessions
                </p>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {formSessionPreview.slice(0, 14).map((d, i) => (
                    <SessionChip key={i} date={d} />
                  ))}
                  {formSessionPreview.length > 14 && (
                    <span className="text-[10px] text-blue-400 self-center">
                      …and {formSessionPreview.length - 14} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Time range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="timeStart">Time Start</Label>
                <Input id="timeStart" type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="timeEnd">Time End</Label>
                <Input id="timeEnd" type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
              </div>
            </div>
          </div>

          <SheetFooter>
            <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleSaveSchedule}>
              Save Schedule
            </Button>
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Detail Sheet ── */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Schedule Details</SheetTitle>
            <SheetDescription>Full information about the selected classroom schedule.</SheetDescription>
          </SheetHeader>

          {selectedSchedule && (
            <div className="grid gap-4 py-4">
              <DetailRow label="Classroom"     value={selectedSchedule.classroom_name} />
              <DetailRow label="Subject"       value={selectedSchedule.subject_name} />
              <DetailRow label="Instructor"    value={selectedSchedule.instructor} />
              <DetailRow label="Schedule Type" value={`${selectedSchedule.schedule_type} (${SCHEDULE_LABELS[selectedSchedule.schedule_type]})`} />
              <DetailRow label="Start Date"    value={new Date(selectedSchedule.start_date).toLocaleDateString()} />
              <DetailRow label="End Date"      value={new Date(selectedSchedule.end_date).toLocaleDateString()} />
              <DetailRow label="Time"          value={`${selectedSchedule.time_start} – ${selectedSchedule.time_end}`} />
              <DetailRow label="Status"        value={selectedSchedule.status ?? "—"} />

              {selectedSessionDates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    Sessions in filtered range ({selectedSessionDates.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                    {selectedSessionDates.map((d, i) => (
                      <SessionChip key={i} date={d} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <SheetFooter>
            <SheetClose asChild>
              <Button variant="outline">Close</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
};


const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="grid grid-cols-2 gap-2 border-b pb-2 last:border-0">
    <span className="text-sm text-muted-foreground font-medium">{label}</span>
    <span className="text-sm font-semibold">{value}</span>
  </div>
);

export default ClassroomSchedules;