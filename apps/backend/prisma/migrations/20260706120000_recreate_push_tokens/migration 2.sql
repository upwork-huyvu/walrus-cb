-- Hồi sinh bảng push_tokens (đã bị drop ở migration 20260703163225_drop_push_tokens).
-- Dùng khi NOTIFICATION_PROVIDER=fcm: map FCM token ↔ Tuya uid.

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL,
    "tuyaUid" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "push_tokens_tuyaUid_idx" ON "push_tokens"("tuyaUid");
