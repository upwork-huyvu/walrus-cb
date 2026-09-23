export {};

let mockMem: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (k: string) => Promise.resolve(mockMem[k] ?? null),
  setItem: (k: string, v: string) => {
    mockMem[k] = v;
    return Promise.resolve();
  },
  removeItem: (k: string) => {
    delete mockMem[k];
    return Promise.resolve();
  },
}));

type Opts = { purify?: boolean; setPurifyResult?: { ok: boolean; error?: string }; mockDev?: boolean };

/**
 * Nạp lại service với native giả. `makeNative = null` ⇒ chưa build native (nhánh mock).
 * Mọi lệnh (timer + setPurify) ghi vào CÙNG mảng `calls` để khẳng định được THỨ TỰ gọi.
 */
function load(makeNative: ((calls: string[]) => Record<string, any>) | null, opts: Opts = {}) {
  jest.resetModules();
  mockMem = {};
  const calls: string[] = [];
  const native = makeNative ? makeNative(calls) : null;
  const setPurify = jest.fn(async (_id: string, on: boolean) => {
    calls.push(`setPurify:${on}`);
    return opts.setPurifyResult ?? { ok: true };
  });

  jest.doMock('@jimmy-vu/react-native-turbo-tuya', () =>
    native ? { Tuya: native } : (() => { throw new Error('no native'); })(),
  );
  jest.doMock('./tuya', () => ({ setPurify }));
  jest.doMock('./dp', () => ({ getDpMap: () => (opts.purify === false ? {} : { purify: '122' }) }));
  jest.doMock('../config/mock', () => ({
    MOCK_DEVICES: false,
    MOCK_DEVICE_LIST: [],
    isMockDevId: () => !!opts.mockDev,
  }));
  const clean = require('./cleanCycle');
  return { clean, setPurify, calls, native: native as any };
}

/** Native giả đủ dùng: addTimer/removeTimer/getTimerList ghi lại thứ tự gọi. */
function nativeTimer(calls: string[], over: Record<string, any> = {}) {
  return {
    addTimer: jest.fn(async () => { calls.push('addTimer'); }),
    removeTimer: jest.fn(async () => { calls.push('removeTimer'); }),
    getTimerList: jest.fn(async () => []),
    ...over,
  };
}

const inputsOf = (addTimer: jest.Mock): any[] => addTimer.mock.calls.map((c) => JSON.parse(c[0] as string));

describe('cleanCycle - phần thuần', () => {
  const { clean } = load(null);

  it('cycleEndAt làm tròn LÊN phút (timer Tuya chỉ nhận HH:mm)', () => {
    const end = clean.cycleEndAt(new Date(2026, 8, 23, 10, 0, 30), 30);
    expect(clean.clockTime(end)).toBe('10:31');
    expect(end.getSeconds()).toBe(0);
    const exact = clean.cycleEndAt(new Date(2026, 8, 23, 10, 0, 0), 15);
    expect(clean.clockTime(exact)).toBe('10:15');
  });

  it('addMinutesToClock: qua nửa đêm thì báo wrapped', () => {
    expect(clean.addMinutesToClock('07:00', 30)).toEqual({ time: '07:30', wrapped: false });
    expect(clean.addMinutesToClock('23:50', 30)).toEqual({ time: '00:20', wrapped: true });
    expect(clean.addMinutesToClock('bậy', 30)).toBeNull();
  });

  it('minutesBetweenClocks tính được cả khi qua nửa đêm', () => {
    expect(clean.minutesBetweenClocks('07:00', '07:30')).toBe(30);
    expect(clean.minutesBetweenClocks('23:50', '00:20')).toBe(30);
  });

  it('loops: ký tự đầu là Chủ Nhật, đảo ngược được, dịch ngày đúng', () => {
    expect(clean.loopsFrom([0])).toBe('1000000');
    expect(clean.loopsFrom([1, 3])).toBe('0101000');
    expect(clean.loopsFrom([0, 1, 2, 3, 4, 5, 6])).toBe('1111111');
    expect(clean.daysFromLoops('0101000')).toEqual([1, 3]);
    expect(clean.shiftLoops('0000001')).toBe('1000000'); // T7 → CN
  });

  it('nextScheduleRun: đúng ngày trong lịch, bỏ qua mốc đã qua', () => {
    const now = new Date(2026, 8, 23, 8, 0, 0); // 23/09/2026 là thứ Tư (getDay = 3)
    const wed = clean.nextScheduleRun({ days: [3], time: '07:00', minutes: 30 }, now);
    expect(new Date(wed).getDate()).toBe(30); // 07:00 hôm nay đã qua → tuần sau
    const later = clean.nextScheduleRun({ days: [3], time: '09:00', minutes: 30 }, now);
    expect(new Date(later).getDate()).toBe(23);
    expect(clean.nextScheduleRun({ days: [], time: '09:00', minutes: 30 }, now)).toBeNull();
    expect(clean.nextScheduleRun(null, now)).toBeNull();
  });

  it('nextOccurrence: qua giờ rồi thì sang ngày mai', () => {
    const now = new Date(2026, 8, 23, 8, 0, 0);
    expect(new Date(clean.nextOccurrence('09:00', now)).getDate()).toBe(23);
    expect(new Date(clean.nextOccurrence('07:00', now)).getDate()).toBe(24);
  });
});

