import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all attendees
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("attendees").collect();
  },
});

// Get attendees with filters
export const getFiltered = query({
  args: {
    course: v.optional(v.string()),
    batch: v.optional(v.string()),
    shift: v.optional(v.string()),
    presentOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let results;

    if (args.course && args.batch) {
      results = await ctx.db
        .query("attendees")
        .withIndex("by_course_batch", (q) =>
          q.eq("course", args.course!).eq("batch", args.batch!),
        )
        .collect();
    } else if (args.course) {
      results = await ctx.db
        .query("attendees")
        .withIndex("by_course", (q) => q.eq("course", args.course!))
        .collect();
    } else if (args.batch) {
      results = await ctx.db
        .query("attendees")
        .withIndex("by_batch", (q) => q.eq("batch", args.batch!))
        .collect();
    } else {
      results = await ctx.db.query("attendees").collect();
    }

    if (args.shift) {
      results = results.filter((a) => a.shift === args.shift);
    }

    if (args.presentOnly) {
      return results.filter((a) => a.isPresent);
    }

    return results;
  },
});

// Get attendance stats
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("attendees").collect();
    const present = all.filter((a) => a.isPresent).length;
    const absent = all.length - present;

    return {
      total: all.length,
      present,
      absent,
      percentage: all.length > 0 ? Math.round((present / all.length) * 100) : 0,
    };
  },
});

// Mark attendance (single)
export const markAttendance = mutation({
  args: {
    id: v.id("attendees"),
    isPresent: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isPresent: args.isPresent,
      checkedInAt: args.isPresent ? Date.now() : undefined,
    });
  },
});

// Mark attendance (bulk)
export const markBulkAttendance = mutation({
  args: {
    ids: v.array(v.id("attendees")),
    isPresent: v.boolean(),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.patch(id, {
        isPresent: args.isPresent,
        checkedInAt: args.isPresent ? Date.now() : undefined,
      });
    }
  },
});

// Add single attendee
export const addAttendee = mutation({
  args: {
    fullName: v.string(),
    course: v.string(),
    batch: v.string(),
    shift: v.optional(v.string()),
    contactNo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("attendees", {
      ...args,
      isPresent: false,
    });
  },
});

// Bulk import attendees
export const bulkImport = mutation({
  args: {
    attendees: v.array(
      v.object({
        fullName: v.string(),
        course: v.string(),
        batch: v.string(),
        shift: v.optional(v.string()),
        contactNo: v.optional(v.string()),
        isPresent: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const attendee of args.attendees) {
      const { isPresent, ...rest } = attendee;
      const id = await ctx.db.insert("attendees", {
        ...rest,
        isPresent: isPresent ?? false,
        checkedInAt: isPresent ? Date.now() : undefined,
      });
      ids.push(id);
    }
    return { imported: ids.length };
  },
});

// Delete attendee
export const deleteAttendee = mutation({
  args: {
    id: v.id("attendees"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Clear all attendees
export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("attendees").collect();
    for (const attendee of all) {
      await ctx.db.delete(attendee._id);
    }
    return { deleted: all.length };
  },
});

// Reset all attendance (mark all as absent)
export const resetAttendance = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("attendees").collect();
    for (const attendee of all) {
      await ctx.db.patch(attendee._id, {
        isPresent: false,
        checkedInAt: undefined,
      });
    }
    return { reset: all.length };
  },
});

// Get unique courses
export const getCourses = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("attendees").collect();
    return [...new Set(all.map((a) => a.course))].sort();
  },
});

// Get unique batches
export const getBatches = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("attendees").collect();
    return [...new Set(all.map((a) => a.batch))].sort();
  },
});

// Get unique shifts
export const getShifts = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("attendees").collect();
    const shifts = all
      .map((a) => a.shift)
      .filter((s): s is string => s !== undefined);
    return [...new Set(shifts)].sort();
  },
});
