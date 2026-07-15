import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  Share,
  Text,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  Easing,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate } from '../navigation';
import type { AppState } from '../state/useAppState';
import PrimaryButton from '../components/PrimaryButton';
import GhostButton from '../components/GhostButton';
import RadarView from '../components/RadarView';
import { ensureBlePermissions } from '../services/blePermissions';
import {
  blipFromBleScan,
  blipFromEzStep,
  isPairableBlip,
  upsertBlip,
  type Blip,
} from '../services/radarModel';
import {
  defaultPairingMode,
  getPairingMode,
  pairingModesFor,
  type PairingModeId,
} from '../services/pairingModes';
import {
  ensureHome,
  pairWifi,
  pairBleWifi,
  pairBle,
  deviceNeedsWifi,
  startBleScan,
  stopBleScan,
  stopBleWifi,
  stopWifi,
  onPairingProgress,
  onBleScan,
  describeError,
  errorDetail,
  isFailureStep,
  renameDevice,
  pairingStepLabel,
  type PairedDevice,
  type BleScanItem,
  type Subscription,
} from '../services/pairing';
import { dumpPairingLog, logPairing } from '../services/pairingLog';
import { hasBlocker, preflightPairing, type PreflightIssue } from '../services/pairingPreflight';
import { getSavedWifiList, saveWifi, type SavedWifi } from '../services/wifiStore';
import {
  currentWifiAvailable,
  describeWifiScanError,
  detectCurrentWifi,
  getCurrentWifiSsid,
  scanWifiNetworks,
  wifiScanAvailable,
  type ScannedWifi,
} from '../services/wifiScanner';

// Luồng: intro (Wi-Fi + dropdown mode) → searching (RADAR: thiết bị hiện thành blip trên sóng)
// → chạm blip → popup xác nhận → connecting (checklist 3 bước) → paired. Error riêng.
//
// Vì sao radar đứng SAU intro: EZ/AP phát mù, phải có SSID+password TRƯỚC mới quét được. Ngoại lệ
// là mode không cần Wi-Fi (iOS `auto` = BLE thuần) → vào thẳng radar, đúng UX Smart Life.
// Xem dev-workflow/m1-pairing-radar-discovery/.
type Step = 'intro' | 'searching' | 'connecting' | 'paired' | 'error';
type Props = { navigate: Navigate; state: AppState; homeId?: number };
const PLATFORM: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

// Guard timeout phía JS: nếu native không bao giờ resolve/reject → reject sau ms (audit M-5).
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Pairing timed out - try again')), ms),
    ),
  ]);
}
const PAIR_TIMEOUT_MS = 120_000;
const SCAN_TIMEOUT_MS = 120_000;

// 3 bước hiển thị ở màn Connecting (design): map tiến trình pairing thật vào checklist.
const CONNECT_STEPS = ['Authenticating', 'Syncing settings', 'Finalizing'];