describe('startCleanCycle - hẹn tắt TRƯỚC, bật SAU', () => {
  it('gọi addTimer rồi mới setPurify(true), payload tắt DP 122 một lần', async () => {
    const { clean, calls, native, setPurify } = load((c) => nativeTimer(c));
    const end = await clean.startCleanCycle('dev-1', 30, new Date(2026, 8, 23, 10, 0, 0));

    expect(calls).toEqual(['removeTimer', 'addTimer', 'setPurify:true']);
    expect(inputsOf(native.addTimer)[0]).toMatchObject({
      taskName: 'walrus_clean_once',
      bizId: 'dev-1',
      bizType: 'device',
      time: '10:30',
      loops: '0000000',
      dpsJson: JSON.stringify({ '122': false }),
      status: true,
    });
    expect(new Date(end).getHours()).toBe(10);
    expect(setPurify).toHaveBeenCalledWith('dev-1', true);
  });

  it('hẹn tắt LỖI → KHÔNG bật máy (không để ozone chạy vô hạn)', async () => {
    const { clean, setPurify } = load((c) =>
      nativeTimer(c, {
        addTimer: jest.fn(async () => { c.push('addTimer'); throw new Error('cloud unavailable'); }),
      }),
    );
    await expect(clean.startCleanCycle('dev-1', 30)).rejects.toThrow('cloud unavailable');
    expect(setPurify).not.toHaveBeenCalled();
  });

  it('bật LỖI → xoá luôn hẹn tắt vừa đặt (không để timer mồ côi)', async () => {
    const { clean, native } = load((c) => nativeTimer(c), {
      setPurifyResult: { ok: false, error: 'device offline' },
    });
    await expect(clean.startCleanCycle('dev-1', 30)).rejects.toThrow('device offline');
    expect(native.removeTimer).toHaveBeenCalledTimes(2); // 1 lần dọn trước + 1 lần dọn sau khi bật hỏng
  });

  it('thiết bị không có DP khử trùng → từ chối, không đụng timer', async () => {
    const { clean, native, setPurify } = load((c) => nativeTimer(c), { purify: false });
    await expect(clean.startCleanCycle('dev-1', 30)).rejects.toThrow('no cleaning control');
    expect(native.addTimer).not.toHaveBeenCalled();
    expect(setPurify).not.toHaveBeenCalled();
  });

  it('native vắng (dev/bồn giả) → chỉ bật, vẫn trả mốc kết thúc để UI chạy', async () => {
    const { clean, setPurify } = load(null);
    const end = await clean.startCleanCycle('dev-1', 15, new Date(2026, 8, 23, 10, 0, 0));
    expect(setPurify).toHaveBeenCalledWith('dev-1', true);
    expect(new Date(end).getMinutes()).toBe(15);
  });
});

describe('stopCleanCycle / readCleanCycleEnd / reconcileCleanCycle', () => {
  it('stop: TẮT trước rồi mới xoá hẹn, và quên mốc kết thúc', async () => {
    const { clean, calls } = load((c) => nativeTimer(c));
    const now = new Date(2026, 8, 23, 10, 0, 0);
    await clean.startCleanCycle('dev-1', 30, now);
    calls.length = 0;
    await clean.stopCleanCycle('dev-1');
    expect(calls).toEqual(['setPurify:false', 'removeTimer']);
    expect(await clean.readCleanCycleEnd('dev-1', now)).toBeNull();
  });

  it('readCleanCycleEnd: hết hạn local thì hỏi cloud', async () => {
    const { clean } = load((c) =>
      nativeTimer(c, {
        getTimerList: jest.fn(async () => [
          { timerId: '1', time: '10:30', loops: '0000000', status: true, dpsJson: '{"122":false}' },
        ]),
      }),
    );
    const at = await clean.readCleanCycleEnd('dev-1', new Date(2026, 8, 23, 10, 0, 0));
    expect(clean.clockTime(new Date(at))).toBe('10:30');
  });

  it('reconcile: quá hạn mà máy còn bật → gửi tắt bù', async () => {
    const { clean, setPurify } = load((c) => nativeTimer(c));
    await clean.startCleanCycle('dev-1', 30, new Date(2026, 8, 23, 10, 0, 0));
    setPurify.mockClear();
    await expect(clean.reconcileCleanCycle('dev-1', true, new Date(2026, 8, 23, 11, 0, 0))).resolves.toBe(true);
    expect(setPurify).toHaveBeenCalledWith('dev-1', false);
  });

  it('reconcile: chưa tới hạn, hoặc người dùng tự bật nút lá → KHÔNG đụng vào', async () => {
    const { clean, setPurify } = load((c) => nativeTimer(c));
    await clean.startCleanCycle('dev-1', 30, new Date(2026, 8, 23, 10, 0, 0));
    setPurify.mockClear();
    await expect(clean.reconcileCleanCycle('dev-1', true, new Date(2026, 8, 23, 10, 10, 0))).resolves.toBe(false);
    expect(setPurify).not.toHaveBeenCalled();

    // Không có mốc nào được lưu = người dùng tự bật nút lá ⇒ tuyệt đối không tắt hộ.
    const manual = load((c) => nativeTimer(c));
    await expect(
      manual.clean.reconcileCleanCycle('dev-2', true, new Date(2026, 8, 23, 10, 0, 0)),
    ).resolves.toBe(false);
    expect(manual.setPurify).not.toHaveBeenCalled();
  });
});

