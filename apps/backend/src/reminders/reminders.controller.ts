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
 * Reminder bảo trì theo thiết bị (mobile-facing). Đọc/ghi dùng DeviceOwnershipGuard với danh sách
 * Tuya live. DELETE chạy sau remove Tuya nên xác minh uid bằng row reminder đã lưu trong service.
 */
@Controller('reminders')
@UseGuards(MobileAuthGuard)
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get(':deviceId')
  @UseGuards(DeviceOwnershipGuard)
  get(@Param('deviceId') deviceId: string) {
    return this.reminders.getForDevice(deviceId);
  }

  @Put(':deviceId')
  @UseGuards(DeviceOwnershipGuard)
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
  @UseGuards(DeviceOwnershipGuard)
  markReplaced(@Param('deviceId') deviceId: string) {
    return this.reminders.markReplaced(deviceId);
  }

  @Delete(':deviceId')
  @HttpCode(204)
  // Không dùng DeviceOwnershipGuard ở đây: sau removeDevice, Tuya không còn trả device trong user list.
  async remove(
    @Req() req: AuthedRequest,
    @Param('deviceId') deviceId: string,
  ): Promise<void> {
    const uid = req.uid;
    if (!uid) throw new UnauthorizedException('Chưa xác thực uid');
    await this.reminders.deleteOwnedForDevice(uid, deviceId);
  }
}
