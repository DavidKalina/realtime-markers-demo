-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateTable
CREATE TABLE "markers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "location" JSONB NOT NULL,
    "emoji" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "markers_pkey" PRIMARY KEY ("id")
);
