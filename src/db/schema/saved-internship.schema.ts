import { relations } from "drizzle-orm";
import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { candidates } from "./candidate.schema";
import { internships } from "./internship.schema";

export const savedInternship = pgTable(
  "saved_internship",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.userId, { onDelete: "cascade" }), // ADD THIS

    internshipId: uuid("internship_id")
      .notNull()
      .references(() => internships.id, { onDelete: "cascade" }), // OPTIONAL
    createdAt: timestamp("created_at", {
      withTimezone: true,
      precision: 0,
    }).defaultNow(),
  },
  (table) => ({
    candidateIdIdx: index("saved_internship_candidate_id_index").on(
      table.candidateId,
    ),
    internshipIdIdx: index("saved_internship_internship_id_index").on(
      table.internshipId,
    ),
  }),
);

export const savedInternshipRelations = relations(
  savedInternship,
  ({ one }) => ({
    candidate: one(candidates, {
      fields: [savedInternship.candidateId],
      references: [candidates.userId],
    }),

    internship: one(internships, {
      fields: [savedInternship.internshipId],
      references: [internships.id],
    }),
  }),
);
