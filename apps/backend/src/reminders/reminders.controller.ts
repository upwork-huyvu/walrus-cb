import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  MobileAuthGuard,
  type AuthedRequest,
} from '../mobile-auth/mobile-auth.guard';
import { DeviceOwnershipGuard } from '../mobile-auth/device-ownership.guard';
import { RemindersService } from './reminders.service';
import { UpsertReminderDto } from './dto/upsert-reminder.dto';

/**
 * Reminder bảo trì theo thiết bị (mobile-facing). MobileAuthGuard (api-key + uid) + DeviceOwnershipGuard
 * (deviceId phải thuộc uid) → chỉ CRUD reminder của thiết bị mình sở hữu (AC3).
 */
@Controller('reminders')
@UseGuards(MobileAuthGuard, DeviceOwnershipGuard)
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get(':deviceId')
  get(@Param('deviceId') deviceId: string) {
    return this.reminders.getForDevice(deviceId);
  }

  @Put(':deviceId')
  upsert(
    @Req() req: AuthedRequest,
    @Param('deviceId') deviceId: string,
    @Body() dto: UpsertReminderDto,
  ) {
    const uid = req.uid;
    if (!uid) throw new UnauthorizedException('Chưa xác thực uid'); // MobileAuthGuard đảm bảo có; phòng thủ
    return this.reminders.upsertForDevice(uid, deviceId, dto);
  }

  @Post(':deviceId/mark-replaced')
  markReplaced(@Param('deviceId') deviceId: string) {
    return this.reminders.markReplaced(deviceId);
  }

  @Delete(':deviceId')
  @HttpCode(204)
  async remove(@Param('deviceId') deviceId: string): Promise<void> {
    await this.reminders.deleteForDevice(deviceId);
  }
}