describe('lịch vệ sinh', () => {
  it('đặt lịch = xoá task cũ + 2 timer lặp (bật, tắt) đúng loops', async () => {
    const { clean, calls, native } = load((c) => nativeTimer(c));
    await clean.setCleanSchedule('dev-1', { days: [1], time: '07:00', minutes: 30 });

    expect(calls).toEqual(['removeTimer', 'addTimer', 'addTimer']);
    const [on, off] = inputsOf(native.addTimer);
    expect(on).toMatchObject({ taskName: 'walrus_clean_sched', time: '07:00', loops: '0100000', dpsJson: JSON.stringify({ '122': true }) });
    expect(off).toMatchObject({ time: '07:30', loops: '0100000', dpsJson: JSON.stringify({ '122': false }) });
  });

  it('lịch qua nửa đêm: timer tắt phải dịch sang ngày hôm sau', async () => {
    const { clean, native } = load((c) => nativeTimer(c));
    await clean.setCleanSchedule('dev-1', { days: [6], time: '23:50', minutes: 30 }); // T7 23:50
    const [, off] = inputsOf(native.addTimer);
    expect(off).toMatchObject({ time: '00:20', loops: '1000000' }); // tắt vào CN
  });

  it('tạo timer tắt lỗi → dọn sạch task, không để lịch chỉ-bật-không-tắt', async () => {
    let n = 0;
    const { clean, calls } = load((c) =>
      nativeTimer(c, {
        addTimer: jest.fn(async () => {
          c.push('addTimer');
          if (++n === 2) throw new Error('cloud unavailable');
        }),
      }),
    );
    await expect(
      clean.setCleanSchedule('dev-1', { days: [1], time: '07:00', minutes: 30 }),
    ).rejects.toThrow('cloud unavailable');
    expect(calls).toEqual(['removeTimer', 'addTimer', 'addTimer', 'removeTimer']);
  });

  it('xoá lịch = xoá task, không tạo timer nào', async () => {
    const { clean, native } = load((c) => nativeTimer(c));
    await clean.setCleanSchedule('dev-1', null);
    expect(native.removeTimer).toHaveBeenCalled();
    expect(native.addTimer).not.toHaveBeenCalled();
  });

  it('đọc lịch chịu được dps kiểu chuỗi/số (iOS và Android trả khác nhau)', async () => {
    const { clean } = load((c) =>
      nativeTimer(c, {
        getTimerList: jest.fn(async () => [
          { timerId: '1', time: '07:00', loops: '0100000', status: true, dpsJson: '{"122":"true"}' },
          { timerId: '2', time: '07:30', loops: '0100000', status: true, dpsJson: '{"122":0}' },
        ]),
      }),
    );
    await expect(clean.readCleanSchedule('dev-1')).resolves.toEqual({ days: [1], time: '07:00', minutes: 30 });
    expect(clean.dpBoolOf('{"122":"FALSE"}', '122')).toBe(false);
    expect(clean.dpBoolOf('{"122":1}')).toBe(true);
    expect(clean.dpBoolOf('hỏng', '122')).toBeNull();
  });

  it('đọc lại lịch từ cặp timer trên cloud', async () => {
    const { clean } = load((c) =>
      nativeTimer(c, {
        getTimerList: jest.fn(async () => [
          { timerId: '1', time: '07:00', loops: '0100000', status: true, dpsJson: '{"122":true}' },
          { timerId: '2', time: '07:30', loops: '0100000', status: true, dpsJson: '{"122":false}' },
        ]),
      }),
    );
    await expect(clean.readCleanSchedule('dev-1')).resolves.toEqual({ days: [1], time: '07:00', minutes: 30 });
  });
});
