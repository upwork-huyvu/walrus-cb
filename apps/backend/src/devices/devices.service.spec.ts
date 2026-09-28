import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import type { TuyaCloudService } from '../tuya/tuya-cloud.service';
import type { UsersService } from '../users/users.service';

const TEMP_B64 = 'ACgAKP///////////////w=='; // setpoint 4.0°C (word0=40)
const TEMP75_B64 = 'AEsAKP///////////////w=='; // sau khi đổi word0 → 7.5°C
const RANGE_B64 = 'AJYAFACWABQAlgAUAJYAFP////////////////////8=';

const SPEC = {
  functions: [
    { code: 'setting_temp', type: 'Raw', values: '{}' },
    { code: 'setting_pwr', type: 'Boolean', values: '{}' },
    { code: 'setting_4', type: 'Boolean', values: '{}' },
    { code: 'setting_clr', type: 'Boolean', values: '{}' },
    { code: 'setting_temp_range', type: 'Raw', values: '{}' },
  ],
  status: [
    {
      code: 'sensor_1',
      type: 'Integer',
      values: '{"scale":1,"unit":"℃"}',
    },
  ],
};

const STATUS = [
  { code: 'sensor_1', value: 64 },
  { code: 'setting_temp', value: TEMP_B64 },
  { code: 'setting_temp_range', value: RANGE_B64 },
  { code: 'setting_pwr', value: true },
  { code: 'setting_4', value: false },
  { code: 'setting_clr', value: false },
];

/** TuyaCloudService giả: route theo path, ghi lại lệnh POST để assert. */
function makeTuya(overrides?: {
  online?: boolean;
  status?: unknown;
  spec?: unknown;
}) {
  const posted: { path: string; body: unknown }[] = [];
  const request = jest.fn(
    (req: { method?: string; path: string; body?: unknown }) => {
      const { path, method = 'GET', body } = req;
      if (method === 'POST') {
        posted.push({ path, body });
        return Promise.resolve(true);
      }
      if (path.endsWith('/status'))
        return Promise.resolve(overrides?.status ?? STATUS);
      if (path.endsWith('/specifications'))
        return Promise.resolve(overrides?.spec ?? SPEC);
      // device detail
      return Promise.resolve({
        id: 'dev1',
        name: 'Bath',
        online: overrides?.online ?? true,
        product_id: 'p1',
      });
    },
  );
  return { tuya: { request } as unknown as TuyaCloudService, posted, request };
}

function makeUsers(): UsersService {
  return {
    loadRoster: jest.fn(() =>
      Promise.resolve([
        {
          info: { uid: 'u1', username: 'imax', nick_name: 'iMax' },
          devices: [
            {
              id: 'dev1',
              name: 'Bath',
              online: true,
              product_id: 'p1',
              status: STATUS,
            },
          ],
        },
      ]),
    ),
    getUserDevices: jest.fn(() =>
      Promise.resolve([
        {
          id: 'dev1',
          name: 'Bath',
          online: true,
          product_id: 'p1',
          status: STATUS,
        },
      ]),
    ),
  } as unknown as UsersService;
}