export default function PairingScreen({ navigate, state, homeId }: Props) {
  const C = useTheme();
  // homeId tường minh từ Device List (đã qua home-gate). Fallback ensureHome chỉ khi vào pairing trực tiếp.
  const resolveHomeId = async () => homeId ?? (await ensureHome());
  // Mode mặc định: Android EZ · iOS AP (client chốt 2026-07-16). Cả hai đều cần Wi-Fi ⇒ luôn vào
  // 'intro' trước; chỉ khi user tự chọn BLE mới có đường vào thẳng radar.
  const [modeId, setModeId] = useState<PairingModeId>(defaultPairingMode(PLATFORM));
  const mode = getPairingMode(modeId, PLATFORM);
  const needsWifi = mode.wifiInput !== 'none';
  const [step, setStep] = useState<Step>('intro');
  const [blips, setBlips] = useState<Blip[]>([]);
  /** Blip user vừa chạm → mở popup xác nhận. null = popup đóng. */
  const [selected, setSelected] = useState<Blip | null>(null);
  const [modeOpen, setModeOpen] = useState(false);
  /** Dropdown chọn Wi-Fi (chỉ mode EZ) đang xổ hay đã thu lại. */
  const [wifiOpen, setWifiOpen] = useState(false);
  /** Thiếu quyền BLE → hiện lý do + lối gỡ, thay vì để radar quay mù 120s. */
  const [permIssue, setPermIssue] = useState<{ reason: string; message: string } | null>(null);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savedWifis, setSavedWifis] = useState<SavedWifi[]>([]);
  const [scannedWifis, setScannedWifis] = useState<ScannedWifi[]>([]);
  const [scanningWifi, setScanningWifi] = useState(false);
  const [detectingWifi, setDetectingWifi] = useState(false);
  const [wifiScanError, setWifiScanError] = useState('');
  const [preflight, setPreflight] = useState<PreflightIssue[]>([]);
  const [checking, setChecking] = useState(false);
  const [activePairMode, setActivePairMode] = useState('');
  const [found, setFound] = useState<BleScanItem | null>(null);
  const [connectIdx, setConnectIdx] = useState(0); // bước active trong CONNECT_STEPS
  const [progressStep, setProgressStep] = useState('');
  const [result, setResult] = useState<PairedDevice | null>(null);
  const [errMsg, setErrMsg] = useState('');
  // Lỗi SDK báo NGAY TRONG kênh tiến trình (iOS: activator:didReceiveDevice:step:error:).
  // Nó thường cụ thể hơn error cuối cùng (vd "thiết bị không join được Wi-Fi") → giữ riêng để hiện thêm.
  const [stepError, setStepError] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [saving, setSaving] = useState(false);
  const subs = useRef<Subscription[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const connectPulse = useRef(new Animated.Value(0)).current;
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opRef = useRef(0);
  const foundRef = useRef<BleScanItem | null>(null);
  const stepRef = useRef<Step>('intro');
  stepRef.current = step;
  foundRef.current = found;

  // Prefill Wi-Fi đang kết nối; fallback sang Wi-Fi đã nhớ (local) - chỉ khi user chưa gõ gì.
  //
  // ⚠️ Chỉ prefill khi `mode.prefillCurrentWifi` (EZ). AP thì KHÔNG: lúc đó máy có thể đang nối vào
  // HOTSPOT CỦA THIẾT BỊ ⇒ "Wi-Fi đang kết nối" = `SmartLife-xxxx`, trong khi Tuya cần SSID của
  // ROUTER ⇒ tự điền = sai, mà lỗi SDK trả về không hé lộ gì về nguyên nhân.
  // Danh sách savedWifis vẫn nạp cho MỌI mode (dropdown cần), chỉ không TỰ ĐIỀN.
  useEffect(() => {
    void (async () => {
      const [current, saved] = await Promise.all([getCurrentWifiSsid(), getSavedWifiList()]);
      setSavedWifis(saved);
      if (!mode.prefillCurrentWifi) return;
      if (current) {
        setSsid((cur) => cur || current);
        const match = saved.find((item) => item.ssid === current);
        if (match) setPassword((cur) => cur || match.password);
        return;
      }
      const [first] = saved;
      if (first) {
        setSsid((cur) => cur || first.ssid);
        setPassword((cur) => cur || first.password);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Đổi mode → xoá Wi-Fi đã điền. Bắt buộc, không phải cho gọn: EZ→AP mà giữ nguyên ô thì AP thừa
  // hưởng đúng cái SSID prefill mà nó vừa cấm; AP→EZ thì ngược lại, user tưởng đã chọn mạng rồi.
  const prevModeRef = useRef(modeId);
  useEffect(() => {
    if (prevModeRef.current === modeId) return;
    prevModeRef.current = modeId;
    setSsid('');
    setPassword('');
    setWifiOpen(false);
  }, [modeId]);

  // Đổi mạng hoặc đổi mode → kết quả preflight cũ hết giá trị. Đừng để banner lỗi thời trên màn hình.
  useEffect(() => {
    setPreflight([]);
  }, [ssid, modeId]);

  useEffect(() => {
    subs.current = [
      onPairingProgress((e) => {
        setProgressStep(e.step);
        // SDK có thể đính lỗi vào chính event tiến trình - trước đây bị vứt hoàn toàn.
        if (e.errorCode || e.errorMessage) {
          setStepError(
            `${e.errorMessage || 'SDK reported an error'} [${e.errorDomain || 'sdk'}:${e.errorCode ?? '?'}]`,
          );
        }
        // `device_timeout` / `device_state_error` KHÔNG phải tiến trình → đừng nhích checklist,
        // nếu không UI sẽ báo "đang chạy tiếp" trong khi thật ra đã hỏng.
        if (isFailureStep(e.step)) return;
        // EZ báo "thấy thiết bị" qua chính kênh này → lên radar thành blip (AC5). Blip EZ chỉ để
        // HIỂN THỊ: lúc SDK báo find thì nó đã tự bind rồi, chạm vào không gate được gì.
        if (stepRef.current === 'searching') {
          const blip = blipFromEzStep(e);
          if (blip) setBlips((list) => upsertBlip(list, blip));
        }
        setConnectIdx((i) => Math.min(i + 1, CONNECT_STEPS.length - 1));
      }),
      onBleScan((e) => {
        // Gom vào radar thay vì nhảy thẳng sang màn "found" ở thiết bị ĐẦU TIÊN như bản cũ:
        // nhà có 2 thiết bị Tuya thì bản cũ khoá cứng vào cái nào bắn event trước.
        if (stepRef.current !== 'searching') return;
        setBlips((list) => upsertBlip(list, blipFromBleScan(e)));
      }),
    ];
    return () => {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      subs.current.forEach((s) => s.remove());
      stopWifi();
      if (foundRef.current?.uuid) stopBleWifi(foundRef.current.uuid);
      stopBleScan();
    };
  }, []);


  // Chỉ còn pulse của màn 'connecting'. Sóng radar cũ (radarWave1/2/3) đã bỏ: màn 'searching' giờ
  // dùng <RadarView/>, nó tự lo tia quét.
  useEffect(() => {
    if (step !== 'connecting') return undefined;
    connectPulse.setValue(0);
    const connectLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(connectPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(connectPulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    connectLoop.start();
    return () => connectLoop.stop();
  }, [connectPulse, step]);

  const finishSuccess = (dev: PairedDevice) => {
    logPairing('ui.paired', { devId: dev.devId });
    setResult(dev);
    setDeviceName(dev.name || 'Walrus Ice Bath'); // gợi ý tên mặc định, user sửa được
    setStep('paired');
  };
  const finishError = (e: unknown) => {
    logPairing('ui.failed', { ...errorDetail(e) });
    setErrMsg(describeError(e));
    setStep('error');
  };

  /** Chia sẻ log chẩn đoán (Share có sẵn trong RN core; repo chưa có lib clipboard). */
  const shareDiagnostics = async () => {
    try {
      await Share.share({ message: dumpPairingLog() });
    } catch {
      // user bấm huỷ sheet - không phải lỗi
    }
  };

  /** Mốc mở đầu mỗi lần thử: để log phân biệt được các lần retry với nhau. */
  const beginAttempt = (mode: string) => {
    setStepError('');
    logPairing('ui.attempt', { mode, ssid: ssid.trim(), passwordLen: password.length, homeId });
  };
  const persistWifi = async () => {
    const clean = ssid.trim();
    if (!clean) return;
    await saveWifi(clean, password);
    setSavedWifis(await getSavedWifiList());
  };

  const clearScanTimer = () => {
    if (!scanTimerRef.current) return;
    clearTimeout(scanTimerRef.current);
    scanTimerRef.current = null;
  };

  const cancelPairing = () => {
    opRef.current += 1;
    clearScanTimer();
    stopBleScan();
    stopWifi();
    if (foundRef.current?.uuid) stopBleWifi(foundRef.current.uuid);
    logPairing('ui.cancel');
    setProgressStep('');
    setConnectIdx(0);
    setActivePairMode('');
    setStepError('');
    setStep('intro');
  };

  /** Chạy preflight; trả về true nếu được phép đi tiếp. Cảnh báo (warn) vẫn cho qua, chỉ hiện lên. */
  const runPreflight = async (): Promise<boolean> => {
    // BLE thuần: không gửi gì qua Wi-Fi → không có băng tần nào để kiểm.
    if (mode.channel === 'ble') return true;
    setChecking(true);
    try {
      const issues = await preflightPairing({ mode: mode.channel === 'ap' ? 'AP' : 'EZ', ssid });
      setPreflight(issues);
      return !hasBlocker(issues);
    } finally {
      setChecking(false);
    }
  };

  /**
   * Bắt đầu quét → màn radar. Mỗi mode chạy ĐÚNG 1 kênh (`mode.channel`) - không còn chạy song
   * song từ revise #1.
   *
   * Thứ tự có chủ đích: xin quyền BLE TRƯỚC. Thiếu `BLUETOOTH_SCAN` thì `startLeScan` im lặng trả
   * 0 kết quả - radar quay đủ 120s rồi báo "không thấy thiết bị", và ai cũng tưởng thiết bị hỏng.
   */
  const startScan = async () => {
    if (!(await runPreflight())) {
      setStep('intro'); // chặn SỚM - đừng để user ngồi đợi 120s rồi mới biết mạng 5GHz
      return;
    }
    // Dọn kết quả lần trước TRƯỚC mọi nhánh return: nếu không, lần quét hỏng vì thiếu quyền sẽ
    // hiện banner lỗi bên cạnh đám blip cũ còn sót - đọc như "vẫn thấy thiết bị mà lại báo lỗi".
    const op = ++opRef.current;
    clearScanTimer();
    stopBleScan();
    setFound(null);
    setBlips([]);
    setSelected(null);
    setConnectIdx(0);

    if (mode.channel === 'ble') {
      const perm = await ensureBlePermissions();
      if (!perm.ok) {
        setPermIssue({ reason: perm.reason, message: perm.message });
        setStep('searching'); // vẫn vào màn radar, nhưng hiện lý do thay vì quay mù
        return;
      }
    }
    setPermIssue(null);

    beginAttempt(`${modeId} (${mode.channel})`);
    if (needsWifi) void persistWifi();
    setActivePairMode(mode.label);
    setStep('searching');

    if (mode.channel === 'ble') {
      startBleScan(Math.floor(SCAN_TIMEOUT_MS / 1000));
    } else {
      // EZ/AP: pairing luôn, không có bước "thấy trước". SDK báo find giữa chừng → blip; xong thì
      // resolve → nhảy thẳng sang paired (KHÔNG qua popup - nó đã tự bind, hỏi user cũng vô nghĩa).
      const wifiChannel = mode.channel === 'ap' ? 'AP' : 'EZ';
      setProgressStep(`starting (${wifiChannel})`);
      void (async () => {
        try {
          const hid = await resolveHomeId();
          const dev = await withTimeout(
            pairWifi(hid, wifiChannel, ssid, password),
            PAIR_TIMEOUT_MS,
          );
          if (opRef.current === op) {
            clearScanTimer();
            finishSuccess(dev);
          }
        } catch (e) {
          if (opRef.current === op) finishError(e);
        }
      })();
    }

    scanTimerRef.current = setTimeout(() => {
      scanTimerRef.current = null;
      if (opRef.current === op && stepRef.current === 'searching') {
        stopBleScan();
        stopWifi();
        finishError(new Error(nothingFoundMessage()));
      }
    }, SCAN_TIMEOUT_MS);
  };

  /** Không thấy gì sau 120s → nói đúng thứ user cần kiểm, theo mode đang chạy. */
  const nothingFoundMessage = (): string => {
    if (modeId === 'ap') {
      return 'Walrus did not respond. Check that the indicator is blinking slowly and that this phone is connected to the device hotspot, then try again.';
    }
    if (mode.channel !== 'ble') {
      return 'No Walrus found on your Wi-Fi. Check that the indicator is blinking quickly and that this phone is on the 2.4GHz network, then try again.';
    }
    return 'No Walrus devices found nearby. Make sure Bluetooth and Location are on, and the device is in pairing mode - or pick another pairing mode.';
  };

  /** Chạm blip → popup. Xác nhận trong popup → pair thật (chỉ blip BLE mới tới được đây). */
  const connectFound = async (blip: Blip) => {
    const item = blip.raw;
    if (!item) return;
    const needsWifi = deviceNeedsWifi(item);
    if (needsWifi && ssid.trim().length === 0) return; // popup đã chặn, đây là chốt chặn thứ hai
    const op = ++opRef.current;
    clearScanTimer();
    stopBleScan();
    setSelected(null);
    setFound(item);
    beginAttempt(needsWifi ? 'BLE+Wi-Fi combo' : 'BLE');
    if (needsWifi) void persistWifi(); // nhớ Wi-Fi cho lần sau (local)
    setActivePairMode(needsWifi ? 'Bluetooth + Wi-Fi' : 'Bluetooth');
    setConnectIdx(0);
    setProgressStep('connecting');
    setStep('connecting');
    try {
      const hid = await resolveHomeId();
      const dev = needsWifi
        ? await withTimeout(pairBleWifi(hid, item.uuid, ssid, password), PAIR_TIMEOUT_MS)
        : await withTimeout(pairBle(hid, item), PAIR_TIMEOUT_MS);
      if (opRef.current === op) finishSuccess(dev);
    } catch (e) {
      if (opRef.current === op) finishError(e);
    }
  };

  /** Chạm blip trên radar. Blip EZ không pair được bằng tap (SDK đã tự bind) → chỉ mở popup xem. */
  const onPressBlip = (blip: Blip) => {
    logPairing('ui.blip_tap', { key: blip.key, source: blip.source });
    setSelected(blip);
  };

  // "Go to home": lưu tên (nếu đổi) + connect + về Device List (list refetch lúc remount - AC4).
  const done = async () => {
    if (!result) {
      navigate('device-list', { homeId });
      return;
    }
    setSaving(true);
    const name = deviceName.trim();
    const displayName = name || result.name || 'Walrus Ice Bath';
    try {
      if (name && name !== result.name) await renameDevice(result.devId, name);
    } catch (e) {
      // Đặt tên lỗi không chặn hoàn tất - thiết bị đã pair; đổi tên lại ở detail sau (audit L-2).
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[pairing] renameDevice failed', describeError(e));
      }
    }
    await state.connectDevice(result.devId);
    setSaving(false);
    navigate('device-list', {
      homeId,
      pairedDevice: {
        ...result,
        name: displayName,
        isOnline: true,
      },
    });
  };

  // ---------- pieces theo design ----------

  // Field label CAPS + input gạch chân (đồng bộ style màn auth).
  const field = (
    label: string,
    value: string,
    onChange: (s: string) => void,
    placeholder: string,
    secure = false,
  ) => (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 10 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        secureTextEntry={secure}
        autoCapitalize="none"
        style={{
          fontFamily: F.body,
          color: C.white,
          fontSize: 16,
          padding: 0,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}
      />
    </View>
  );

  const chooseWifi = (wifi: SavedWifi) => {
    setSsid(wifi.ssid);
    setPassword(wifi.password);
  };

  const chooseScannedWifi = (wifi: ScannedWifi) => {
    setSsid(wifi.ssid);
    const saved = savedWifis.find((item) => item.ssid === wifi.ssid);
    setPassword(saved?.password ?? '');
  };

  const runWifiScan = async () => {
    if (!wifiScanAvailable || scanningWifi) return;
    setScanningWifi(true);
    setWifiScanError('');
    try {
      setScannedWifis(await scanWifiNetworks());
    } catch (e) {
      setWifiScanError(describeWifiScanError(e));
    } finally {
      setScanningWifi(false);
    }
  };

  // iOS (không có scan list): bấm để xin quyền Location + đọc lại SSID wifi đang kết nối rồi điền vào ô.
  // Cần khi prefill lúc mở màn fail (chưa cấp quyền / vừa đổi mạng). Báo lý do rõ nếu vẫn không đọc được.
  const detectCurrentWifiAndFill = async () => {
    if (detectingWifi) return;
    setDetectingWifi(true);
    setWifiScanError('');
    const res = await detectCurrentWifi();
    if (res.ok) {
      setSsid(res.ssid);
      const match = savedWifis.find((item) => item.ssid === res.ssid);
      if (match) setPassword(match.password);
    } else {
      setWifiScanError(res.message);
    }
    setDetectingWifi(false);
  };

  const signalLabel = (level: number) => {
    if (level >= -55) return 'Strong';
    if (level >= -70) return 'Good';
    return 'Weak';
  };

  const scrollToWifiInput = (y: number) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
    }, 120);
  };

  /** Cảnh báo riêng của mode trên ô Wi-Fi (AP: "đây là Wi-Fi nhà, không phải hotspot SmartLife"). */
  const wifiNotice = () => {
    if (!mode.wifiNotice) return null;
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: C.ochre,
          borderRadius: 12,
          padding: 12,
          marginBottom: 18,
          backgroundColor: 'rgba(196,135,58,0.08)',
        }}
      >
        <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 12, lineHeight: 18 }}>
          {mode.wifiNotice}
        </Text>
      </View>
    );
  };

  /** Ô nhập password - dùng chung cho cả 2 dạng (dropdown và manual). */
  const passwordField = (placeholder: string) => (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12 }}>Password</Text>
        <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
          <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 12 }}>
            {showPassword ? 'Hide' : 'Show'}
          </Text>
        </Pressable>
      </View>
      <TextInput
        value={password}
        onChangeText={setPassword}
        onFocus={() => scrollToWifiInput(360)}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          fontFamily: F.body,
          color: C.white,
          fontSize: 16,
          padding: 0,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}
      />
    </View>
  );

  /**
   * EZ: Network name là DROPDOWN - bấm để xổ danh sách (quét được thì quét, kèm mạng đã lưu),
   * chọn xong THU LẠI. Quét là hợp lệ ở đây vì lúc pair EZ máy đang ở đúng mạng cần truyền.
   * Máy không quét được (iOS / thiếu quyền) → prefill mạng đang kết nối, vẫn gõ tay được.
   */
  const wifiDropdownCard = () => {
    const hasSsid = ssid.trim().length > 0;
    // Gộp mạng quét được + mạng đã lưu, mạng quét được lên trước (có cường độ sóng để chọn).
    const options: { ssid: string; note: string }[] = [
      ...scannedWifis.slice(0, 8).map((w) => ({ ssid: w.ssid, note: signalLabel(w.level) })),
      ...savedWifis
        .filter((sw) => !scannedWifis.some((w) => w.ssid === sw.ssid))
        .map((sw) => ({ ssid: sw.ssid, note: 'saved' })),
    ];

    const openList = () => {
      setWifiOpen((v) => {
        const next = !v;
        // Mở ra thì quét luôn - đừng bắt user bấm thêm nút "Scan" nữa.
        if (next && wifiScanAvailable && scannedWifis.length === 0) void runWifiScan();
        return next;
      });
    };

    const pick = (name: string) => {
      const scanned = scannedWifis.find((w) => w.ssid === name);
      if (scanned) chooseScannedWifi(scanned);
      else {
        const saved = savedWifis.find((w) => w.ssid === name);
        if (saved) chooseWifi(saved);
      }
      setWifiOpen(false); // chọn xong → thu lại (yêu cầu client)
    };

    return (
      <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 24 }}>
        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>
          WI-FI NETWORK
        </Text>

        {wifiNotice()}

        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, marginBottom: 8 }}>
          Network name
        </Text>
        <Pressable
          testID="wifi-dropdown-toggle"
          onPress={openList}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottomWidth: 1,
            borderBottomColor: hasSsid ? C.ochre : C.border,
            paddingBottom: 10,
          }}
        >
          <Text
            numberOfLines={1}
            style={{ fontFamily: F.body, color: hasSsid ? C.white : C.muted, fontSize: 16, flex: 1 }}
          >
            {hasSsid ? ssid : 'Choose your 2.4GHz Wi-Fi'}
          </Text>
          {scanningWifi ? <ActivityIndicator size="small" color={C.ochre} /> : null}
          <Text style={{ color: C.ochre, fontSize: 12, marginLeft: 10 }}>{wifiOpen ? '▲' : '▼'}</Text>
        </Pressable>

        {wifiOpen ? (
          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, marginTop: 10 }}>
            {options.length === 0 ? (
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, padding: 13 }}>
                {scanningWifi
                  ? 'Scanning nearby networks…'
                  : wifiScanAvailable
                  ? 'No networks found. Pull the list again or type the name below.'
                  : 'This phone cannot list nearby networks. Type the name below.'}
              </Text>
            ) : (
              options.map((opt, i) => {
                const on = opt.ssid === ssid.trim();
                return (
                  <Pressable
                    key={`${opt.ssid}-${i}`}
                    testID={`wifi-option-${opt.ssid}`}
                    onPress={() => pick(opt.ssid)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingHorizontal: 13,
                      paddingVertical: 12,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: C.border,
                      backgroundColor: on ? 'rgba(196,135,58,0.1)' : 'transparent',
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{ fontFamily: F.body, color: on ? C.ochre : C.white, fontSize: 13, flex: 1 }}
                    >
                      {opt.ssid}
                    </Text>
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11 }}>{opt.note}</Text>
                  </Pressable>
                );
              })
            )}

            {/* Lối thoát: mạng ẩn / quét không ra → vẫn gõ tay được. */}
            <View style={{ borderTopWidth: 1, borderTopColor: C.border, padding: 13 }}>
              <TextInput
                value={ssid}
                onChangeText={setSsid}
                onFocus={() => scrollToWifiInput(280)}
                placeholder="…or type the network name"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                autoCorrect={false}
                style={{ fontFamily: F.body, color: C.white, fontSize: 14, padding: 0 }}
              />
            </View>
            {wifiScanAvailable ? (
              <Pressable
                onPress={runWifiScan}
                disabled={scanningWifi}
                style={{ borderTopWidth: 1, borderTopColor: C.border, padding: 13, opacity: scanningWifi ? 0.55 : 1 }}
              >
                <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 12 }}>
                  {scanningWifi ? 'Scanning…' : 'Scan again'}
                </Text>
              </Pressable>
            ) : currentWifiAvailable && mode.prefillCurrentWifi ? (
              // Chỉ mode được phép tự điền mới có nút này. Ở AP nó sẽ điền hotspot `SmartLife…` của
              // chính thiết bị - đúng cái sai mà mode đó đang tránh.
              <Pressable
                onPress={detectCurrentWifiAndFill}
                disabled={detectingWifi}
                style={{ borderTopWidth: 1, borderTopColor: C.border, padding: 13, opacity: detectingWifi ? 0.55 : 1 }}
              >
                <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 12 }}>
                  {detectingWifi ? 'Detecting…' : 'Use the network I’m connected to'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {wifiScanError ? (
          <Text style={{ fontFamily: F.body, color: '#E5484D', fontSize: 12, lineHeight: 18, marginTop: 12 }}>
            {wifiScanError}
          </Text>
        ) : null}

        <View style={{ height: 18 }} />
        {passwordField('Wi-Fi password')}

        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 14 }}>
          Walrus pairs over a 2.4GHz network. Saved Wi-Fi stays only on this phone.
        </Text>
      </View>
    );
  };

  /**
   * AP: gõ tay cả 2 ô. KHÔNG scan, KHÔNG prefill - có chủ đích.
   * Lúc pair AP điện thoại đang nối vào HOTSPOT CỦA THIẾT BỊ, nên "Wi-Fi đang kết nối" =
   * `SmartLife-xxxx`, trong khi Tuya cần SSID/password CỦA ROUTER. Prefill ở đây = điền sai gần
   * như chắc chắn, mà lỗi SDK trả về không hé lộ gì về nguyên nhân.
   * Xem docs/research/tuya-ios-ap-mode-pairing.md.
   */
  const wifiManualCard = () => {
    const hasSsid = ssid.trim().length > 0;
    return (
      <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 24 }}>
        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>
          WI-FI NETWORK
        </Text>

        {wifiNotice()}

        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, marginBottom: 8 }}>
            Network name
          </Text>
          <TextInput
            testID="wifi-manual-ssid"
            value={ssid}
            onChangeText={setSsid}
            onFocus={() => scrollToWifiInput(280)}
            placeholder="Your 2.4GHz Wi-Fi name"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              fontFamily: F.body,
              color: C.white,
              fontSize: 16,
              padding: 0,
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: hasSsid ? C.ochre : C.border,
            }}
          />
        </View>

        {passwordField('Your Wi-Fi password')}

        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 14 }}>
          Walrus pairs over a 2.4GHz network. Saved Wi-Fi stays only on this phone.
        </Text>
      </View>
    );
  };

  /** Ô Wi-Fi theo mode - `wifiInput` là dữ liệu từ pairingModes, UI không tự đoán theo id. */
  const wifiCard = () => {
    if (mode.wifiInput === 'dropdown') return wifiDropdownCard();
    if (mode.wifiInput === 'manual') return wifiManualCard();
    return null;
  };

  /** Nhãn kênh cho dòng "Looking over" - tên kỹ thuật (ez/ble) không có nghĩa gì với user. */
  const channelLabel = (channel: string): string =>
    channel === 'ble' ? 'Bluetooth' : channel === 'ez' ? 'Wi-Fi' : 'Hotspot';

  /**
   * Dropdown chọn mode. Đóng lại = chỉ hiện mode đang chọn + hint; mở ra = danh sách đầy đủ, mỗi
   * mode kèm hướng dẫn RIÊNG (nội dung lấy từ pairingModes.ts - đã đối chiếu doc Tuya).
   */
  const modeDropdown = () => {
    const list = pairingModesFor(PLATFORM);
    return (
      <View style={{ marginBottom: 18 }}>
        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 10 }}>
          PAIRING MODE
        </Text>

        <Pressable
          testID="mode-dropdown-toggle"
          onPress={() => setModeOpen((v) => !v)}
          style={{
            borderWidth: 1,
            borderColor: modeOpen ? C.ochre : C.border,
            borderRadius: 14,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.body, color: C.white, fontSize: 14, marginBottom: 4 }}>
              {mode.label}
            </Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11 }}>{mode.hint}</Text>
          </View>
          <Text style={{ color: C.ochre, fontSize: 12 }}>{modeOpen ? '▲' : '▼'}</Text>
        </Pressable>

        {modeOpen && (
          <View style={{ borderWidth: 1, borderColor: C.border, borderTopWidth: 0, borderRadius: 14, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
            {list.map((m) => {
              const on = m.id === modeId;
              return (
                <Pressable
                  key={m.id}
                  testID={`mode-option-${m.id}`}
                  onPress={() => {
                    setModeId(m.id);
                    setModeOpen(false);
                  }}
                  style={{
                    padding: 14,
                    borderTopWidth: 1,
                    borderTopColor: C.border,
                    backgroundColor: on ? 'rgba(196,135,58,0.1)' : 'transparent',
                  }}
                >
                  <Text style={{ fontFamily: F.body, color: on ? C.ochre : C.white, fontSize: 14, marginBottom: 4 }}>
                    {m.label}
                    {/* Chỉ gắn "recommended" chỗ CÓ NGUỒN: Tuya nói thẳng "For iOS 14.5 and later,
                        we recommend that you use the AP mode instead of the Wi-Fi EZ mode".
                        Trên Android thì không - doc còn nói EZ có tỉ lệ thành công THẤP hơn AP, nên
                        gắn nhãn cho EZ là tự bịa. */}
                    {PLATFORM === 'ios' && m.id === 'ap' ? '  · recommended' : ''}
                  </Text>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, lineHeight: 17 }}>
                    {m.hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {stepsCard()}
      </View>
    );
  };

  /**
   * Hướng dẫn từng bước ĐÁNH SỐ của mode đang chọn (AC10).
   * Nội dung từ `pairingModes.ts` - đã đối chiếu doc Tuya; AP iOS ≠ AP Android (SDK Android tự nối
   * hotspot, iOS bắt user ra Settings).
   */
  const stepsCard = () => (
    <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, marginTop: 12 }}>
      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 14 }}>
        HOW TO PAIR
      </Text>
      {mode.steps.map((text, index) => (
        <View
          key={text}
          style={{ flexDirection: 'row', gap: 12, marginBottom: index === mode.steps.length - 1 ? 0 : 14 }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: C.ochre,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 11 }}>{index + 1}</Text>
          </View>
          <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13, lineHeight: 20, flex: 1 }}>
            {text}
          </Text>
        </View>
      ))}
    </View>
  );

  /** Popup xác nhận khi chạm blip trên radar. */
  const blipPopup = () => {
    if (!selected) return null;
    const item = selected.raw;
    const pairable = isPairableBlip(selected);
    const needsWifi = item ? deviceNeedsWifi(item) : false;
    const missingWifi = needsWifi && ssid.trim().length === 0;

    return (
      <Modal transparent visible animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable
          onPress={() => setSelected(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 28 }}
        >
          {/* Chặn press lọt xuống backdrop khi chạm vào thân popup. */}
          <Pressable
            testID="blip-popup"
            onPress={() => {}}
            style={{ borderWidth: 1, borderColor: C.ochre, borderRadius: 18, padding: 22, backgroundColor: C.bg }}
          >
            <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 11, letterSpacing: 3, marginBottom: 10 }}>
              DEVICE FOUND
            </Text>
            <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 24, marginBottom: 18 }}>
              {selected.label}
            </Text>

            {item ? (
              <>
                {infoRow('Device ID', item.mac || item.uuid)}
                {infoRow('Type', needsWifi ? 'Wi-Fi + Bluetooth' : 'Bluetooth', true)}
              </>
            ) : null}
            {infoRow('Found over', selected.source === 'ble' ? 'Bluetooth' : 'Wi-Fi', true)}

            <View style={{ height: 18 }} />

            {!pairable ? (
              // Blip EZ: SDK đã tự bind rồi - không có gì để "thêm". Nói thật thay vì bày nút giả.
              <>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, lineHeight: 19, marginBottom: 16 }}>
                  This device is being added over Wi-Fi right now - no action needed. It will show up
                  as soon as it finishes.
                </Text>
                <GhostButton label="Close" onPress={() => setSelected(null)} />
              </>
            ) : missingWifi ? (
              // Combo cần Wi-Fi mà chưa có → đưa về intro, đừng để nút "Add" bấm vào không chạy.
              <>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, lineHeight: 19, marginBottom: 16 }}>
                  This device joins your Wi-Fi network. Add your 2.4GHz Wi-Fi details first, then tap
                  it again.
                </Text>
                <PrimaryButton
                  label="Enter Wi-Fi details"
                  onPress={() => {
                    setSelected(null);
                    cancelPairing();
                  }}
                />
              </>
            ) : (
              <>
                <PrimaryButton
                  label="Add this device"
                  onPress={() => {
                    void connectFound(selected);
                  }}
                />
                <View style={{ height: 10 }} />
                <GhostButton label="Not this one" onPress={() => setSelected(null)} />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  // Orb của màn 'connecting' (thở nhẹ + spinner). Màn 'searching' dùng <RadarView/> nên nhánh
  // 'searching' của orb cũ (3 vòng sóng + 📡) đã bỏ - không còn ai gọi.
  const connectingOrb = () => {
    const breatheScale = connectPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.96, 1.05],
    });
    return (
      <View style={{ width: 230, height: 230, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            borderWidth: 1.5,
            borderColor: C.ochre,
            backgroundColor: 'rgba(196,135,58,0.08)',
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: breatheScale }],
          }}
        >
          <ActivityIndicator color={C.ochre} />
        </Animated.View>
      </View>
    );
  };

  // Banner preflight: đỏ = chặn (không cho chạy), vàng = cảnh báo (vẫn chạy được).
  const preflightBanner = () => {
    if (preflight.length === 0) return null;
    return (
      <View style={{ marginBottom: 18, gap: 10 }}>
        {preflight.map((issue) => {
          const blocking = issue.severity === 'block';
          const color = blocking ? '#E5484D' : C.ochre;
          return (
            <View
              key={issue.code}
              style={{
                borderWidth: 1,
                borderColor: color,
                borderRadius: 12,
                padding: 14,
                backgroundColor: blocking ? 'rgba(229,72,77,0.08)' : 'rgba(196,135,58,0.08)',
              }}
            >
              <Text style={{ fontFamily: F.body, color, fontSize: 11, letterSpacing: 2, marginBottom: 6 }}>
                {blocking ? 'CANNOT PAIR' : 'HEADS UP'}
              </Text>
              <Text style={{ fontFamily: F.body, color: C.white, fontSize: 12, lineHeight: 18 }}>
                {issue.message}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const infoRow = (label: string, value: string, accent = false) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 7,
      }}
    >
      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>{label}</Text>
      <Text
        numberOfLines={1}
        style={{ fontFamily: F.body, color: accent ? C.ochre : C.white, fontSize: 13, flexShrink: 1 }}
      >
        {value}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {blipPopup()}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <SafeAreaView style={{ flex: 1 }}>
        {/* Back nằm CÙNG HÀNG với title (xem header trong ScrollView) - ở màn error thì không có
            title nên back đứng riêng. Đang search/connect thì không cho thoát ngang. */}
        {step === 'error' && (
          <Pressable
            onPress={() => navigate('device-list', { homeId })}
            hitSlop={12}
            style={{ paddingHorizontal: 28, paddingTop: 20 }}
          >
            <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
          </Pressable>
        )}

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            padding: 28,
            paddingBottom: Platform.OS === 'ios' ? 160 : 120,
            flexGrow: 1,
            justifyContent: step === 'intro' || step === 'error' ? 'flex-start' : 'center',
          }}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'intro' && (
            <>
              {/* Back + title cùng một hàng. Title để 1 dòng nên `adjustsFontSizeToFit` lo phần
                  máy hẹp, thay vì xuống dòng. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                {/* To hơn 20 của các màn khác vì ở đây nó nằm CẠNH title 28px - để 20 thì lọt thỏm.
                    Các màn khác mũi tên đứng một mình phía trên nên 20 vẫn cân. */}
                <Pressable onPress={() => navigate('device-list', { homeId })} hitSlop={12}>
                  <Text style={{ color: C.muted, fontSize: 26 }}>←</Text>
                </Pressable>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{ fontFamily: F.headline, color: C.white, fontSize: 28, flex: 1 }}
                >
                  Pair your Walrus
                </Text>
              </View>

              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, lineHeight: 22, marginBottom: 24 }}>
                Control your Ice Bath remotely.{'\n'}Set the temperature before you arrive.
              </Text>

              {/* Ô Wi-Fi theo mode: EZ = dropdown quét · AP = tự nhập · BLE = ẩn hẳn. */}
              {wifiCard()}

              {modeDropdown()}

              {preflightBanner()}

              <View style={{ height: 6 }} />
              <PrimaryButton
                label={checking ? 'Checking…' : 'Start searching'}
                onPress={() => {
                  void startScan();
                }}
                disabled={(needsWifi && ssid.trim().length === 0) || checking}
              />

              <View style={{ alignItems: 'center', marginTop: 16 }}>
                <Pressable onPress={() => navigate('device-list', { homeId })} hitSlop={8}>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>Skip for now</Text>
                </Pressable>
              </View>
            </>
          )}

          {step === 'searching' && (
            <View style={{ alignItems: 'center' }}>
              <RadarView blips={blips} onPressBlip={onPressBlip} sweeping={!permIssue} />

              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 26, marginTop: 26 }}>
                {blips.length > 0 ? 'Device found.' : 'Searching for nearby devices…'}
              </Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 10 }}>
                {blips.length > 0
                  ? 'Tap the device on the radar to add it.'
                  : // Đang quét: nhắc lại đúng bước user cần làm ngay lúc này (bước 1 = đèn báo),
                    // không dội cả danh sách lên màn radar.
                    mode.steps[0]}
              </Text>

              {/* Thiếu quyền BLE → nói thẳng lý do + lối gỡ. Bug cũ: quay mù 120s rồi báo
                  "không thấy thiết bị", ai cũng tưởng thiết bị hỏng. */}
              {permIssue && (
                <View
                  style={{
                    alignSelf: 'stretch',
                    marginTop: 22,
                    borderWidth: 1,
                    borderColor: '#E5484D',
                    borderRadius: 12,
                    padding: 14,
                    backgroundColor: 'rgba(229,72,77,0.08)',
                  }}
                >
                  <Text style={{ fontFamily: F.body, color: '#E5484D', fontSize: 12, lineHeight: 18 }}>
                    {permIssue.message}
                  </Text>
                  <View style={{ height: 10 }} />
                  {permIssue.reason === 'blocked' ? (
                    <GhostButton label="Open Settings" onPress={() => void Linking.openSettings()} />
                  ) : (
                    <GhostButton label="Try again" onPress={() => void startScan()} />
                  )}
                </View>
              )}

              <View style={{ alignSelf: 'stretch', marginTop: 24, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16 }}>
                {infoRow('Mode', mode.label, true)}
                {infoRow('Looking over', channelLabel(mode.channel), true)}
                {infoRow('Timeout', '120 seconds')}
              </View>

              <View style={{ alignSelf: 'stretch', marginTop: 20 }}>
                <GhostButton label="Cancel" onPress={cancelPairing} />
              </View>
              <View style={{ alignItems: 'center', marginTop: 16 }}>
                <Pressable onPress={cancelPairing} hitSlop={8}>
                  <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 13 }}>
                    Change pairing mode
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {step === 'connecting' && (
            <View style={{ alignItems: 'center' }}>
              {connectingOrb()}
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 26, marginTop: 24 }}>
                Connecting…
              </Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, marginTop: 6 }}>
                {(found?.name || result?.name || 'Walrus Ice Bath') + ''}
              </Text>

              <View style={{ alignSelf: 'stretch', marginTop: 26, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16 }}>
                {infoRow('Pairing mode', activePairMode || mode.label, true)}
                {infoRow('Network', ssid || '-')}
                {infoRow('Timeout', '120 seconds')}
              </View>

              {/* Checklist 3 bước (design màn 4) - nhích theo tiến trình pairing thật */}
              <View style={{ alignSelf: 'stretch', marginTop: 30, paddingHorizontal: 12 }}>
                {CONNECT_STEPS.map((label, i) => {
                  const done_ = i < connectIdx;
                  const active = i === connectIdx;
                  return (
                    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: i < CONNECT_STEPS.length - 1 ? 22 : 0 }}>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          borderWidth: 1.5,
                          borderColor: done_ || active ? C.ochre : C.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {done_ ? (
                          <Text style={{ color: C.ochre, fontSize: 15 }}>✓</Text>
                        ) : active ? (
                          <ActivityIndicator size="small" color={C.ochre} />
                        ) : null}
                      </View>
                      <Text style={{ fontFamily: F.body, color: active ? C.ochre : done_ ? C.white : C.muted, fontSize: 15 }}>
                        {label}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, marginTop: 28, textAlign: 'center' }}>
                {pairingStepLabel(progressStep)} · this can take up to 2 minutes
              </Text>
              <View style={{ alignSelf: 'stretch', marginTop: 22 }}>
                <GhostButton label="Cancel" onPress={cancelPairing} />
              </View>
            </View>
          )}

          {step === 'paired' && (
            <View style={{ alignItems: 'center' }}>
              <View
                style={{
                  width: 104,
                  height: 104,
                  borderRadius: 52,
                  borderWidth: 1.5,
                  borderColor: C.ochre,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: C.ochre, fontSize: 34 }}>✓</Text>
              </View>
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 30, marginTop: 26 }}>
                Paired.
              </Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8, marginBottom: 30 }}>
                {(result?.name || 'Walrus Ice Bath') + ' is ready.'}{'\n'}Control it from anywhere.
              </Text>

              {/* Đặt tên (Tuya/SmartLife - design thiếu, giữ + style design) */}
              <View style={{ alignSelf: 'stretch' }}>
                {field('DEVICE NAME', deviceName, setDeviceName, 'Walrus Ice Bath')}
                {saving ? (
                  <ActivityIndicator color={C.ochre} />
                ) : (
                  <PrimaryButton label="Go to home" onPress={done} disabled={deviceName.trim().length === 0} />
                )}
              </View>
            </View>
          )}

          {step === 'error' && (
            <>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginTop: 10, marginBottom: 12 }}>
                DEVICE PAIRING
              </Text>
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28, marginBottom: 10 }}>
                Pairing failed.
              </Text>
              {/* selectable → user long-press copy được thẳng mã lỗi mà không cần mở Share sheet. */}
              <Text
                selectable
                style={{ fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: stepError ? 14 : 24 }}
              >
                {errMsg}
              </Text>

              {/* Lỗi SDK báo giữa chừng - thường cụ thể hơn error cuối (vd không join được Wi-Fi). */}
              {stepError ? (
                <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 24 }}>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 8 }}>
                    SDK REPORTED
                  </Text>
                  <Text selectable style={{ fontFamily: F.body, color: C.white, fontSize: 12, lineHeight: 18 }}>
                    {stepError}
                  </Text>
                </View>
              ) : null}

              <PrimaryButton label="Try again" onPress={() => setStep('intro')} />
              <View style={{ height: 10 }} />
              <GhostButton label="Copy diagnostics" onPress={shareDiagnostics} />
              <View style={{ height: 10 }} />
              <GhostButton label="Back" onPress={() => navigate('device-list', { homeId })} />
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 16 }}>
                Diagnostics include the pairing steps and error codes - no passwords.
              </Text>
            </>
          )}
        </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}
