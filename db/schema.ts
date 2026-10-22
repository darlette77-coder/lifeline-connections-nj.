import { sql } from "drizzle-orm";
import {
  pgTable, uuid, varchar, text, integer, numeric, jsonb, boolean, timestamp, index, check,
} from "drizzle-orm/pg-core";

// NIMS-typed community resources
export const resources = pgTable(
  "resources",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationName: varchar("organization_name", { length: 255 }).notNull(),
    nimsCategory: varchar("nims_category", { length: 100 }).notNull(), // e.g. 'Emergency Housing'
    nimsType: integer("nims_type"), // 1 = highest acuity, 4 = basic
    zipCode: varchar("zip_code", { length: 10 }).notNull(),
    address: text().notNull(),
    latitude: numeric({ precision: 10, scale: 7 }),
    longitude: numeric({ precision: 10, scale: 7 }),
    phoneNumber: varchar("phone_number", { length: 20 }),
    operatingHours: jsonb("operating_hours"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_resources_zip").on(t.zipCode),
    index("idx_resources_nims").on(t.nimsCategory, t.nimsType),
    check("resources_nims_type_check", sql`${t.nimsType} BETWEEN 1 AND 4`),
  ],
);

// Zip code -> lat/long -> NWS grid cache
export const zipCodeMappings = pgTable("zip_code_mappings", {
  zipCode: varchar("zip_code", { length: 10 }).primaryKey(),
  county: varchar({ length: 100 }),
  placeName: varchar("place_name", { length: 150 }),
  state: varchar({ length: 2 }),
  latitude: numeric({ precision: 10, scale: 7 }).notNull(),
  longitude: numeric({ precision: 10, scale: 7 }).notNull(),
  nwsGridId: varchar("nws_grid_id", { length: 10 }),
  nwsGridX: integer("nws_grid_x"),
  nwsGridY: integer("nws_grid_y"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }).defaultNow(),
});

// Weather alerts cache (pulled from api.weather.gov, keyed by zip)
export const weatherAlerts = pgTable(
  "weather_alerts",
  {
    id: uuid().primaryKey().defaultRandom(),
    zipCode: varchar("zip_code", { length: 10 }).notNull(),
    nwsId: varchar("nws_id", { length: 150 }),
    eventType: varchar("event_type", { length: 150 }).notNull(),
    severity: varchar({ length: 50 }),
    headline: text(),
    description: text(),
    effective: timestamp({ withTimezone: true }),
    expires: timestamp({ withTimezone: true }),
    rawPayload: jsonb("raw_payload"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_weather_alerts_zip").on(t.zipCode),
    index("idx_weather_alerts_fetched").on(t.fetchedAt),
  ],
);

// Resource capacity tracking (optional, useful for shelters)
export const resourceCapacity = pgTable("resource_capacity", {
  id: uuid().primaryKey().defaultRandom(),
  resourceId: uuid("resource_id").references(() => resources.id, { onDelete: "cascade" }),
  totalCapacity: integer("total_capacity"),
  currentOccupancy: integer("current_occupancy"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Search analytics (demand patterns by area; no personal data stored)
export const searchLog = pgTable("search_log", {
  id: uuid().primaryKey().defaultRandom(),
  zipCode: varchar("zip_code", { length: 10 }).notNull(),
  searchedAt: timestamp("searched_at", { withTimezone: true }).defaultNow(),
});
