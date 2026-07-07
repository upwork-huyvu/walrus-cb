import { IsString, MinLength } from 'class-validator';

/** Body cho DELETE /push/tokens - mobile gỡ token khi logout. */
export class UnregisterTokenDto {
  @IsString()
  @MinLength(1)
  token!: string;
}
