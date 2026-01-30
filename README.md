# Attendance Tracker

A real-time attendance tracking application for college events built with Astro, React, and Convex.

## Features

- **Real-time Updates**: Multiple users can mark attendance simultaneously with live sync
- **CSV Import**: Bulk import attendees from CSV files
- **Search & Filter**: Filter by course, batch, and search by name/roll number
- **Statistics Dashboard**: View total, present, absent counts and attendance percentage
- **Export**: Export attendance data to CSV

## Tech Stack

- **Frontend**: Astro + React
- **Backend**: Convex (real-time database)
- **Styling**: Tailwind CSS + shadcn/ui

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Set up Convex:

   ```bash
   npx convex dev
   ```

3. Run the development server:
   ```bash
   pnpm dev
   ```

## Pages

- `/` - Main attendance page with table and checkboxes
- `/admin` - Admin page for CSV import and data management

## CSV Format

The CSV file should have the following columns:

- `name` (required) - Attendee's full name
- `course` (required) - Course/Program name
- `batch` (required) - Batch/Year/Section
- `rollNo` (optional) - Roll number or ID
- `email` (optional) - Email address

Example:

```csv
name,course,batch,rollNo,email
John Doe,Computer Science,2024,CS001,john@example.com
Jane Smith,Electronics,2024,EC002,jane@example.com
```
