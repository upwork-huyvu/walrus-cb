import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { TuyaCloudService } from '../tuya/tuya-cloud.service';
import { UsersService } from '../users/users.service';
import { ControlDeviceDto } from './dto/control-device.dto';
import {
  buildCommands,
  decodeStatus,
  parseSpecification,
  resolveMapFromCodes,
  MissingDpError,
  type Command,
  type DeviceModel,
} from './device-dp';

type CloudStatusItem = { code: string; value: unknown };
type CloudSpecEntry = { code?: string; type?: string; values?: unknown };
type CloudSpec = {
  category?: string;
  functions?: CloudSpecEntry[];
  status?: CloudSpecEntry[];
};
type CloudDeviceDetail = {
  id?: string;
  name?: string;
  online?: boolean;
  product_id?: string;
  product_name?: string;
  icon?: string;
};
type EnrichedUser = { uid: string; username?: string; nick_name?: string };

export type AdminDeviceListItem = {
  id: string;
  name: string;
  online: boolean;
  productId?: string;
  ownerUid: string;
  ownerName?: string;
  currentTemp: number | null;
  targetTemp: number | null;
};

export type AdminDeviceDetail = DeviceModel & {
  id: string;
  name: string;
  online: boolean;
  productId?: string;
};

/**
 * Thiết bị của MỘT user - đủ field cho màn "All devices" của admin.
 * Khác `AdminDeviceListItem` ở chỗ không kèm owner (đã biết owner rồi) nhưng có thêm product
 * name, time zone và mốc thời gian.
 */
export type AdminUserDeviceItem = {
  id: string;
  name: string;
  online: boolean;
  productId?: string;
  productName?: string;
  icon?: string;
  currentTemp: number | null;
  targetTemp: number | null;
  timeZone?: string;
  createTime?: number;
  updateTime?: number;
  activeTime?: number;
};

/**
 * Quản lý + điều khiển thiết bị cho admin QUA TUYA CLOUD OpenAPI (server→cloud).
 * KHÔNG dùng App SDK (client-only). Mọi lệnh raw đi qua codec base64 ở device-dp.ts.
 */
@Injectable()
export class DevicesService {
  constructor(
    private readonly tuya: TuyaCloudService,
    private readonly users: UsersService,
  ) {}

  /** Tất cả thiết bị của mọi user (duyệt users → devices). Dedupe theo id; owner đính kèm. */
  async listAllDevices(): Promise<AdminDeviceListItem[]> {
    const out: AdminDeviceListItem[] = [];
    const seen = new Set<string>();
    let page = 1;
    for (let guard = 0; guard < 20; guard++) {
      const res = await this.users.listUsers({ page_no: page, page_size: 100 });
      for (const raw of res.list) {
        const u = raw as EnrichedUser;
        const devices = await this.users.getUserDevices(u.uid).catch(() => []);
        for (const d of devices) {
          if (!d.id || seen.has(d.id)) continue;
          seen.add(d.id);
          const temps = this.decodeListTemps(d.status);
          out.push({
            id: d.id,
            name: d.name ?? '',
            online: !!d.online,
            productId: d.product_id,
            ownerUid: u.uid,
            ownerName: u.nick_name || u.username,
            currentTemp: temps.currentTemp,
            targetTemp: temps.targetTemp,
          });
        }
      }
      if (!res.has_more) break;
      page += 1;
    }
    return out;
  }

  /**
   * Thiết bị của một user cụ thể. Dùng lại `getUserDevices` (đã lược `local_key`) rồi decode
   * nhiệt độ y như danh sách phẳng - KHÔNG duyệt toàn bộ user như `listAllDevices`, nên rẻ hơn
   * hẳn khi chỉ cần xem thiết bị của một người.
   */
  async listByUser(uid: string): Promise<AdminUserDeviceItem[]> {
    const devices = await this.users.getUserDevices(uid);
    return (devices ?? [])
      .filter((d) => Boolean(d.id))
      .map((d) => {
        const temps = this.decodeListTemps(d.status);
        return {
          id: d.id,
          name: d.name ?? '',
          online: !!d.online,
          productId: d.product_id,
          productName: d.product_name,
          icon: d.icon,
          currentTemp: temps.currentTemp,
          targetTemp: temps.targetTemp,
          timeZone: d.time_zone,
          createTime: d.create_time,
          updateTime: d.update_time,
          activeTime: d.active_time,
        };
      });
  }

