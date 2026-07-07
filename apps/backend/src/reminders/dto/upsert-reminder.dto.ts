import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Body PUT /reminders/:deviceId - tạo/cập nhật reminder. Cả 2 field optional (partial update). */
export class UpsertReminderDto {
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  intervalDays?: number;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
