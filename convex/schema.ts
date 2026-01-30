import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  attendees: defineTable({
    fullName: v.string(),
    course: v.string(),
    shift: v.optional(v.string()),
    batch: v.string(),
    contactNo: v.optional(v.string()),
    isPresent: v.boolean(),
    checkedInAt: v.optional(v.number()),
    checkedInBy: v.optional(v.string()),
  })
    .index("by_course", ["course"])
    .index("by_batch", ["batch"])
    .index("by_shift", ["shift"])
    .index("by_course_batch", ["course", "batch"])
    .index("by_isPresent", ["isPresent"]),
});

export default schema;
