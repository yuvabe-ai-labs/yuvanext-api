import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// =====================================================
// INVITATION TABLE
// =====================================================

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    invitationToken: text("invitation_token").notNull().unique(),
    invitationUrl: text("invitation_url"),
    role: text("role").notNull().default("candidate"), // "candidate" or "unit"
    companyName: text("company_name"),
    companyType: text("company_type"),
    contactNumber: text("contact_number"),
    industryType: text("industry_type"),
    address: text("address"),
    aboutCompany: text("about_company"),
    serviceOffered: text("service_offered"),
    achievements: text("achievements"),
    // Additional metadata for any role-specific data
    metadata: jsonb("metadata"),
    status: text("status").notNull().default("pending"), // "pending", "accepted", "expired"
    invitedAt: timestamp("invited_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(), // 7 days from creation
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    emailIdx: index("invitations_email_idx").on(table.email),
    tokenIdx: index("invitations_token_idx").on(table.invitationToken),
    statusIdx: index("invitations_status_idx").on(table.status),
  }),
);

// =====================================================
// RELATIONS
// =====================================================

export const invitationsRelations = relations(invitations, ({ many }) => ({
  // Can extend relations if needed
}));
