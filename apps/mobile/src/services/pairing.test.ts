export {}; // module scope

function load(nativeTuya: any | null) {
  jest.resetModules();
  jest.doMock('@jimmy-vu/react-native-turbo-tuya', () =>
    nativeTuya ? { Tuya: nativeTuya } : (() => { throw new Error('no native'); })(),
  );
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  return require('./pairing');
}

describe('pairingStepLabel — nhãn confirm kiểu SmartLife', () => {
  const p = load(null);
  it.each([
    ['device_find', 'Đang tìm thiết bị…'],
    ['ble_connect', 'Đang kết nối thiết bị…'],
    ['device_bind_success', 'Kết nối thành công'],
    ['initializing', 'Đang khởi tạo…'],
    ['something_unknown', 'Đang ghép nối…'],
  ])('%s → %s', (step, label) => {
    expect(p.pairingStepLabel(step)).toBe(label);
  });
});

describe('renameDevice', () => {
  it('native vắng → no-op (không throw)', async () => {
    const p = load(null);
    await expect(p.renameDevice('d1', 'Tên')).resolves.toBeUndefined();
  });

  it('native có → gọi lib.Tuya.renameDevice(devId, name)', async () => {
    const renameDevice = jest.fn().mockResolvedValue(undefined);
    const p = load({ renameDevice });
    await p.renameDevice('d1', 'Bồn của tôi');
    expect(renameDevice).toHaveBeenCalledWith('d1', 'Bồn của tôi');
  });
});
