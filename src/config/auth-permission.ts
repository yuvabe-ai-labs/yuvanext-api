import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

const statement = {
  ...defaultStatements,
  internship: [
    "apply",
    "revoke",
    "read",
    "update",
    "delete",
    "create",
    "manage",
  ],
} as const;

export const ac = createAccessControl(statement);

export const admin = ac.newRole({
  ...adminAc.statements,
});

export const candidate = ac.newRole({
  internship: ["apply", "revoke", "read"],
});
export const unit = ac.newRole({
  internship: ["read", "update", "delete", "create", "manage"],
});

export const mentor = ac.newRole({
  internship: ["read", "update", "apply", "revoke"],
});
