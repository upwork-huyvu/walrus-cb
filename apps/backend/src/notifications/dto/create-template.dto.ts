import { IsIn, IsInt, IsString, Length } from 'class-validator';

/**
 * Body cho POST /notifications/templates - tạo template (submit để Tuya duyệt).
 * Giới hạn độ dài theo Tuya: name≤30, title≤40, content≤100, remark≤100.
 */
export class CreateTemplateDto {
  /** Tên template (nội bộ, không hiển thị cho user). */
  @IsString()
  @Length(1, 30)
  name!: string;

  /** Tiêu đề push (có thể chứa biến `${var}`). */
  @IsString()
  @Length(1, 40)
  title!: string;

  /** Nội dung push (có thể chứa biến `${var}`). */
  @IsString()
  @Length(1, 100)
  content!: string;

  /** Phân loại: 0 = operations message, 1 = system message. */
  @IsInt()
  @IsIn([0, 1])
  type!: number;

  /** Ghi chú mục đích (phục vụ khâu duyệt của Tuya). */
  @IsString()
  @Length(1, 100)
  remark!: string;
}