describe('DevicesService.listAllDevices', () => {
  it('gộp thiết bị của mọi user + owner + temp decode (scale 1)', async () => {
    const { tuya } = makeTuya();
    const svc = new DevicesService(tuya, makeUsers());
    const list = await svc.listAllDevices();
    expect(list).toEqual([
      {
        id: 'dev1',
        name: 'Bath',
        online: true,
        productId: 'p1',
        ownerUid: 'u1',
        ownerName: 'iMax',
        currentTemp: 6.4,
        targetTemp: 4,
      },
    ]);
  });

  // LỖI KHÁCH BÁO: `/users/{uid}/devices` không kèm `status` cho con bồn (PIR thì có) ⇒ cột
  // Current/Target trống trơn ở màn list, dù trang chi tiết hiện đủ.
  it('thiết bị thiếu `status` inline → đọc bù, cột nhiệt độ có giá trị', async () => {
    const { tuya } = makeTuya();
    const users = {
      loadRoster: jest.fn(() =>
        Promise.resolve([
          {
            info: { uid: 'u1', nick_name: 'iMax' },
            devices: [{ id: 'dev1', name: 'Bath', online: true }], // KHÔNG có status
          },
        ]),
      ),
    } as unknown as UsersService;

    const list = await new DevicesService(tuya, users).listAllDevices();

    expect(list[0].currentTemp).toBeCloseTo(6.4);
    expect(list[0].targetTemp).toBeCloseTo(4);
  });

  // Đọc bù phải là ĐƯỜNG DỰ PHÒNG: có status kèm sẵn thì không được tốn thêm request nào.
  it('đã có `status` inline → KHÔNG gọi thêm Tuya', async () => {
    const { tuya, request } = makeTuya();

    await new DevicesService(tuya, makeUsers()).listAllDevices();

    expect(request).not.toHaveBeenCalled();
  });

  // `devices: null` = đọc thiết bị của user đó hỏng. Phải bỏ qua user, không được ném lỗi làm
  // trắng cả trang /devices của những user còn lại.
  it('user đọc thiết bị hỏng (devices null) → bỏ qua, không ném lỗi', async () => {
    const { tuya } = makeTuya();
    const users = {
      loadRoster: jest.fn(() =>
        Promise.resolve([
          { info: { uid: 'broken' }, devices: null },
          {
            info: { uid: 'u1', nick_name: 'iMax' },
            devices: [{ id: 'dev1', name: 'Bath', online: true, status: [] }],
          },
        ]),
      ),
    } as unknown as UsersService;

    const list = await new DevicesService(tuya, users).listAllDevices();

    expect(list.map((d) => d.id)).toEqual(['dev1']);
  });
});

