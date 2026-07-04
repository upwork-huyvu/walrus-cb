import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Query phân trang danh sách template (doc d42a2cefb7): mặc định page 1, size 50, mới nhất trước. */
export class ListTemplatesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page_no?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number;

  /** 0 = cũ trước · 1 = mới trước (theo creation time). */
  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  sort?: number;
}
