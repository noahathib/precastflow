import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  version: integer("version").notNull().default(0),
  updated: text("updated").notNull(),
});
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  room: text("room").notNull(),
  role: text("role").notNull(),
  name: text("name").notNull(),
  expires: integer("expires").notNull(),
});
export const members = sqliteTable("members", {
  email: text("email").primaryKey(),
  role: text("role").notNull(),
});
