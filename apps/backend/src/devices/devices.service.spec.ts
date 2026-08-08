import { BadRequestException, ConflictException } from '@nestjs/common';
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
    listUsers: jest.fn(() =>
      Promise.resolve({
        list: [{ uid: 'u1', username: 'imax', nick_name: 'iMax' }],
        total: 1,
        has_more: false,
        page_no: 1,
        page_size: 100,
      }),
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
});

describe('DevicesService.getDevice', () => {
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
