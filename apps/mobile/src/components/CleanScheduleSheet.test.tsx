// Sheet kéo theo `services/cleanCycle` (hằng số độ dài chu trình) → kéo theo AsyncStorage, mà native
// storage không có trong jest ⇒ stub như `cleanCycle.test.ts`.
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve(),
}));

import { snapIndex } from './CleanScheduleSheet';

// Bánh xe chọn giờ: offset cuộn → ô đang nằm giữa. Kẹp biên là phần dễ sai nhất (cuộn quá đà ở iOS
// cho offset ÂM hoặc lớn hơn nội dung) - lọt ra ngoài mảng thì `values[i]` là undefined ⇒ giờ NaN.
describe('snapIndex', () => {
  it('làm tròn về ô gần nhất', () => {
    expect(snapIndex(0, 46, 24)).toBe(0);
    expect(snapIndex(46, 46, 24)).toBe(1);
    expect(snapIndex(68, 46, 24)).toBe(1); // 1.48 → 1
    expect(snapIndex(70, 46, 24)).toBe(2); // 1.52 → 2
  });

  it('kẹp trong [0, count-1] khi cuộn quá đà', () => {
    expect(snapIndex(-120, 46, 24)).toBe(0);
    expect(snapIndex(99999, 46, 24)).toBe(23);
  });

  it('không chia cho 0 / mảng rỗng', () => {
    expect(snapIndex(100, 0, 24)).toBe(0);
    expect(snapIndex(100, 46, 0)).toBe(0);
  });
});
