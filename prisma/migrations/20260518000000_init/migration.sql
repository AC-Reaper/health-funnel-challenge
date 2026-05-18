-- Required for gen_random_uuid(). Supabase enables this by default,
-- but other Postgres installs may not.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('draft', 'submitted');

-- CreateEnum
CREATE TYPE "step_key" AS ENUM ('gender', 'main_goal', 'age', 'height', 'weight', 'activity');

-- CreateEnum
CREATE TYPE "entitlement_status" AS ENUM ('free', 'paid');

-- CreateEnum
CREATE TYPE "gender" AS ENUM ('female', 'male');

-- CreateEnum
CREATE TYPE "main_goal" AS ENUM ('lose_weight', 'maintain', 'gain_weight', 'build_muscle');

-- CreateEnum
CREATE TYPE "activity_level" AS ENUM ('sedentary', 'light', 'moderate', 'active', 'very_active');

-- CreateEnum
CREATE TYPE "bmi_category" AS ENUM ('underweight', 'normal', 'overweight', 'obese_i', 'obese_ii', 'obese_iii');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('succeeded', 'failed');

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "status" "session_status" NOT NULL DEFAULT 'draft',
    "current_step" "step_key",
    "entitlement_status" "entitlement_status" NOT NULL DEFAULT 'free',
    "paid_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "user_agent" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment" (
    "session_id" UUID NOT NULL,
    "gender" "gender",
    "main_goal" "main_goal",
    "age_years" INTEGER,
    "height_cm" INTEGER,
    "weight_kg" DECIMAL(5,2),
    "target_weight_kg" DECIMAL(5,2),
    "activity_level" "activity_level",
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "assessment_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "result" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "bmi" DECIMAL(5,2) NOT NULL,
    "bmi_category" "bmi_category" NOT NULL,
    "daily_calories_kcal" INTEGER NOT NULL,
    "predicted_target_date" DATE,
    "curve_points_json" JSONB NOT NULL DEFAULT '[]',
    "plan_json" JSONB,
    "algorithm_version" TEXT NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "status" "payment_status" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_updated_at_idx" ON "session"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "result_session_id_key" ON "result"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_session_id_idempotency_key_key" ON "payment"("session_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result" ADD CONSTRAINT "result_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Partial unique index — DB-level backstop for ADR-012: at most one
-- successful payment per session. Prisma cannot model partial indexes,
-- so this stays SQL-only and is documented in docs/03-database-design.md.
CREATE UNIQUE INDEX "payment_one_success_per_session_idx"
    ON "payment" ("session_id")
    WHERE "status" = 'succeeded';
