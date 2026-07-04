import { AppConfigService } from '../config/app-config.service';
import { TuyaAppInfoService } from './app-info.service';
import { TuyaCloudService } from './tuya-cloud.service';

describe('TuyaAppInfoService (biz_type runtime lookup)', () => {
  const tuyaRequest = jest.fn();
  const configGet = jest.fn();
  const configRequire = jest.fn();

  const tuya = { request: tuyaRequest } as unknown as TuyaCloudService;
  const config = {
    get: configGet,
    require: configRequire,
  } as unknown as AppConfigService;

  let service: TuyaAppInfoService;

  beforeEach(() => {
    jest.clearAllMocks();
    configGet.mockReturnValue(undefined); // không có env override
    configRequire.mockReturnValue('walruswellnesscb'); // TUYA_APP_SCHEMA
    service = new TuyaAppInfoService(tuya, config);
  });

  it('env TUYA_APP_BIZ_TYPE có set → dùng luôn, KHÔNG gọi API', async () => {
    configGet.mockReturnValue(99);
    await expect(service.getBizType()).resolves.toBe(99);
    expect(tuyaRequest).not.toHaveBeenCalled();
  });

  it('parse snake_case app_biz_type (bảng field trong doc)', async () => {
    tuyaRequest.mockResolvedValue({ app_biz_type: 10 });
    await expect(service.getBizType()).resolves.toBe(10);
    expect(tuyaRequest).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1.0/apps/walruswellnesscb',
    });
  });

  it('parse camelCase appBizType (example trong doc lệch casing)', async () => {
    tuyaRequest.mockResolvedValue({ appBizType: 987654321 });
    await expect(service.getBizType()).resolves.toBe(987654321);
  });

  it('cache: gọi 2 lần → chỉ 1 request Tuya', async () => {
    tuyaRequest.mockResolvedValue({ app_biz_type: 10 });
    await service.getBizType();
    await service.getBizType();
    expect(tuyaRequest).toHaveBeenCalledTimes(1);
  });

  it('response thiếu cả 2 field → throw lỗi rõ ràng (nhắc authorize API product)', async () => {
    tuyaRequest.mockResolvedValue({ app_name: 'Walrus' });
    await expect(service.getBizType()).rejects.toThrow(/app_biz_type/);
  });

  it('lỗi API → KHÔNG cache lỗi (lần sau thử lại)', async () => {
    tuyaRequest
      .mockRejectedValueOnce(new Error('permission deny'))
      .mockResolvedValueOnce({ app_biz_type: 10 });
    await expect(service.getBizType()).rejects.toThrow('permission deny');
    await expect(service.getBizType()).resolves.toBe(10);
    expect(tuyaRequest).toHaveBeenCalledTimes(2);
  });
});
