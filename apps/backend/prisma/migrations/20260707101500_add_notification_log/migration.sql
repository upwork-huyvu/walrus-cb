-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "tuyaUid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "data" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_logs_tuyaUid_sentAt_idx" ON "notification_logs"("tuyaUid", "sentAt");
