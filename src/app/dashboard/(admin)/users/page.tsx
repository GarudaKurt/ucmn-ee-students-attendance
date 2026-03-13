"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useMemo, useEffect } from "react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  UserRound,
  BookOpen,
  CalendarDays,
  Clock,
  Trash2,
  GraduationCap,
  Phone,
  MapPin,
  Hash,
  PlusCircle,
  CheckCircle2,
  Users,
  Loader2,
  AlertCircle,
  WifiOff,
} from "lucide-react";
import {
  ClassroomSchedule,
  EnrolledSubject,
  subscribeToSchedules,
  registerStudent,
} from "@/app/services/studentService";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleType = "MWF" | "TTH" | "FS";

type EnrolledEntry = {
  schedule_id: string;
  subject_name: string;
  classroom_name: string;
  instructor: string;
  schedule_type: ScheduleType;
  start_date: string;
  end_date: string;
  time_start: string;
  time_end: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Zod schema ───────────────────────────────────────────────────────────────

const formSchema = z.object({
  student_id:       z.string().min(1, "Student ID is required"),
  full_name:        z.string().min(2, "Full name is required"),
  email:            z.string().email("Enter a valid email"),
  contact:          z.string().min(11, "Enter a valid contact number"),
  address:          z.string().min(1, "Address is required"),
  birthdate:        z.string().min(1, "Birthdate is required"),
  year_level:       z.string().min(1, "Year level is required"),
  section:          z.string().min(1, "Section is required"),
  gender:           z.string().min(1, "Gender is required"),
  guardian_name:    z.string().min(1, "Guardian name is required"),
  guardian_contact: z.string().min(11, "Guardian contact is required"),
});

type FormValues = z.infer<typeof formSchema>;

// ─── Enrolled Row ─────────────────────────────────────────────────────────────

const EnrolledRow: React.FC<{
  entry: EnrolledEntry;
  index: number;
  onRemove: (scheduleId: string) => void;
}> = ({ entry, index, onRemove }) => (
  <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors group">
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold mt-0.5">
      {index + 1}
    </div>
    <div className="flex-1 min-w-0 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-gray-800">{entry.subject_name}</span>
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 font-semibold ${scheduleTypeColor[entry.schedule_type]}`}
        >
          {entry.schedule_type}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <BookOpen className="w-3 h-3" />{entry.classroom_name}
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />{entry.instructor}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />{entry.time_start} – {entry.time_end}
        </span>
        <span className="flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />
          {SCHEDULE_LABELS[entry.schedule_type]} · {new Date(entry.start_date).toLocaleDateString()} – {new Date(entry.end_date).toLocaleDateString()}
        </span>
      </div>
    </div>
    <button
      type="button"
      onClick={() => onRemove(entry.schedule_id)}
      className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors mt-0.5"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
);

// ─── Schedule Option Item (in the dropdown) ───────────────────────────────────

const ScheduleOption: React.FC<{ s: ClassroomSchedule }> = ({ s }) => {
  const isFull = s.enrolled_students.length >= (s.max_students ?? 40);
  return (
    <div className="flex flex-col gap-0.5 py-0.5">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{s.subject_name}</span>
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 font-semibold ${scheduleTypeColor[s.schedule_type as ScheduleType]}`}
        >
          {s.schedule_type}
        </Badge>
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 ${statusColor[s.status]}`}
        >
          {s.status}
        </Badge>
        {isFull && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-600 border-red-200">
            Full
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        <span>{s.classroom_name}</span>
        <span>{s.instructor}</span>
        <span>{s.time_start} – {s.time_end}</span>
        <span>{SCHEDULE_LABELS[s.schedule_type as ScheduleType]}</span>
        <span className="text-gray-400">
          {s.enrolled_students.length}/{s.max_students ?? 40} enrolled
        </span>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const StudentRegistration: React.FC = () => {
  // Firestore schedules
  const [availableSchedules, setAvailableSchedules] = useState<ClassroomSchedule[]>([]);
  const [schedulesLoading,   setSchedulesLoading]   = useState(true);
  const [schedulesError,     setSchedulesError]     = useState("");

  // Form
  const [enrolledEntries,   setEnrolledEntries]   = useState<EnrolledEntry[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [submitting,         setSubmitting]         = useState(false);
  const [submitError,        setSubmitError]        = useState("");
  const [submitSuccess,      setSubmitSuccess]      = useState(false);

  // Subscribe to Firestore schedules in real time
  useEffect(() => {
    setSchedulesLoading(true);
    try {
      const unsub = subscribeToSchedules((data) => {
        setAvailableSchedules(data);
        setSchedulesLoading(false);
      });
      return () => unsub();
    } catch {
      setSchedulesError("Failed to load schedules. Check your connection.");
      setSchedulesLoading(false);
    }
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      student_id: "", full_name: "", email: "", contact: "",
      address: "", birthdate: "", year_level: "", section: "",
      gender: "", guardian_name: "", guardian_contact: "",
    },
  });

  const watchedName = form.watch("full_name");
  const watchedId   = form.watch("student_id");
  const watchedYear = form.watch("year_level");

  const initials = watchedName
    .split(" ").filter(Boolean).slice(0, 2)
    .map((n) => n[0].toUpperCase()).join("") || "ST";

  // IDs already enrolled
  const enrolledIds = useMemo(
    () => new Set(enrolledEntries.map((e) => e.schedule_id)),
    [enrolledEntries]
  );

  // Schedules still available to pick (not enrolled, not full, not completed)
  const availableToAdd = useMemo(
    () =>
      availableSchedules.filter(
        (s) =>
          !enrolledIds.has(s.id) &&
          s.status !== "Completed" &&
          s.enrolled_students.length < (s.max_students ?? 40)
      ),
    [availableSchedules, enrolledIds]
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleAddSubject = () => {
    if (!selectedScheduleId) return;
    const s = availableSchedules.find((s) => s.id === selectedScheduleId);
    if (!s) return;
    setEnrolledEntries((prev) => [
      ...prev,
      {
        schedule_id:    s.id,
        subject_name:   s.subject_name,
        classroom_name: s.classroom_name,
        instructor:     s.instructor,
        schedule_type:  s.schedule_type as ScheduleType,
        start_date:     s.start_date,
        end_date:       s.end_date,
        time_start:     s.time_start,
        time_end:       s.time_end,
      },
    ]);
    setSelectedScheduleId("");
  };

  const handleRemoveSubject = (scheduleId: string) => {
    setEnrolledEntries((prev) => prev.filter((e) => e.schedule_id !== scheduleId));
  };

  const handleReset = () => {
    form.reset();
    setEnrolledEntries([]);
    setSelectedScheduleId("");
    setSubmitError("");
    setSubmitSuccess(false);
  };

  const onSubmit = async (values: FormValues) => {
    if (enrolledEntries.length === 0) {
      setSubmitError("Please enroll in at least one subject.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess(false);

    try {
      const enrolled_subjects: EnrolledSubject[] = enrolledEntries.map((e) => ({
        ...e,
        enrolled_at: new Date(),
      }));

      await registerStudent({
        ...values,
        enrolled_subjects,
      });

      setSubmitSuccess(true);
      handleReset();
    } catch (err: any) {
      setSubmitError(err.message ?? "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 space-y-4">
      {/* Success banner */}
      {submitSuccess && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-md px-4 py-3 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Student registered successfully and saved to Firestore!
        </div>
      )}

      {/* Error banner */}
      {submitError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-md px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {submitError}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* ── LEFT: Main form ── */}
            <div className="lg:col-span-2 space-y-4">

              {/* Personal Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <UserRound className="w-4 h-4 text-blue-500" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <FormField control={form.control} name="student_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Student ID</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Hash className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="e.g., 2026-00001" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="full_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Last, First Middle" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="gender" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="birthdate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Birthdate</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="student@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="contact" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Number</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="09XXXXXXXXX" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="address" render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="Street, Barangay, City, Province" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>

              {/* Academic Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-blue-500" />
                    Academic Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <FormField control={form.control} name="year_level" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year Level</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select year level" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Year Level</SelectLabel>
                              <SelectItem value="1st Year">1st Year</SelectItem>
                              <SelectItem value="2nd Year">2nd Year</SelectItem>
                              <SelectItem value="3rd Year">3rd Year</SelectItem>
                              <SelectItem value="4th Year">4th Year</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="section" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Section</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Section</SelectLabel>
                              <SelectItem value="Section A">Section A</SelectItem>
                              <SelectItem value="Section B">Section B</SelectItem>
                              <SelectItem value="Section C">Section C</SelectItem>
                              <SelectItem value="Section D">Section D</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="guardian_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Guardian / Parent Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Guardian full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="guardian_contact" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Guardian Contact</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="09XXXXXXXXX" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>

              {/* Subject Enrollment */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-500" />
                    Subject Enrollment
                    {enrolledEntries.length > 0 && (
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs font-semibold ml-1" variant="outline">
                        {enrolledEntries.length} enrolled
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">

                  {/* Schedule picker */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      {schedulesLoading ? (
                        <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-gray-200 bg-gray-50 text-sm text-muted-foreground">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Loading available schedules...
                        </div>
                      ) : schedulesError ? (
                        <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-red-200 bg-red-50 text-sm text-red-600">
                          <WifiOff className="w-3.5 h-3.5" />
                          {schedulesError}
                        </div>
                      ) : (
                        <Select
                          value={selectedScheduleId}
                          onValueChange={setSelectedScheduleId}
                          disabled={availableToAdd.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                availableToAdd.length === 0
                                  ? "No available schedules to add"
                                  : `${availableToAdd.length} schedule${availableToAdd.length !== 1 ? "s" : ""} available — select to enroll`
                              }
                            />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            <SelectGroup>
                              <SelectLabel className="text-xs text-muted-foreground">
                                Available Schedules ({availableToAdd.length})
                              </SelectLabel>
                              {availableToAdd.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  <ScheduleOption s={s} />
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddSubject}
                      disabled={!selectedScheduleId || schedulesLoading}
                      className="bg-blue-500 hover:bg-blue-600 text-white flex-shrink-0"
                    >
                      <PlusCircle className="w-4 h-4 mr-1.5" />
                      Add
                    </Button>
                  </div>

                  {/* Enrolled list */}
                  {enrolledEntries.length === 0 ? (
                    <div className="py-8 text-center border-2 border-dashed border-gray-200 rounded-lg">
                      <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No subjects enrolled yet.</p>
                      <p className="text-xs text-muted-foreground">Select a schedule above and click Add.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {enrolledEntries.map((entry, i) => (
                        <EnrolledRow
                          key={entry.schedule_id}
                          entry={entry}
                          index={i}
                          onRemove={handleRemoveSubject}
                        />
                      ))}
                    </div>
                  )}

                  {enrolledEntries.length > 0 && (
                    <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      <span>
                        {enrolledEntries.length} subject{enrolledEntries.length !== 1 ? "s" : ""} selected
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Submit */}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={handleReset} disabled={submitting}>
                  Reset
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-8"
                  disabled={submitting}
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Registering...</>
                  ) : (
                    "Register Student"
                  )}
                </Button>
              </div>
            </div>

            {/* ── RIGHT: Profile summary ── */}
            <div className="space-y-4">
              <Card className="sticky top-4">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <Avatar className="w-16 h-16 text-lg">
                      <AvatarFallback className="bg-blue-100 text-blue-700 font-bold text-xl">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm leading-tight">
                        {watchedName || "Student Name"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {watchedId || "Student ID"}
                      </p>
                    </div>
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs" variant="outline">
                      {watchedYear || "Year Level"}
                    </Badge>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2 text-xs">
                    <p className="font-semibold text-gray-600 uppercase tracking-wide text-[10px]">
                      Enrollment Summary
                    </p>
                    {enrolledEntries.length === 0 ? (
                      <p className="text-muted-foreground text-center py-2">No subjects yet</p>
                    ) : (
                      <div className="space-y-2">
                        {enrolledEntries.map((e) => (
                          <div key={e.schedule_id} className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-gray-700 font-medium leading-tight truncate">{e.subject_name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{e.classroom_name} · {e.time_start}–{e.time_end}</p>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${scheduleTypeColor[e.schedule_type]}`}
                            >
                              {e.schedule_type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {enrolledEntries.length > 0 && (
                    <>
                      <Separator className="my-3" />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Total Subjects</span>
                        <span className="font-bold text-blue-600">{enrolledEntries.length}</span>
                      </div>
                    </>
                  )}

                  {/* Live schedule counter from Firestore */}
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Available Schedules</span>
                    {schedulesLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    ) : (
                      <span className="font-bold text-green-600">{availableToAdd.length}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default StudentRegistration;