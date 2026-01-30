"use client";

import { useState, useMemo, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { withConvexProvider } from "../lib/convex";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Users,
  UserCheck,
  UserX,
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Plus,
  Loader2,
} from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";

type Attendee = {
  _id: Id<"attendees">;
  _creationTime: number;
  fullName: string;
  course: string;
  shift?: string;
  batch: string;
  contactNo?: string;
  isPresent: boolean;
  checkedInAt?: number;
};

function AttendanceTableComponent() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [showFilter, setShowFilter] = useState<"all" | "present" | "absent">(
    "all",
  );

  // Add attendee form state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newAttendee, setNewAttendee] = useState({
    fullName: "",
    course: "",
    shift: "",
    batch: "",
    contactNo: "",
  });
  const [isAdding, setIsAdding] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const attendees = useQuery(api.attendees.getAll);
  const courses = useQuery(api.attendees.getCourses);
  const batches = useQuery(api.attendees.getBatches);
  const shifts = useQuery(api.attendees.getShifts);
  const stats = useQuery(api.attendees.getStats);
  const markAttendance = useMutation(api.attendees.markAttendance);
  const addAttendee = useMutation(api.attendees.addAttendee);

  const handleCheckIn = useCallback(
    async (id: Id<"attendees">, isPresent: boolean) => {
      // Add to pending set
      setPendingIds((prev) => new Set(prev).add(id));
      try {
        await markAttendance({ id, isPresent });
      } finally {
        // Remove from pending set
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [markAttendance],
  );

  const handleAddAttendee = async () => {
    if (!newAttendee.fullName || !newAttendee.course || !newAttendee.batch) {
      alert("Please fill in name, course, and batch fields.");
      return;
    }

    setIsAdding(true);
    try {
      await addAttendee({
        fullName: newAttendee.fullName,
        course: newAttendee.course,
        batch: newAttendee.batch,
        shift: newAttendee.shift || undefined,
        contactNo: newAttendee.contactNo || undefined,
      });
      setNewAttendee({
        fullName: "",
        course: "",
        shift: "",
        batch: "",
        contactNo: "",
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      alert("Error adding attendee: " + (error as Error).message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (
      e.key === "Enter" &&
      newAttendee.fullName &&
      newAttendee.course &&
      newAttendee.batch &&
      !isAdding
    ) {
      e.preventDefault();
      handleAddAttendee();
    }
  };

  // Filter data based on custom filters
  const filteredData = useMemo(() => {
    if (!attendees) return [];

    return attendees.filter((attendee) => {
      const matchesCourse =
        courseFilter === "all" || attendee.course === courseFilter;
      const matchesBatch =
        batchFilter === "all" || attendee.batch === batchFilter;
      const matchesShow =
        showFilter === "all" ||
        (showFilter === "present" && attendee.isPresent) ||
        (showFilter === "absent" && !attendee.isPresent);

      return matchesCourse && matchesBatch && matchesShow;
    });
  }, [attendees, courseFilter, batchFilter, showFilter]);

  const columns = useMemo<ColumnDef<Attendee>[]>(
    () => [
      {
        id: "present",
        header: "Present",
        size: 80,
        cell: ({ row }) => {
          const isPending = pendingIds.has(row.original._id);
          return (
            <div className="relative inline-flex">
              <Checkbox
                checked={row.original.isPresent}
                onCheckedChange={(checked) =>
                  handleCheckIn(row.original._id, checked === true)
                }
                disabled={isPending}
                className={
                  isPending ? "border-2 border-yellow-500 animate-pulse" : ""
                }
              />
              {isPending && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-yellow-500 animate-ping" />
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "fullName",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting()}
          >
            Full Name
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            )}
          </button>
        ),
      },
      {
        accessorKey: "course",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting()}
          >
            Course
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            )}
          </button>
        ),
      },
      {
        accessorKey: "shift",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting()}
          >
            Shift
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            )}
          </button>
        ),
      },
      {
        accessorKey: "batch",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting()}
          >
            Batch
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            )}
          </button>
        ),
      },
      {
        accessorKey: "contactNo",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting()}
          >
            Contact No.
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            )}
          </button>
        ),
      },
      {
        accessorKey: "checkedInAt",
        header: "Checked In",
        cell: ({ row }) =>
          row.original.checkedInAt
            ? new Date(row.original.checkedInAt).toLocaleTimeString()
            : "-",
      },
    ],
    [pendingIds, handleCheckIn],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const search = filterValue.toLowerCase();
      const fullName = row.original.fullName?.toLowerCase() || "";
      const contactNo = row.original.contactNo?.toLowerCase() || "";
      return fullName.includes(search) || contactNo.includes(search);
    },
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Present</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.present ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Absent</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.absent ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.percentage ?? 0}%</div>
          </CardContent>
        </Card>
      </div>

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
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
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
                {courses?.map((course) => (
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
                {batches?.map((batch) => (
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

      {/* Attendance Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Attendees ({table.getFilteredRowModel().rows.length})
          </CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Attendee
              </Button>
            </DialogTrigger>
            <DialogContent onKeyDown={handleKeyDown}>
              <DialogHeader>
                <DialogTitle>Add New Attendee</DialogTitle>
                <DialogDescription>
                  Manually add a new attendee to the list.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    placeholder="e.g., Amandeep Bhasin"
                    value={newAttendee.fullName}
                    onChange={(e) =>
                      setNewAttendee({
                        ...newAttendee,
                        fullName: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="course">Course *</Label>
                    <Input
                      id="course"
                      placeholder="e.g., BCA"
                      value={newAttendee.course}
                      onChange={(e) =>
                        setNewAttendee({
                          ...newAttendee,
                          course: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="batch">Batch *</Label>
                    <Input
                      id="batch"
                      placeholder="e.g., 1999"
                      value={newAttendee.batch}
                      onChange={(e) =>
                        setNewAttendee({
                          ...newAttendee,
                          batch: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="shift">Shift</Label>
                    <Input
                      id="shift"
                      placeholder="e.g., Morning (optional)"
                      value={newAttendee.shift}
                      onChange={(e) =>
                        setNewAttendee({
                          ...newAttendee,
                          shift: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="contactNo">Contact No.</Label>
                    <Input
                      id="contactNo"
                      placeholder="e.g., 99999978322 (optional)"
                      value={newAttendee.contactNo}
                      onChange={(e) =>
                        setNewAttendee({
                          ...newAttendee,
                          contactNo: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddAttendee} disabled={isAdding}>
                  {isAdding ? "Adding..." : "Add Attendee"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        style={{ width: header.getSize() }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {attendees === undefined ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="text-center py-8"
                    >
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading attendees...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {attendees?.length === 0
                        ? "No attendees found. Add attendees manually or import a CSV from the Admin page."
                        : "No matching attendees found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={row.original.isPresent ? "bg-muted/50" : ""}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default withConvexProvider(AttendanceTableComponent);