  /** Chi tiết 1 thiết bị: status + specification + online → model đã decode. */
  async getDevice(id: string): Promise<AdminDeviceDetail> {
    const [detail, status, specRes] = await Promise.all([
      this.tuya
        .request<CloudDeviceDetail>({ path: `/v1.0/devices/${id}` })
        .catch(() => null),
      this.tuya.request<CloudStatusItem[]>({
        path: `/v1.0/devices/${id}/status`,
      }),
      this.tuya
        .request<CloudSpec>({ path: `/v1.0/devices/${id}/specifications` })
        .catch(() => null),
    ]);
    const spec = parseSpecification(specRes);
    const model = decodeStatus(status, spec);
    return {
      ...model,
      id,
      name: detail?.name ?? '',
      online: detail?.online ?? false,
      productId: detail?.product_id,
    };
  }

  /**
   * Gửi lệnh điều khiển. Đọc spec + status trước (spec để resolve code/kiểu; status để lấy raw hiện
   * tại cho ghi target). Offline → 409. Thiếu DP tương ứng → 400 (KHÔNG gửi bừa).
   */
  async sendCommand(
    id: string,
    dto: ControlDeviceDto,
  ): Promise<{ ok: boolean; commands: Command[] }> {
    if (
      dto.target === undefined &&
      dto.power === undefined &&
      dto.light === undefined &&
      dto.purify === undefined
    ) {
      throw new BadRequestException('Không có lệnh nào để gửi.');
    }

    const [detail, status, specRes] = await Promise.all([
      this.tuya
        .request<CloudDeviceDetail>({ path: `/v1.0/devices/${id}` })
        .catch(() => null),
      this.tuya.request<CloudStatusItem[]>({
        path: `/v1.0/devices/${id}/status`,
      }),
      this.tuya
        .request<CloudSpec>({ path: `/v1.0/devices/${id}/specifications` })
        .catch(() => null),
    ]);

    if (detail?.online === false) {
      throw new ConflictException(
        'Thiết bị đang offline - không gửi lệnh được.',
      );
    }

    const spec = parseSpecification(specRes);
    const targetCode = spec.map.targetTemp;
    const currentRaw = targetCode
      ? (status ?? []).find((s) => s.code === targetCode)?.value
      : undefined;

    let commands: Command[];
    try {
      commands = buildCommands(
        dto,
        spec,
        typeof currentRaw === 'string' ? currentRaw : undefined,
      );
    } catch (e) {
      if (e instanceof MissingDpError) throw new BadRequestException(e.message);
      throw e;
    }
    if (commands.length === 0) {
      throw new BadRequestException('Không dựng được lệnh (thiếu DP?).');
    }

    const ok = await this.tuya.request<boolean>({
      method: 'POST',
      path: `/v1.0/devices/${id}/commands`,
      body: { commands },
    });
    return { ok: !!ok, commands };
  }

  /**
   * Decode nhanh temp cho danh sách (khi thiết bị có `status` inline). KHÔNG có specification nên
   * giả định scale 1 cho DP nhiệt độ (đúng cho ice bath; trang detail decode chính xác theo spec).
   */
  private decodeListTemps(status?: CloudStatusItem[]): {
    currentTemp: number | null;
    targetTemp: number | null;
  } {
    if (!status?.length) return { currentTemp: null, targetTemp: null };
    const map = resolveMapFromCodes(status.map((s) => s.code));
    const values = map.currentTemp
      ? { [map.currentTemp]: { scale: 1, unit: '°C' } }
      : {};
    const m = decodeStatus(status, { map, types: {}, values });
    return { currentTemp: m.currentTemp, targetTemp: m.targetTemp };
  }
}
