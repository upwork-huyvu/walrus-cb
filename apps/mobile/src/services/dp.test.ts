import {
  parseDeviceDps,
  buildTempDps,
  buildLightDps,
  buildPurifyDps,
  buildFreezeDps,
  DP,
} from './dp';

describe('dp', () => {
  it('parse dpsJson → device fields', () => {
    const json = JSON.stringify({
      [DP.targetTemp]: 6,
      [DP.currentTemp]: 12,
      [DP.light]: true,
      [DP.purify]: false,
      [DP.freeze]: true,
    });
    expect(parseDeviceDps(json)).toEqual({
      currentTemp: 12,
      targetTemp: 6,
      lightOn: true,
      purifyOn: false,
      freezeOn: true,
    });
  });

  it('parse: chuỗi số → number; thiếu/bad json → null', () => {
    expect(parseDeviceDps(JSON.stringify({ [DP.currentTemp]: '8' })).currentTemp).toBe(8);
    expect(parseDeviceDps('not-json')).toEqual({
      currentTemp: null,
      targetTemp: null,
      lightOn: null,
      purifyOn: null,
      freezeOn: null,
    });
  });

  it('build dps để publish', () => {
    expect(buildTempDps(6)).toBe(JSON.stringify({ [DP.targetTemp]: 6 }));
    expect(buildLightDps(true)).toBe(JSON.stringify({ [DP.light]: true }));
    expect(buildPurifyDps(true)).toBe(JSON.stringify({ [DP.purify]: true }));
    expect(buildFreezeDps(false)).toBe(JSON.stringify({ [DP.freeze]: false }));
  });
});
