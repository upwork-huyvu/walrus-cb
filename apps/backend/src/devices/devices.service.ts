import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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

/** `GET /v2.0/cloud/thing/{id}/shadow/properties` - giá trị DP hiện tại. */
type CloudShadow = {
  properties?: { code?: string; value?: unknown }[];
};

/** `GET /v2.0/cloud/thing/{id}/model` - `model` là CHUỖI JSON của thing model. */
type CloudModelResult = { model?: string };
type ThingModel = {
  services?: {
    properties?: {
      code?: string;
      accessMode?: string; // ro | rw | wr
      typeSpec?: { type?: string } & Record<string, unknown>;
    }[];
  }[];
};

/**
 * Thing model (v2.0) đặt tên kiểu bằng CHỮ THƯỜNG, còn specification v1.0 - thứ mà `device-dp.ts`
 * so sánh (`type === 'Raw'`) - dùng chữ hoa. Không quy đổi thì `setting_temp` mất nhánh decode raw
 * và setpoint đọc ra rác.
 */
const THING_MODEL_TYPES: Record<string, string> = {
  value: 'Integer',
  bool: 'Boolean',
  enum: 'Enum',
  string: 'String',
  raw: 'Raw',
  bitmap: 'Bitmap',
  json: 'Json',
};
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

  /**
   * Tất cả thiết bị của mọi user. Dedupe theo id; owner đính kèm.
   *
   * Dùng `loadRoster()` của UsersService - chính danh sách user đầy đủ mà trang `/users` hiển
   * thị, và đã kèm sẵn thiết bị nên không phải gọi lại `/users/{uid}/devices` lần hai.
   */
  async listAllDevices(): Promise<AdminDeviceListItem[]> {
    const roster = await this.users.loadRoster();
    const out: AdminDeviceListItem[] = [];
    const seen = new Set<string>();
    for (const { info, devices } of roster) {
      for (const d of devices ?? []) {
        if (!d.id || seen.has(d.id)) continue;
        seen.add(d.id);
        const temps = this.decodeListTemps(d.status);
        out.push({
          id: d.id,
          name: d.name ?? '',
          online: !!d.online,
          productId: d.product_id,
          ownerUid: info.uid,
          ownerName: info.nick_name || info.username,
          currentTemp: temps.currentTemp,
          targetTemp: temps.targetTemp,
        });
      }
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
    const { detail, status, spec: specRes } = await this.readDeviceState(id);
    // Không đọc nổi cả detail = thiết bị thực sự ngoài tầm với (thuộc app SDK cũ → 1106).
    // Trả vỏ rỗng `name:''/online:false` thì admin tưởng thiết bị tồn tại mà hỏng, tệ hơn 404.
    if (!detail) {
      throw new NotFoundException(
        'Không đọc được thiết bị này từ Tuya (có thể thuộc tài khoản của app SDK cũ).',
      );
    }
    const spec = parseSpecification(specRes);
    const model = decodeStatus(status, spec);
    return {
      ...model,
      id,
      name: detail.name ?? '',
      online: detail.online ?? false,
      productId: detail.product_id,
    };
  }

  /**
   * Đọc detail + status + specification, chịu được việc Tuya từ chối từng phần.
   *
   * ⚠️ `/v1.0/devices/{id}/status` + `/specifications` KHÔNG dùng được cho chính con bồn. Đo trên
   * thiết bị thật (2026-09-28, "Walrus amara" - model **g0cv1c**, đang ONLINE): Tuya trả
   * `2003 function not support` và `2009 not support this device`, còn `/v1.0/iot-03/.../status`
   * tuy trả 200 nhưng là MẢNG RỖNG. Endpoint duy nhất có dữ liệu thật là bộ **v2.0 cloud/thing**
   * (`shadow/properties` cho giá trị, `model` cho schema) - trả đủ 12 DP gồm `sensor_1`(101),
   * `setting_temp`(115), `setting_pwr`(121), `setting_clr`(122), `setting_4`(124).
   */
  private async readDeviceState(id: string): Promise<{
    detail: CloudDeviceDetail | null;
    status: CloudStatusItem[];
    spec: CloudSpec | null;
  }> {
    const [detail, status, spec] = await Promise.all([
      this.tuya
        .request<CloudDeviceDetail>({ path: `/v1.0/devices/${id}` })
        .catch(() => null),
      this.readStatus(id),
      this.readSpec(id),
    ]);
    return { detail, status, spec };
  }

  /** Giá trị DP: `/v1.0/.../status` trước, rỗng/lỗi thì lấy shadow properties (v2.0). */
  private async readStatus(id: string): Promise<CloudStatusItem[]> {
    const v1 = await this.tuya
      .request<CloudStatusItem[]>({ path: `/v1.0/devices/${id}/status` })
      .catch(() => null);
    if (v1?.length) return v1;

    const shadow = await this.tuya
      .request<CloudShadow>({
        path: `/v2.0/cloud/thing/${id}/shadow/properties`,
      })
      .catch(() => null);
    const props = (shadow?.properties ?? []).filter(
      (p): p is { code: string; value: unknown } => Boolean(p.code),
    );
    return props.length
      ? props.map((p) => ({ code: p.code, value: p.value }))
      : [];
  }

  /** Schema DP: `/v1.0/.../specifications` trước, rỗng/lỗi thì quy đổi từ thing model (v2.0). */
  private async readSpec(id: string): Promise<CloudSpec | null> {
    const v1 = await this.tuya
      .request<CloudSpec>({ path: `/v1.0/devices/${id}/specifications` })
      .catch(() => null);
    if (v1?.functions?.length || v1?.status?.length) return v1;

    const res = await this.tuya
      .request<CloudModelResult>({ path: `/v2.0/cloud/thing/${id}/model` })
      .catch(() => null);
    return this.thingModelToSpec(res) ?? v1;
  }

  /**
   * Thing model → hình dạng specification mà `parseSpecification` hiểu.
   * `accessMode: 'ro'` chỉ vào `status` (đọc được nhưng KHÔNG gửi lệnh được); còn lại vào cả
   * `functions` để `buildCommands` cho phép điều khiển.
   */
  private thingModelToSpec(res: CloudModelResult | null): CloudSpec | null {
    if (!res?.model) return null;
    let model: ThingModel;
    try {
      model = JSON.parse(res.model) as ThingModel;
    } catch {
      return null;
    }

    const functions: CloudSpecEntry[] = [];
    const status: CloudSpecEntry[] = [];
    for (const svc of model.services ?? []) {
      for (const p of svc.properties ?? []) {
        if (!p.code) continue;
        const rawType = String(p.typeSpec?.type ?? '');
        const entry: CloudSpecEntry = {
          code: p.code,
          type: THING_MODEL_TYPES[rawType] ?? rawType,
          // `parseSpecification` đọc `values` như CHUỖI JSON (min/max/scale/unit) - `typeSpec`
          // đúng hình dạng đó nên serialize thẳng là dùng được.
          values: JSON.stringify(p.typeSpec ?? {}),
        };
        status.push(entry);
        if (p.accessMode && p.accessMode !== 'ro') functions.push(entry);
      }
    }
    return status.length ? { functions, status } : null;
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

    const { detail, status, spec: specRes } = await this.readDeviceState(id);

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
