"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { withConvexProvider } from "../lib/convex";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Upload,
  Trash2,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  Download,
  Search,
  Loader2,
  Filter,
} from "lucide-react";
import Papa from "papaparse";

function CSVImportComponent() {
  const [csvData, setCsvData] = useState<string>("");
  const [preview, setPreview] = useState<
    Array<{
      fullName: string;
      course: string;
      batch: string;
      shift?: string;
      contactNo?: string;
      isPresent?: boolean;
    }>
  >([]);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [showFilter, setShowFilter] = useState<"all" | "present" | "absent">(
    "all",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkImport = useMutation(api.attendees.bulkImport);
  const clearAll = useMutation(api.attendees.clearAll);
  const resetAttendance = useMutation(api.attendees.resetAttendance);
  const deleteAttendee = useMutation(api.attendees.deleteAttendee);
  const stats = useQuery(api.attendees.getStats);
  const attendees = useQuery(api.attendees.getAll);
  const courses = useQuery(api.attendees.getCourses);
  const batches = useQuery(api.attendees.getBatches);
  const shifts = useQuery(api.attendees.getShifts);

  const filteredAttendees = attendees?.filter((a) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      a.fullName.toLowerCase().includes(search) ||
      a.course.toLowerCase().includes(search) ||
      a.shift?.toLowerCase().includes(search) ||
      a.batch.toLowerCase().includes(search) ||
      a.contactNo?.toLowerCase().includes(search);
    const matchesCourse = courseFilter === "all" || a.course === courseFilter;
    const matchesBatch = batchFilter === "all" || a.batch === batchFilter;
    const matchesPresence =
      showFilter === "all" ||
      (showFilter === "present" && a.isPresent) ||
      (showFilter === "absent" && !a.isPresent);
    return matchesSearch && matchesCourse && matchesBatch && matchesPresence;
  });

  // Normalize course name for grouping
  const normalizeCourse = (course: string): string => {
    if (!course) return "UNKNOWN";
    return course.trim().toUpperCase().replace(/\s+/g, " ");
  };

  // Course-wise count (only present students, with normalized names)
  const courseWiseCount = attendees
    ?.filter((a) => a.isPresent)
    .reduce(
      (acc, attendee) => {
        const normalizedCourse = normalizeCourse(attendee.course);
        acc[normalizedCourse] = (acc[normalizedCourse] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

  // Total present count from courseWiseCount for verification
  const totalPresentFromCourses = courseWiseCount
    ? Object.values(courseWiseCount).reduce((sum, count) => sum + count, 0)
    : 0;

  // Normalize batch year from various formats
  const normalizeBatchYear = (batch: string): number | null => {
    if (!batch) return null;

    // Extract numbers from the string (handles "2016", "16", "Batch 2016", "2016-2020", etc.)
    const numbers = batch.match(/\d+/g);
    if (!numbers || numbers.length === 0) return null;

    // Take the first number found
    let year = parseInt(numbers[0], 10);
    if (isNaN(year)) return null;

    // Handle 2-digit years (16 -> 2016, 99 -> 1999)
    if (year >= 0 && year <= 99) {
      // Assume years 00-30 are 2000s, 31-99 are 1900s
      if (year <= 30) {
        year = 2000 + year;
      } else {
        year = 1900 + year;
      }
    }

    // Validate reasonable year range (1980-2030)
    if (year < 1980 || year > 2030) return null;

    return year;
  };

  // Oldest batch year (with proper normalization)
  const oldestBatch = attendees?.reduce(
    (oldest, attendee) => {
      const batchYear = normalizeBatchYear(attendee.batch);
      if (batchYear !== null && (oldest === null || batchYear < oldest)) {
        return batchYear;
      }
      return oldest;
    },
    null as number | null,
  );

  const handleDeleteAttendee = async (id: Id<"attendees">, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await deleteAttendee({ id });
    } catch (error) {
      alert("Error deleting: " + (error as Error).message);
    }
  };

  const parseCSV = (text: string) => {
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
    });

    if (result.errors.length > 0) {
      alert("CSV parsing error: " + result.errors[0].message);
      return [];
    }

    const data = result.data as any[];
    if (data.length === 0) return [];

    const headers = Object.keys(data[0]);
    const nameKey = headers.find((h) => h.includes("name"));
    const courseKey = headers.find(
      (h) => h.includes("course") || h.includes("program"),
    );
    const batchKey = headers.find(
      (h) => h.includes("batch") || h.includes("year"),
    );
    const shiftKey = headers.find((h) => h.includes("shift"));
    const contactKey = headers.find(
      (h) =>
        h.includes("contact") || h.includes("phone") || h.includes("mobile"),
    );
    const presentKey = headers.find(
      (h) =>
        h.includes("present") ||
        h.includes("attendance") ||
        h.includes("status"),
    );

    if (!nameKey || !courseKey || !batchKey) {
      alert("CSV must have 'name', 'course', and 'batch' columns");
      return [];
    }

    const parsePresentValue = (
      value: string | undefined,
    ): boolean | undefined => {
      if (value === undefined || value === "") return undefined;
      const lower = value.toLowerCase().trim();
      if (
        lower === "true" ||
        lower === "yes" ||
        lower === "1" ||
        lower === "present"
      ) {
        return true;
      }
      if (
        lower === "false" ||
        lower === "no" ||
        lower === "0" ||
        lower === "absent"
      ) {
        return false;
      }
      return undefined;
    };

    const parsedData = [];
    for (const row of data) {
      if (row[nameKey]) {
        parsedData.push({
          fullName: row[nameKey],
          course: row[courseKey] || "",
          batch: row[batchKey] || "",
          shift: shiftKey ? row[shiftKey] : undefined,
          contactNo: contactKey ? row[contactKey] : undefined,
          isPresent: presentKey
            ? parsePresentValue(row[presentKey])
            : undefined,
        });
      }
    }
    return parsedData;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvData(text);
      setPreview(parseCSV(text));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (preview.length === 0) return;

    setImporting(true);
    try {
      const result = await bulkImport({ attendees: preview });
      alert(`Successfully imported ${result.imported} attendees!`);
      setCsvData("");
      setPreview([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      alert("Error importing: " + (error as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const handleClearAll = async () => {
    if (
      !confirm(
        "Are you sure you want to delete ALL attendees? This cannot be undone.",
      )
    )
      return;
    try {
      const result = await clearAll({});
      alert(`Deleted ${result.deleted} attendees`);
    } catch (error) {
      alert("Error: " + (error as Error).message);
    }
  };

  const handleResetAttendance = async () => {
    if (
      !confirm(
        "Are you sure you want to reset all attendance? Everyone will be marked as absent.",
      )
    )
      return;
    try {
      const result = await resetAttendance({});
      alert(`Reset attendance for ${result.reset} attendees`);
    } catch (error) {
      alert("Error: " + (error as Error).message);
    }
  };

  const exportCSV = () => {
    if (!attendees || attendees.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = [
      "Full Name",
      "Course",
      "Shift",
      "Batch",
      "Contact No.",
      "Present",
      "Checked In At",
    ];
    const rows = attendees.map((a) => [
      a.fullName,
      a.course,
      a.shift,
      a.batch,
      a.contactNo,
      a.isPresent ? "Yes" : "No",
      a.checkedInAt ? new Date(a.checkedInAt).toLocaleString() : "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Portal target for stats in header
  const [statsPortal, setStatsPortal] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const portal = document.getElementById("admin-stats-portal");
    setStatsPortal(portal);
  }, []);

  const statsContent = (
    <div className="flex items-center gap-4 sm:gap-6">
      <div className="flex items-center gap-1">
        <span className="text-xl sm:text-2xl font-bold">
          {stats?.total ?? 0}
        </span>
        <span className="text-xs text-muted-foreground uppercase">Total</span>
      </div>
      <div className="h-6 w-px bg-border" />
      <div className="flex items-center gap-1">
        <span className="text-xl sm:text-2xl font-bold text-green-500">
          {stats?.present ?? 0}
        </span>
        <span className="text-xs text-muted-foreground uppercase">Present</span>
      </div>
      <div className="h-6 w-px bg-border" />
      <div className="flex items-center gap-1">
        <span className="text-xl sm:text-2xl font-bold text-red-400">
          {stats?.absent ?? 0}
        </span>
        <span className="text-xs text-muted-foreground uppercase">Absent</span>
      </div>
      <div className="h-6 w-px bg-border hidden sm:block" />
      <div className="hidden sm:flex items-center gap-1">
        <span className="text-xl sm:text-2xl font-bold">
          {stats?.percentage ?? 0}%
        </span>
        <span className="text-xs text-muted-foreground uppercase">Rate</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Portal stats into header */}
      {statsPortal && createPortal(statsContent, statsPortal)}

      <div className="space-y-6">
        {/* Import Section */}
        <Card>
          <CardHeader>
            <CardTitle>Import Attendees from CSV</CardTitle>
            <CardDescription>
              Upload a CSV file with columns: Full Name, Course, Batch
              (required), Shift, Contact No. (optional)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="csv-file">CSV File</Label>
                <Input
                  ref={fileInputRef}
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleImport}
                disabled={preview.length === 0 || importing}
                className="mt-6"
              >
                <Upload className="h-4 w-4 mr-2" />
                {importing
                  ? "Importing..."
                  : `Import ${preview.length} Records`}
              </Button>
            </div>

            {/* Preview Table */}
            {preview.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Preview (first 10 rows)</h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Contact No.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.slice(0, 10).map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{row.fullName}</TableCell>
                          <TableCell>{row.course}</TableCell>
                          <TableCell>{row.shift}</TableCell>
                          <TableCell>{row.batch}</TableCell>
                          <TableCell>{row.contactNo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {preview.length > 10 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    ...and {preview.length - 10} more rows
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-48">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or contact no..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses
                    ?.filter((course) => course && course.trim() !== "")
                    .map((course) => (
                      <SelectItem key={course} value={course}>
                        {course}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select value={batchFilter} onValueChange={setBatchFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All Batches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {batches
                    ?.filter((batch) => batch && batch.trim() !== "")
                    .map((batch) => (
                      <SelectItem key={batch} value={batch}>
                        {batch}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select
                value={showFilter}
                onValueChange={(v) =>
                  setShowFilter(v as "all" | "present" | "absent")
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Show All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Show All</SelectItem>
                  <SelectItem value="present">Present Only</SelectItem>
                  <SelectItem value="absent">Absent Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Attendees Table with Delete */}
        <Card>
          <CardHeader>
            <CardTitle>
              All Attendees ({filteredAttendees?.length ?? 0})
            </CardTitle>
            <CardDescription>
              View and delete individual attendees
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Contact No.</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendees === undefined ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Loading attendees...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : !filteredAttendees || filteredAttendees.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {attendees?.length === 0
                          ? "No attendees found. Import a CSV above."
                          : "No matching attendees found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAttendees.map((attendee) => (
                      <TableRow key={attendee._id}>
                        <TableCell className="font-medium">
                          {attendee.fullName}
                        </TableCell>
                        <TableCell>{attendee.course}</TableCell>
                        <TableCell>{attendee.shift}</TableCell>
                        <TableCell>{attendee.batch}</TableCell>
                        <TableCell>{attendee.contactNo}</TableCell>
                        <TableCell>
                          {attendee.isPresent ? "Yes" : "No"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleDeleteAttendee(
                                attendee._id,
                                attendee.fullName,
                              )
                            }
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Actions Section */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Manage attendance data</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Button onClick={exportCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export to CSV
            </Button>
            <Button onClick={handleResetAttendance} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset All Attendance
            </Button>
            <Button onClick={handleClearAll} variant="destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Data
            </Button>
          </CardContent>
        </Card>

        {/* Extra Stats Section */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Statistics</CardTitle>
            <CardDescription>
              Course-wise breakdown and batch info
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Course-wise Count */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Course-wise Present Count
                </h3>
                {courseWiseCount && Object.keys(courseWiseCount).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(courseWiseCount)
                      .sort(([, a], [, b]) => b - a)
                      .map(([course, count]) => (
                        <div
                          key={course}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                        >
                          <span className="font-medium">{course}</span>
                          <span className="text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
                            {count} {count === 1 ? "student" : "students"}
                          </span>
                        </div>
                      ))}
                    <div className="flex items-center justify-between p-2 rounded-md bg-primary/10 border border-primary/20 mt-2">
                      <span className="font-semibold">Total Present</span>
                      <span className="text-sm font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded">
                        {totalPresentFromCourses} students
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No data available
                  </p>
                )}
              </div>

              {/* Oldest Batch */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Oldest Batch Year
                </h3>
                {oldestBatch !== null ? (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{oldestBatch}</p>
                      <p className="text-sm text-muted-foreground">
                        Batch Year
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No batch data available
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default withConvexProvider(CSVImportComponent);
