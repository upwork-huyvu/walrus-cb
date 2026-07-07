-- Nhắc bảo trì theo thiết bị (m1-device-reminders). deviceId unique = mỗi thiết bị 1 reminder.

-- CreateTable
CREATE TABLE "device_reminders" (
    "id" TEXT NOT NULL,
    "tuyaUid" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'filter',
    "intervalDays" INTEGER NOT NULL DEFAULT 90,
    "lastReplacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastNotifiedStage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_reminders_deviceId_key" ON "device_reminders"("deviceId");

-- CreateIndex
CREATE INDEX "device_reminders_tuyaUid_idx" ON "device_reminders"("tuyaUid");
