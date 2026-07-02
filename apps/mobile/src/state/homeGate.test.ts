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
});
