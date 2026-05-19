-- CreateTable
CREATE TABLE "step_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "step_key" "step_key" NOT NULL,
    "value_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "step_event_session_id_created_at_idx" ON "step_event"("session_id", "created_at");

-- AddForeignKey
ALTER TABLE "step_event" ADD CONSTRAINT "step_event_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
