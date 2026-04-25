import { customType } from "drizzle-orm/pg-core";

// citext is a Postgres extension type for case-insensitive text.
// `create extension if not exists citext;` must run before the first migration that uses it.
export const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  },
});
