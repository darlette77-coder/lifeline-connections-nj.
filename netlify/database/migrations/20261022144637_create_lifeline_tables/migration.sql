CREATE TABLE "resource_capacity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"resource_id" uuid,
	"total_capacity" integer,
	"current_occupancy" integer,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_name" varchar(255) NOT NULL,
	"nims_category" varchar(100) NOT NULL,
	"nims_type" integer,
	"zip_code" varchar(10) NOT NULL,
	"address" text NOT NULL,
	"latitude" numeric(10,7),
	"longitude" numeric(10,7),
	"phone_number" varchar(20),
	"operating_hours" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "resources_nims_type_check" CHECK ("nims_type" BETWEEN 1 AND 4)
);
--> statement-breakpoint
CREATE TABLE "search_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"zip_code" varchar(10) NOT NULL,
	"searched_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "weather_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"zip_code" varchar(10) NOT NULL,
	"nws_id" varchar(150),
	"event_type" varchar(150) NOT NULL,
	"severity" varchar(50),
	"headline" text,
	"description" text,
	"effective" timestamp with time zone,
	"expires" timestamp with time zone,
	"raw_payload" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "zip_code_mappings" (
	"zip_code" varchar(10) PRIMARY KEY,
	"county" varchar(100),
	"place_name" varchar(150),
	"state" varchar(2),
	"latitude" numeric(10,7) NOT NULL,
	"longitude" numeric(10,7) NOT NULL,
	"nws_grid_id" varchar(10),
	"nws_grid_x" integer,
	"nws_grid_y" integer,
	"resolved_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_resources_zip" ON "resources" ("zip_code");--> statement-breakpoint
CREATE INDEX "idx_resources_nims" ON "resources" ("nims_category","nims_type");--> statement-breakpoint
CREATE INDEX "idx_weather_alerts_zip" ON "weather_alerts" ("zip_code");--> statement-breakpoint
CREATE INDEX "idx_weather_alerts_fetched" ON "weather_alerts" ("fetched_at");--> statement-breakpoint
ALTER TABLE "resource_capacity" ADD CONSTRAINT "resource_capacity_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;