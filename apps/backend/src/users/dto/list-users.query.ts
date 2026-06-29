import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListUsersQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page_no: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100) // Tuya giới hạn page_size ≤ 100
  @IsOptional()
  page_size: number = 50;

  @IsString()
  @IsOptional()
  username?: string;
}
