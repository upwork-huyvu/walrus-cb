export {};

function load(removeDevice?: jest.Mock, getHomeDeviceList = jest.fn().mockResolvedValue([])) {
  jest.resetModules();
  jest.doMock('@jimmy-vu/react-native-turbo-tuya', () => ({
    Tuya: { removeDevice },
  }));
  jest.doMock('./home', () => ({
    getHomeDeviceList,
    removeMockDevice: jest.fn(),
  }));
  jest.doMock('../config/mock', () => ({
    MOCK_DEVICES: false,
    MOCK_DEVICE_LIST: [],
    isMockDevId: () => false,
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  return require('./tuya');
}

describe('removeDevice adapter', () => {
  it('gọi native Tuya remove và chỉ resolve sau callback success', async () => {
    const nativeRemove = jest.fn().mockResolvedValue(undefined);
    const tuya = load(nativeRemove);
    await expect(tuya.removeDevice('dev-1')).resolves.toBeUndefined();
    expect(nativeRemove).toHaveBeenCalledWith('dev-1');
  });

  it('giữ lỗi native để UI không dọn local khi Tuya chưa xoá', async () => {
    const nativeRemove = jest.fn().mockRejectedValue(new Error('cloud unavailable'));
    const tuya = load(nativeRemove);
    await expect(tuya.removeDevice('dev-1')).rejects.toThrow('cloud unavailable');
  });

  it('từ chối devId rỗng', async () => {
    const tuya = load(jest.fn());
    await expect(tuya.removeDevice('')).rejects.toThrow('Missing device ID');
  });

  it('coi là idempotent success khi remove lỗi nhưng Home xác nhận device đã vắng', async () => {
    const removeError = new Error('already removed');
    const getHomeDeviceList = jest.fn().mockResolvedValue([{ devId: 'other-device' }]);
    const tuya = load(jest.fn().mockRejectedValue(removeError), getHomeDeviceList);

    await expect(tuya.removeDeviceOrConfirmAbsent('dev-1', 9)).resolves.toBeUndefined();
    expect(getHomeDeviceList).toHaveBeenCalledWith(9);
  });

  it('giữ lỗi remove nếu refetch vẫn thấy device', async () => {
    const removeError = new Error('permission denied');
    const getHomeDeviceList = jest.fn().mockResolvedValue([{ devId: 'dev-1' }]);
    const tuya = load(jest.fn().mockRejectedValue(removeError), getHomeDeviceList);

    await expect(tuya.removeDeviceOrConfirmAbsent('dev-1', 9)).rejects.toBe(removeError);
  });

  it('giữ lỗi remove gốc nếu refetch Home cũng lỗi', async () => {
    const removeError = new Error('remove failed');
    const getHomeDeviceList = jest.fn().mockRejectedValue(new Error('refresh failed'));
    const tuya = load(jest.fn().mockRejectedValue(removeError), getHomeDeviceList);

    await expect(tuya.removeDeviceOrConfirmAbsent('dev-1', 9)).rejects.toBe(removeError);
  });
});
