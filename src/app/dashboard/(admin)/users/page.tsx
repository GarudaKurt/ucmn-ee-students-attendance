"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useMemo } from "react";
import { format } from "date-fns";
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
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleType = "MWF" | "TTH" | "FS";

type SubjectSchedule = {
  id: number;
  subject_name: string;
  classroom_name: string;
  instructor: string;
  schedule_type: ScheduleType;
  start_date: string;
  end_date: string;
  time_start: string;
  time_end: string;
};

type EnrolledEntry = {
  subject: SubjectSchedule;
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

// ─── Mock subject+schedule data ───────────────────────────────────────────────

const AVAILABLE_SUBJECTS: SubjectSchedule[] = [
  {
    id: 1,
    subject_name: "Mathematics",
    classroom_name: "Room 101",
    instructor: "Mr. Santos",
    schedule_type: "MWF",
    start_date: "2026-03-01",
    end_date: "2026-06-01",
    time_start: "08:00",
    time_end: "10:00",
  },
  {
    id: 2,
    subject_name: "Science",
    classroom_name: "Room 202",
    instructor: "Ms. Reyes",
    schedule_type: "TTH",
    start_date: "2026-03-01",
    end_date: "2026-06-15",
    time_start: "10:30",
    time_end: "12:00",
  },
  {
    id: 3,
    subject_name: "Computer Science",
    classroom_name: "Lab A",
    instructor: "Mr. Cruz",
    schedule_type: "MWF",
    start_date: "2026-03-15",
    end_date: "2026-07-01",
    time_start: "13:00",
    time_end: "15:00",
  },
  {
    id: 4,
    subject_name: "Filipino",
    classroom_name: "Room 305",
    instructor: "Ms. Garcia",
    schedule_type: "FS",
    start_date: "2026-03-01",
    end_date: "2026-05-30",
    time_start: "09:00",
    time_end: "11:00",
  },
  {
    id: 5,
    subject_name: "English",
    classroom_name: "Room 110",
    instructor: "Ms. Lim",
    schedule_type: "TTH",
    start_date: "2026-03-05",
    end_date: "2026-06-05",
    time_start: "14:00",
    time_end: "16:00",
  },
  {
    id: 6,
    subject_name: "History",
    classroom_name: "Room 208",
    instructor: "Mr. Dela Cruz",
    schedule_type: "MWF",
    start_date: "2026-03-01",
    end_date: "2026-06-01",
    time_start: "11:00",
    time_end: "12:30",
  },
];

// ─── Zod schema ───────────────────────────────────────────────────────────────

const formSchema = z.object({
  student_id:   z.string().min(1, "Student ID is required"),
  full_name:    z.string().min(2, "Full name is required"),
  email:        z.string().email("Enter a valid email"),
  contact:      z.string().min(11, "Enter a valid contact number"),
  address:      z.string().min(1, "Address is required"),
  birthdate:    z.string().min(1, "Birthdate is required"),
  year_level:   z.string().min(1, "Year level is required"),
  section:      z.string().min(1, "Section is required"),
  gender:       z.string().min(1, "Gender is required"),
  guardian_name: z.string().min(1, "Guardian name is required"),
  guardian_contact: z.string().min(11, "Guardian contact is required"),
});

type FormValues = z.infer<typeof formSchema>;

// ─── Subject Row (enrolled) ───────────────────────────────────────────────────

const EnrolledRow: React.FC<{
  entry: EnrolledEntry;
  index: number;
  onRemove: (id: number) => void;
}> = ({ entry, index, onRemove }) => {
  const s = entry.subject;
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors group">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold mt-0.5">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-800">{s.subject_name}</span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 font-semibold ${scheduleTypeColor[s.schedule_type]}`}
          >
            {s.schedule_type}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3" />{s.classroom_name}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />{s.instructor}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />{s.time_start} – {s.time_end}
          </span>
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            {SCHEDULE_LABELS[s.schedule_type]} · {new Date(s.start_date).toLocaleDateString()} – {new Date(s.end_date).toLocaleDateString()}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(s.id)}
        className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors mt-0.5"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const StudentRegistration: React.FC = () => {
  const [enrolledSubjects, setEnrolledSubjects] = useState<EnrolledEntry[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      student_id: "",
      full_name: "",
      email: "",
      contact: "",
      address: "",
      birthdate: "",
      year_level: "",
      section: "",
      gender: "",
      guardian_name: "",
      guardian_contact: "",
    },
  });

  const watchedName  = form.watch("full_name");
  const watchedId    = form.watch("student_id");
  const watchedYear  = form.watch("year_level");

  // Initials for avatar
  const initials = watchedName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("") || "ST";

  // Already enrolled subject IDs
  const enrolledIds = useMemo(
    () => new Set(enrolledSubjects.map((e) => e.subject.id)),
    [enrolledSubjects]
  );

  // Available (not yet enrolled)
  const availableToAdd = AVAILABLE_SUBJECTS.filter((s) => !enrolledIds.has(s.id));

  const handleAddSubject = () => {
    if (!selectedSubjectId) return;
    const subject = AVAILABLE_SUBJECTS.find((s) => s.id === Number(selectedSubjectId));
    if (!subject) return;
    setEnrolledSubjects((prev) => [...prev, { subject }]);
    setSelectedSubjectId("");
  };

  const handleRemoveSubject = (id: number) => {
    setEnrolledSubjects((prev) => prev.filter((e) => e.subject.id !== id));
  };

  const onSubmit = (values: FormValues) => {
    if (enrolledSubjects.length === 0) {
      alert("Please enroll in at least one subject.");
      return;
    }
    console.log("Student Registration:", {
      ...values,
      enrolled_subjects: enrolledSubjects.map((e) => e.subject.id),
    });
    alert(`Student "${values.full_name}" registered successfully with ${enrolledSubjects.length} subject(s)!`);
    form.reset();
    setEnrolledSubjects([]);
    setSelectedSubjectId("");
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 space-y-4">
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
                            <SelectTrigger>
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
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
                            <SelectTrigger>
                              <SelectValue placeholder="Select year level" />
                            </SelectTrigger>
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
                            <SelectTrigger>
                              <SelectValue placeholder="Select section" />
                            </SelectTrigger>
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
                    {enrolledSubjects.length > 0 && (
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs font-semibold ml-1" variant="outline">
                        {enrolledSubjects.length} enrolled
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">

                  {/* Add subject row */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                        <SelectTrigger>
                          <SelectValue placeholder={availableToAdd.length === 0 ? "All subjects enrolled" : "Select a subject & schedule to add"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Available Subjects</SelectLabel>
                            {availableToAdd.map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{s.subject_name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {s.schedule_type} · {s.classroom_name} · {s.time_start}–{s.time_end} · {s.instructor}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddSubject}
                      disabled={!selectedSubjectId}
                      className="bg-blue-500 hover:bg-blue-600 text-white flex-shrink-0"
                    >
                      <PlusCircle className="w-4 h-4 mr-1.5" />
                      Add
                    </Button>
                  </div>

                  {/* Enrolled list */}
                  {enrolledSubjects.length === 0 ? (
                    <div className="py-8 text-center border-2 border-dashed border-gray-200 rounded-lg">
                      <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No subjects enrolled yet.</p>
                      <p className="text-xs text-muted-foreground">Select a subject above and click Add.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {enrolledSubjects.map((entry, i) => (
                        <EnrolledRow
                          key={entry.subject.id}
                          entry={entry}
                          index={i}
                          onRemove={handleRemoveSubject}
                        />
                      ))}
                    </div>
                  )}

                  {/* Summary */}
                  {enrolledSubjects.length > 0 && (
                    <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      <span>
                        {enrolledSubjects.length} subject{enrolledSubjects.length !== 1 ? "s" : ""} · 
                        {" "}{enrolledSubjects.reduce((acc) => acc + 1, 0) * 1.5} units (est.)
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Submit */}
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { form.reset(); setEnrolledSubjects([]); setSelectedSubjectId(""); }}
                >
                  Reset
                </Button>
                <Button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white px-8">
                  Register Student
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
                    <p className="font-semibold text-gray-600 uppercase tracking-wide text-[10px]">Enrollment Summary</p>

                    {enrolledSubjects.length === 0 ? (
                      <p className="text-muted-foreground text-center py-2">No subjects yet</p>
                    ) : (
                      <div className="space-y-2">
                        {enrolledSubjects.map((e) => (
                          <div key={e.subject.id} className="flex items-start justify-between gap-2">
                            <span className="text-gray-700 font-medium leading-tight">{e.subject.subject_name}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${scheduleTypeColor[e.subject.schedule_type]}`}
                            >
                              {e.subject.schedule_type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {enrolledSubjects.length > 0 && (
                    <>
                      <Separator className="my-3" />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Total Subjects</span>
                        <span className="font-bold text-blue-600">{enrolledSubjects.length}</span>
                      </div>
                    </>
                  )}
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