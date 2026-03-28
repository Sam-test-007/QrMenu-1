import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, numeric, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  phoneNumber: text("phone_number"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const restaurants = pgTable("restaurants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: uuid("owner_id").references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  imageUrl: text("image_url"),
  websiteUrl: text("website_url"),
  instagramUrl: text("instagram_url"),
  facebookUrl: text("facebook_url"),
  tiktokUrl: text("tiktok_url"),
  qrTokenTtlMinutes: integer("qr_token_ttl_minutes").default(60),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const menuItems = pgTable("menu_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: uuid("restaurant_id").references(() => restaurants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price").notNull(),
  category: text("category").notNull(),
  imageUrl: text("image_url"),
  available: boolean("available").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const tables = pgTable("tables", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: uuid("restaurant_id").references(() => restaurants.id, { onDelete: "cascade" }),
  tableNumber: integer("table_number").notNull(),
  name: text("name"), // Optional name like "Window Table" or "VIP Table"
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  uniqueTableNumber: sql`UNIQUE (restaurant_id, table_number)`, // Unique table number per restaurant
}));

export const tableSessions = pgTable("table_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tableId: uuid("table_id").references(() => tables.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  expiresAt: timestamp("expires_at").notNull(),
  lastActivity: timestamp("last_activity").default(sql`now()`),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").references(() => tableSessions.id, { onDelete: "cascade" }),
  status: text("status").default("pending"),
  total: numeric("total").default("0"),
  suggestion: text("suggestion"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: uuid("menu_item_id").references(() => menuItems.id, { onDelete: "cascade" }),
  quantity: integer("quantity").default(1).notNull(),
  price: numeric("price").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
});

export const insertRestaurantSchema = createInsertSchema(restaurants).omit({
  id: true,
  createdAt: true,
});

export const insertMenuItemSchema = createInsertSchema(menuItems).omit({
  id: true,
  createdAt: true,
});

export const insertTableSchema = createInsertSchema(tables).omit({
  id: true,
  createdAt: true,
});

export const insertTableSessionSchema = createInsertSchema(tableSessions).omit({
  id: true,
  createdAt: true,
  lastActivity: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
  createdAt: true,
});

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type Restaurant = typeof restaurants.$inferSelect;

export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItems.$inferSelect;

export type InsertTable = z.infer<typeof insertTableSchema>;
export type Table = typeof tables.$inferSelect;

export type InsertTableSession = z.infer<typeof insertTableSessionSchema>;
export type TableSession = typeof tableSessions.$inferSelect;

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
