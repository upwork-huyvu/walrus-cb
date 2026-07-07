import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import type { AuthedRequest } from './mobile-auth.guard';

/**
 * Siết endpoint device-scoped: xác minh `deviceId` (param) THUỘC `uid` (req.uid) qua Tuya Cloud
 * (`GET /v1.0/users/{uid}/devices`) → chỉ đụng được reminder của thiết bị mình sở hữu (thu hẹp lỗ hổng khai-uid).
 * Phải chạy SAU MobileAuthGuard (cần req.uid). TODO: cache ngắn theo uid để đỡ gọi Tuya mỗi request.
 */
@Injectable()
export class DeviceOwnershipGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const uid = req.uid;
    if (!uid) throw new UnauthorizedException('Chưa xác thực uid');

    const deviceId = (req.params as { deviceId?: string }).deviceId;
    if (!deviceId) throw new BadRequestException('Thiếu deviceId');

    const devices = await this.users.getUserDevices(uid);
    if (!devices.some((d) => d.id === deviceId)) {
      throw new ForbiddenException('Thiết bị không thuộc user này');
    }
    return true;
  }
}