describe('DevicesService.getDevice', () => {
  /**
   * Tuya giả theo đúng hành vi ĐO ĐƯỢC trên con bồn thật "Walrus amara" (model g0cv1c,
   * 2026-09-28): endpoint v1.0 từ chối, chỉ bộ v2.0 cloud/thing có dữ liệu.
   */
  function makeBathTuya() {
    const request = jest.fn((req: { path: string }) => {
      const { path } = req;
      if (path === '/v1.0/devices/dev1')
        return Promise.resolve({
          id: 'dev1',
          name: 'Walrus amara',
          online: true,
          product_id: 'p1',
        });
      if (path === '/v1.0/devices/dev1/status')
        return Promise.reject(new Error('code=2003 function not support'));
      if (path === '/v1.0/devices/dev1/specifications')
        return Promise.reject(new Error('code=2009 not support this device'));
      if (path === '/v2.0/cloud/thing/dev1/shadow/properties')
        return Promise.resolve({
          properties: [
            { code: 'sensor_1', dp_id: 101, type: 'value', value: 100 },
            { code: 'setting_temp', dp_id: 115, type: 'raw', value: TEMP_B64 },
            {
              code: 'setting_temp_range',
              dp_id: 114,
              type: 'raw',
              value: RANGE_B64,
            },
            { code: 'setting_pwr', dp_id: 121, type: 'bool', value: true },
            { code: 'setting_4', dp_id: 124, type: 'bool', value: true },
            { code: 'setting_clr', dp_id: 122, type: 'bool', value: false },
          ],
        });
      if (path === '/v2.0/cloud/thing/dev1/model')
        return Promise.resolve({
          model: JSON.stringify({
            modelId: 'g0cv1c',
            services: [
              {
                properties: [
                  {
                    abilityId: 101,
                    accessMode: 'ro',
                    code: 'sensor_1',
                    typeSpec: { type: 'value', scale: 1, unit: '℃' },
                  },
                  {
                    abilityId: 115,
                    accessMode: 'rw',
                    code: 'setting_temp',
                    typeSpec: { type: 'raw', maxlen: 128 },
                  },
                  {
                    abilityId: 114,
                    accessMode: 'rw',
                    code: 'setting_temp_range',
                    typeSpec: { type: 'raw', maxlen: 128 },
                  },
                  {
                    abilityId: 121,
                    accessMode: 'rw',
                    code: 'setting_pwr',
                    typeSpec: { type: 'bool' },
                  },
                  {
                    abilityId: 124,
                    accessMode: 'rw',
                    code: 'setting_4',
                    typeSpec: { type: 'bool' },
                  },
                  {
                    abilityId: 122,
                    accessMode: 'rw',
                    code: 'setting_clr',
                    typeSpec: { type: 'bool' },
                  },
                ],
              },
            ],
          }),
        });
      return Promise.reject(new Error(`path lạ: ${path}`));
    });
    return { request } as unknown as TuyaCloudService;
  }

  // ĐÂY LÀ LỖI KHÁCH BÁO: bồn ONLINE nhưng trang chi tiết không hiện gì, dù
  // `/v2.0/cloud/thing/{id}/shadow/properties` có đủ giá trị.
  it('v1.0 từ chối → đọc DP từ shadow properties + thing model', async () => {
    const svc = new DevicesService(makeBathTuya(), makeUsers());

    const d = await svc.getDevice('dev1');

    expect(d.name).toBe('Walrus amara');
    expect(d.online).toBe(true);
    expect(d.currentTemp).toBeCloseTo(10); // sensor_1 = 100, scale 1
    expect(d.targetTemp).toBeCloseTo(4); // setting_temp word0 = 40, scale 1
    expect(d.power).toBe(true);
    expect(d.light).toBe(true);
    expect(d.purify).toBe(false);
    expect(d.tempRange).toEqual({ min: 2, max: 15, step: 0.5, unit: '°C' });
  });

  // Quy đổi kiểu là chỗ dễ hỏng câm: thing model ghi `raw` chữ thường, còn device-dp so với
  // `'Raw'`. Sai là setpoint rơi vào nhánh số và đọc ra rác thay vì decode word0.
  it('quy đổi kiểu thing model chữ thường → chữ hoa (raw → Raw)', async () => {
    const svc = new DevicesService(makeBathTuya(), makeUsers());

    const d = await svc.getDevice('dev1');

    expect(d.targetTemp).not.toBeNull();
    expect(d.targetTemp).toBeCloseTo(4); // decode word0, KHÔNG phải parse base64 thành số
  });

  it('không đọc nổi detail → 404 chứ không trả vỏ rỗng', async () => {
    const tuya = {
      request: jest.fn(() =>
        Promise.reject(new Error('code=1106 permission deny')),
      ),
    } as unknown as TuyaCloudService;
    const svc = new DevicesService(tuya, makeUsers());

    await expect(svc.getDevice('gone')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('decode status theo spec + online từ detail', async () => {
    const { tuya } = makeTuya();
    const svc = new DevicesService(tuya, makeUsers());
    const d = await svc.getDevice('dev1');
    expect(d.online).toBe(true);
    expect(d.name).toBe('Bath');
    expect(d.currentTemp).toBeCloseTo(6.4);
    expect(d.targetTemp).toBeCloseTo(4.0);
    expect(d.tempRange).toEqual({ min: 2, max: 15, step: 0.5, unit: '°C' });
    expect(d.power).toBe(true);
  });
});

describe('DevicesService.sendCommand', () => {
  it('bool: gửi đúng code lên /commands', async () => {
    const { tuya, posted } = makeTuya();
    const svc = new DevicesService(tuya, makeUsers());
    const res = await svc.sendCommand('dev1', { power: false });
    expect(res.ok).toBe(true);
    expect(posted).toEqual([
      {
        path: '/v1.0/devices/dev1/commands',
        body: { commands: [{ code: 'setting_pwr', value: false }] },
      },
    ]);
  });

  it('target Raw: đọc raw hiện tại từ status → ghi word0 → base64', async () => {
    const { posted, tuya } = makeTuya();
    const svc = new DevicesService(tuya, makeUsers());
    await svc.sendCommand('dev1', { target: 7.5 });
    expect(posted[0].body).toEqual({
      commands: [{ code: 'setting_temp', value: TEMP75_B64 }],
    });
  });

  it('offline → 409 ConflictException, KHÔNG post', async () => {
    const { tuya, posted } = makeTuya({ online: false });
    const svc = new DevicesService(tuya, makeUsers());
    await expect(
      svc.sendCommand('dev1', { power: true }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(posted).toHaveLength(0);
  });

  it('thiếu DP (spec không có power) → 400 BadRequest', async () => {
    const { tuya } = makeTuya({
      spec: { status: [{ code: 'sensor_1', type: 'Integer' }] },
    });
    const svc = new DevicesService(tuya, makeUsers());
    await expect(
      svc.sendCommand('dev1', { power: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('không có field nào → 400', async () => {
    const { tuya } = makeTuya();
    const svc = new DevicesService(tuya, makeUsers());
    await expect(svc.sendCommand('dev1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
