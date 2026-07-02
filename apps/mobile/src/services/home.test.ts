export {}; // đánh dấu module scope (tránh trùng tên global với test khác)
// Test services/home: nạp lại module với lib native giả/vắng theo từng case (module require native lúc load).

function load(nativeTuya: any | null) {
  jest.resetModules();
  jest.doMock('@jimmy-vu/react-native-turbo-tuya', () =>
    nativeTuya ? { Tuya: nativeTuya } : (() => { throw new Error('no native'); })(),
  );
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  return require('./home');
}

describe('services/home — mock (native vắng)', () => {
  it('homeAvailable=false và getHomeList RỖNG lúc đầu (để hiện màn Create Home)', async () => {
    const home = load(null);
    expect(home.homeAvailable).toBe(false);
    expect(await home.getHomeList()).toEqual([]);
  });

  it('createHome push vào list → getHomeList sau đó có home vừa tạo (owner)', async () => {
    const home = load(null);
    const created = await home.createHome('Nhà của tôi');
    expect(created).toMatchObject({ name: 'Nhà của tôi', role: 2, admin: true });
    expect(typeof created.homeId).toBe('number');
    const list = await home.getHomeList();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Nhà của tôi');
  });

  it('getHomeDeviceList mock trả 1 thiết bị demo (detail dùng được trong dev)', async () => {
    const home = load(null);
    const devices = await home.getHomeDeviceList(1);
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ devId: 'mock-dev-001', isOnline: true });
  });
});

describe('services/home — native có mặt', () => {
  it('getHomeList map từ lib.Tuya.getHomeList', async () => {
    const getHomeList = jest.fn().mockResolvedValue([
      { homeId: 10, name: 'H', role: 2, admin: true, lon: 0, lat: 0, geoName: '' },
    ]);
    const home = load({ getHomeList });
    const list = await home.getHomeList();
    expect(getHomeList).toHaveBeenCalled();
    expect(list).toEqual([{ homeId: 10, name: 'H', role: 2, admin: true }]);
  });

  it('createHome gọi lib với đúng tham số + map kết quả', async () => {
    const createHome = jest.fn().mockResolvedValue({ homeId: 7, name: 'N', role: 2, admin: true });
    const home = load({ createHome });
    const res = await home.createHome('N');
    expect(createHome).toHaveBeenCalledWith('N', 0, 0, '', []);
    expect(res).toEqual({ homeId: 7, name: 'N', role: 2, admin: true });
  });

  it('getHomeDeviceList gọi lib.Tuya.getHomeDeviceList(homeId)', async () => {
    const getHomeDeviceList = jest.fn().mockResolvedValue([
      { devId: 'd1', name: 'Dev', productId: 'p', isOnline: false, iconUrl: '' },
    ]);
    const home = load({ getHomeDeviceList });
    const res = await home.getHomeDeviceList(99);
    expect(getHomeDeviceList).toHaveBeenCalledWith(99);
    expect(res).toEqual([{ devId: 'd1', name: 'Dev', productId: 'p', isOnline: false, iconUrl: '' }]);
  });
});
