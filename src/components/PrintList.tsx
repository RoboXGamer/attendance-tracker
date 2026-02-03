"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { withConvexProvider } from "../lib/convex";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
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
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  FileDown,
  Users,
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
  type RowSelectionState,
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

// Normalize course name for grouping
const normalizeCourse = (course: string): string => {
  if (!course) return "UNKNOWN";
  return course.trim().toUpperCase().replace(/\s+/g, " ");
};

// Normalize batch year from various formats
const normalizeBatchYear = (batch: string): number | null => {
  if (!batch) return null;

  const numbers = batch.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;

  let year = parseInt(numbers[0], 10);
  if (isNaN(year)) return null;

  if (year >= 0 && year <= 99) {
    if (year <= 30) {
      year = 2000 + year;
    } else {
      year = 1900 + year;
    }
  }

  if (year < 1980 || year > 2030) return null;

  return year;
};

const formatBatchYear = (batch: string): string => {
  const year = normalizeBatchYear(batch);
  return year ? year.toString() : batch;
};

function PrintListComponent() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [showFilter, setShowFilter] = useState<"all" | "present" | "absent">(
    "all",
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sortColumn, setSortColumn] = useState<string>("fullName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const attendees = useQuery(api.attendees.getAll);
  const courses = useQuery(api.attendees.getCourses);
  const batches = useQuery(api.attendees.getBatches);
  const shifts = useQuery(api.attendees.getShifts);

  // Filter data based on custom filters
  const filteredData = useMemo(() => {
    if (!attendees) return [];

    return attendees.filter((attendee) => {
      const matchesCourse =
        courseFilter === "all" || attendee.course === courseFilter;
      const matchesBatch =
        batchFilter === "all" || attendee.batch === batchFilter;
      const matchesShift =
        shiftFilter === "all" || attendee.shift === shiftFilter;
      const matchesShow =
        showFilter === "all" ||
        (showFilter === "present" && attendee.isPresent) ||
        (showFilter === "absent" && !attendee.isPresent);

      return matchesCourse && matchesBatch && matchesShift && matchesShow;
    });
  }, [attendees, courseFilter, batchFilter, shiftFilter, showFilter]);

  // Apply custom sorting for PDF export
  const sortedDataForExport = useMemo(() => {
    const data = [...filteredData];

    data.sort((a, b) => {
      let aVal: string | number | boolean;
      let bVal: string | number | boolean;

      switch (sortColumn) {
        case "fullName":
          aVal = a.fullName.toLowerCase();
          bVal = b.fullName.toLowerCase();
          break;
        case "course":
          aVal = normalizeCourse(a.course);
          bVal = normalizeCourse(b.course);
          break;
        case "batch":
          aVal = normalizeBatchYear(a.batch) ?? 9999;
          bVal = normalizeBatchYear(b.batch) ?? 9999;
          break;
        case "shift":
          aVal = (a.shift || "").toLowerCase();
          bVal = (b.shift || "").toLowerCase();
          break;
        case "contactNo":
          aVal = a.contactNo || "";
          bVal = b.contactNo || "";
          break;
        case "isPresent":
          aVal = a.isPresent ? 1 : 0;
          bVal = b.isPresent ? 1 : 0;
          break;
        default:
          aVal = a.fullName.toLowerCase();
          bVal = b.fullName.toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [filteredData, sortColumn, sortOrder]);

  const columns = useMemo<ColumnDef<Attendee>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
            className="h-5 w-5"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="h-5 w-5"
          />
        ),
        size: 50,
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
        cell: ({ row }) => row.original.shift || "-",
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
        cell: ({ row }) => row.original.contactNo || "-",
      },
      {
        accessorKey: "isPresent",
        header: "Status",
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              row.original.isPresent
                ? "bg-green-500/20 text-green-500"
                : "bg-red-400/20 text-red-400"
            }`}
          >
            {row.original.isPresent ? "Present" : "Absent"}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
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

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const totalCount = filteredData.length;

  // Export to PDF function
  const handleExportPDF = () => {
    // Use sorted data, then filter by selection if needed
    const dataToExport =
      selectedCount > 0
        ? sortedDataForExport.filter((a) =>
            selectedRows.some((row) => row.original._id === a._id),
          )
        : sortedDataForExport;

    if (dataToExport.length === 0) {
      alert("No data to export");
      return;
    }

    // Get sort description for subtitle
    const sortColumnLabels: Record<string, string> = {
      fullName: "Name",
      course: "Course",
      batch: "Batch",
      shift: "Shift",
      contactNo: "Contact",
      isPresent: "Status",
    };
    const sortDescription = `Sorted by ${sortColumnLabels[sortColumn] || sortColumn} (${sortOrder === "asc" ? "A-Z" : "Z-A"})`;

    // Create a printable HTML document
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Attendance List</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; margin-bottom: 10px; font-size: 24px; }
          .subtitle { text-align: center; margin-bottom: 5px; color: #666; font-size: 14px; }
          .sort-info { text-align: center; margin-bottom: 15px; color: #888; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #333; padding: 8px 12px; text-align: left; font-size: 12px; }
          th { background-color: #f0f0f0; font-weight: bold; }
          tr:nth-child(even) { background-color: #fafafa; }
          .status-present { color: green; font-weight: bold; }
          .status-absent { color: red; font-weight: bold; }
          .footer { margin-top: 20px; text-align: center; font-size: 12px; color: #666; }
          .stats { margin-bottom: 15px; font-size: 14px; }
          @media print {
            body { padding: 10px; }
            h1 { font-size: 20px; }
          }
        </style>
      </head>
      <body>
        <h1>Attendance List</h1>
        <p class="subtitle">Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        <p class="sort-info">${sortDescription}</p>
        <div class="stats">
          <strong>Total:</strong> ${dataToExport.length} | 
          <strong>Present:</strong> ${dataToExport.filter((a) => a.isPresent).length} | 
          <strong>Absent:</strong> ${dataToExport.filter((a) => !a.isPresent).length}
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Full Name</th>
              <th>Course</th>
              <th>Shift</th>
              <th>Batch</th>
              <th>Contact No.</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${dataToExport
              .map(
                (attendee, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${attendee.fullName}</td>
                <td>${normalizeCourse(attendee.course)}</td>
                <td>${attendee.shift || "-"}</td>
                <td>${formatBatchYear(attendee.batch)}</td>
                <td>${attendee.contactNo || "-"}</td>
                <td class="${attendee.isPresent ? "status-present" : "status-absent"}">
                  ${attendee.isPresent ? "Present" : "Absent"}
                </td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
        <div class="footer">
          <p>Event Attendance Tracker</p>
        </div>
      </body>
      </html>
    `;

    // Open print dialog
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  // Portal target for stats in header
  const [statsPortal, setStatsPortal] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const portal = document.getElementById("print-stats-portal");
    setStatsPortal(portal);
  }, []);

  const statsContent = (
    <div className="flex items-center gap-4 sm:gap-6">
      <div className="flex items-center gap-1">
        <span className="text-xl sm:text-2xl font-bold">{selectedCount}</span>
        <span className="text-xs text-muted-foreground uppercase">
          Selected
        </span>
      </div>
      <div className="h-6 w-px bg-border" />
      <div className="flex items-center gap-1">
        <span className="text-xl sm:text-2xl font-bold">{totalCount}</span>
        <span className="text-xs text-muted-foreground uppercase">Total</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Portal stats into header */}
      {statsPortal && createPortal(statsContent, statsPortal)}

      <div className="space-y-6">
        {/* Search and Filters Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or contact..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-[130px] h-10">
                <SelectValue placeholder="Course" />
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
              <SelectTrigger className="w-[120px] h-10">
                <SelectValue placeholder="Batch" />
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
            <Select value={shiftFilter} onValueChange={setShiftFilter}>
              <SelectTrigger className="w-[120px] h-10">
                <SelectValue placeholder="Shift" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shifts</SelectItem>
                {shifts
                  ?.filter((shift) => shift && shift.trim() !== "")
                  .map((shift) => (
                    <SelectItem key={shift} value={shift}>
                      {shift}
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
              <SelectTrigger className="w-[120px] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sort Options for PDF Export */}
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/30 border">
          <span className="text-sm font-medium text-muted-foreground">
            Sort PDF by:
          </span>
          <Select value={sortColumn} onValueChange={setSortColumn}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fullName">Name</SelectItem>
              <SelectItem value="course">Course</SelectItem>
              <SelectItem value="batch">Batch Year</SelectItem>
              <SelectItem value="shift">Shift</SelectItem>
              <SelectItem value="contactNo">Contact</SelectItem>
              <SelectItem value="isPresent">Status</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sortOrder}
            onValueChange={(v) => setSortOrder(v as "asc" | "desc")}
          >
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Ascending (A-Z)</SelectItem>
              <SelectItem value="desc">Descending (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 bg-muted/30 border-b">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                {selectedCount > 0
                  ? `${selectedCount} of ${totalCount} selected`
                  : `${totalCount} attendees`}
              </span>
            </div>
            <Button onClick={handleExportPDF} size="sm" className="gap-2">
              <FileDown className="h-4 w-4" />
              {selectedCount > 0
                ? `Export ${selectedCount} to PDF`
                : "Export All to PDF"}
            </Button>
          </div>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/50">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="px-6 py-3 text-muted-foreground font-medium"
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
                    className="text-center py-16"
                  >
                    <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span>Loading attendees...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center"
                  >
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Users className="h-8 w-8 mb-2 opacity-50" />
                      <div>
                        <p className="font-medium">No attendees found</p>
                        <p className="text-sm mt-1">
                          Try adjusting your filters.
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={`transition-colors ${
                      row.getIsSelected()
                        ? "bg-primary/10 hover:bg-primary/15"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-6 py-4">
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
      </div>
    </>
  );
}

export default withConvexProvider(PrintListComponent);
