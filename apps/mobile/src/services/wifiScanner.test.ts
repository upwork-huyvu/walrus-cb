import { bandOfFrequency } from './wifiScanner';

describe('bandOfFrequency - Wi-Fi EZ của Tuya chỉ chạy 2.4GHz', () => {
  it.each([
    [2412, '2.4GHz'], // channel 1
    [2437, '2.4GHz'], // channel 6
    [2472, '2.4GHz'], // channel 13
    [5180, '5GHz'], // channel 36
    [5500, '5GHz'],
    [5825, '5GHz'], // channel 165
    [5955, '6GHz'], // Wi-Fi 6E
    [7115, '6GHz'],
  ])('%i MHz → %s', (mhz, band) => {
    expect(bandOfFrequency(mhz)).toBe(band);
  });

  it.each([0, -1, 100, 3000, 5910, 9000])('%i MHz → unknown (không đoán bừa)', (mhz) => {
    expect(bandOfFrequency(mhz)).toBe('unknown');
  });
});
