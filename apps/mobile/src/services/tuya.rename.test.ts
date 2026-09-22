export {};

// Nạp lại adapter với native giả theo từng case (module require native lúc load, như tuya.remove.test.ts).
// `nativeTuya = null` → native VẮNG (Metro-only) ⇒ mọi thao tác rơi sang mock.
function load(nativeTuya: Record<string, unknown> | null, isMock = false) {
  const renameMockDevice = jest.fn();
  jest.resetModules();
  jest.doMock('@jimmy-vu/react-native-turbo-tuya', () =>
    nativeTuya ? { Tuya: nativeTuya } : (() => { throw new Error('no native'); })(),
  );
  jest.doMock('./home', () => ({
    getHomeDeviceList: jest.fn().mockResolvedValue([]),
    removeMockDevice: jest.fn(),
    renameMockDevice,
  }));
  jest.doMock('../config/mock', () => ({
    MOCK_DEVICES: isMock,
    MOCK_DEVICE_LIST: [],
    isMockDevId: () => isMock,
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  return { tuya: require('./tuya'), renameMockDevice };
}

describe('renameDevice adapter', () => {
  it('gọi native Tuya rename và chỉ resolve sau callback success', async () => {
    const nativeRename = jest.fn().mockResolvedValue(undefined);
    const { tuya } = load({ renameDevice: nativeRename });
    await expect(tuya.renameDevice('dev-1', 'Bồn nhà tắm')).resolves.toBe('Bồn nhà tắm');
    expect(nativeRename).toHaveBeenCalledWith('dev-1', 'Bồn nhà tắm');
  });

  it('chuẩn hoá tên trước khi gửi lên Tuya (trim + gộp khoảng trắng)', async () => {
    const nativeRename = jest.fn().mockResolvedValue(undefined);
    const { tuya } = load({ renameDevice: nativeRename });
    await expect(tuya.renameDevice('dev-1', '  Walrus   Pro 2 ')).resolves.toBe('Walrus Pro 2');
    expect(nativeRename).toHaveBeenCalledWith('dev-1', 'Walrus Pro 2');
  });

  it('từ chối devId rỗng', async () => {
    const { tuya } = load({ renameDevice: jest.fn() });
    await expect(tuya.renameDevice('', 'Walrus')).rejects.toThrow('Missing device ID');
  });

  it('từ chối tên rỗng / chỉ khoảng trắng - không gọi native', async () => {
    const nativeRename = jest.fn();
    const { tuya } = load({ renameDevice: nativeRename });
    await expect(tuya.renameDevice('dev-1', '   ')).rejects.toThrow('cannot be empty');
    expect(nativeRename).not.toHaveBeenCalled();
  });

  it('từ chối tên quá dài - chặn sớm thay vì để Tuya trả lỗi khó hiểu', async () => {
    const nativeRename = jest.fn();
    const { tuya } = load({ renameDevice: nativeRename });
    const tooLong = 'a'.repeat(tuya.DEVICE_NAME_MAX_LENGTH + 1);
    await expect(tuya.renameDevice('dev-1', tooLong)).rejects.toThrow('characters or fewer');
    expect(nativeRename).not.toHaveBeenCalled();
  });

  it('giữ lỗi native để UI KHÔNG hiện tên mới khi Tuya chưa lưu', async () => {
    const { tuya } = load({ renameDevice: jest.fn().mockRejectedValue(new Error('cloud unavailable')) });
    await expect(tuya.renameDevice('dev-1', 'Walrus')).rejects.toThrow('cloud unavailable');
  });

  it('build native cũ (thiếu bridge rename) → báo lỗi rõ, không crash "not a function"', async () => {
    const { tuya } = load({});
    await expect(tuya.renameDevice('dev-1', 'Walrus')).rejects.toThrow('does not support renaming');
  });

  it('bồn giả / native vắng → đổi tên trong mock, không gọi SDK', async () => {
    const nativeRename = jest.fn();
    const { tuya, renameMockDevice } = load({ renameDevice: nativeRename }, true);
    await expect(tuya.renameDevice('mock-walrus-pro-2', 'Bồn giả')).resolves.toBe('Bồn giả');
    expect(renameMockDevice).toHaveBeenCalledWith('mock-walrus-pro-2', 'Bồn giả');
    expect(nativeRename).not.toHaveBeenCalled();
  });
});

describe('normalizeDeviceName', () => {
  it('gộp khoảng trắng + cắt 2 đầu; chuỗi rỗng/khoảng trắng → ""', () => {
    const { tuya } = load({ renameDevice: jest.fn() });
    expect(tuya.normalizeDeviceName('  Walrus   Pro  2 ')).toBe('Walrus Pro 2');
    expect(tuya.normalizeDeviceName('\n\t  ')).toBe('');
    expect(tuya.normalizeDeviceName('')).toBe('');
  });
});
