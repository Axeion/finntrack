CREATE TABLE IF NOT EXISTS "accounts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"org" varchar NOT NULL,
	"balance" numeric NOT NULL,
	"balance_date" timestamp NOT NULL,
	"currency" varchar DEFAULT 'USD',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bill_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" integer,
	"transaction_id" varchar,
	"paid_date" timestamp NOT NULL,
	"paid_amount" numeric NOT NULL,
	"month" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"amount" numeric NOT NULL,
	"due_day" integer NOT NULL,
	"category" varchar NOT NULL,
	"is_variable" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"payee_match" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categorization_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"payee_pattern" varchar NOT NULL,
	"category" varchar NOT NULL,
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "net_worth_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"month" varchar NOT NULL,
	"total_assets" numeric NOT NULL,
	"account_balances" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "net_worth_snapshots_month_unique" UNIQUE("month")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spending_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar NOT NULL,
	"monthly_limit" numeric NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "spending_targets_category_unique" UNIQUE("category")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"synced_at" timestamp DEFAULT now(),
	"accounts_synced" integer,
	"transactions_imported" integer,
	"transactions_categorized" integer,
	"bills_matched" integer,
	"status" varchar,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transaction_splits" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" varchar NOT NULL,
	"category" varchar NOT NULL,
	"amount" numeric NOT NULL,
	"note" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"account_id" varchar,
	"posted" timestamp NOT NULL,
	"amount" numeric NOT NULL,
	"payee" varchar NOT NULL,
	"memo" varchar,
	"category" varchar,
	"category_confidence" numeric,
	"is_pending" boolean DEFAULT false,
	"is_recurring" boolean DEFAULT false,
	"recurring_period" varchar,
	"raw_description" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "is_recurring" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "recurring_period" varchar;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
