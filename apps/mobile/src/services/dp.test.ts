import { parseDeviceDps, buildTempDps, buildLightDps, DP } from './dp';

describe('dp', () => {
  it('parse dpsJson → device fields', () => {
    const json = JSON.stringify({
      [DP.targetTemp]: 6,
      [DP.currentTemp]: 12,
      [DP.light]: true,
    });
    expect(parseDeviceDps(json)).toEqual({
      currentTemp: 12,
      targetTemp: 6,
      lightOn: true,
    });
  });

  it('parse: chuỗi số → number; thiếu/bad json → null', () => {
    expect(parseDeviceDps(JSON.stringify({ [DP.currentTemp]: '8' })).currentTemp).toBe(8);
    expect(parseDeviceDps('not-json')).toEqual({
      currentTemp: null,
      targetTemp: null,
      lightOn: null,
    });
  });

  it('build dps để publish', () => {
    expect(buildTempDps(6)).toBe(JSON.stringify({ [DP.targetTemp]: 6 }));
    expect(buildLightDps(true)).toBe(JSON.stringify({ [DP.light]: true }));
  });
});
