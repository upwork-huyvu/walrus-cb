import { decideAfterAuth } from './homeGate';

describe('decideAfterAuth (home-gate)', () => {
  it('chưa có nhà → màn create-home', () => {
    expect(decideAfterAuth([])).toEqual({ screen: 'create-home' });
  });

  it('có nhà → device-list + homeId của nhà đầu tiên', () => {
    expect(
      decideAfterAuth([
        { homeId: 42, name: 'Nhà', role: 2, admin: true },
        { homeId: 7, name: 'Nhà 2', role: 2, admin: true },
      ]),
    ).toEqual({ screen: 'device-list', homeId: 42 });
  });

  it('ưu tiên nhà OWNER khi nhà đầu là nhà chia sẻ (member)', () => {
    expect(
      decideAfterAuth([
        { homeId: 7, name: 'Nhà chia sẻ', role: 0, admin: false },
        { homeId: 99, name: 'Nhà của tôi', role: 2, admin: true },
      ]),
    ).toEqual({ screen: 'device-list', homeId: 99 });
  });

  it('không có nhà owner → fallback nhà đầu tiên', () => {
    expect(
      decideAfterAuth([{ homeId: 7, name: 'Nhà chia sẻ', role: 0, admin: false }]),
    ).toEqual({ screen: 'device-list', homeId: 7 });
  });
});
