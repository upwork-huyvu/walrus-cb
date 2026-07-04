import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  SafeAreaView,
  ScrollView,
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
import {
  ensureHome,
  pairWifi,
  pairBleWifi,
  startBleScan,
  stopBleScan,
  stopBleWifi,
  stopWifi,
  onPairingProgress,
  onBleScan,
  describeError,
  renameDevice,
  pairingStepLabel,
  type PairedDevice,
  type BleScanItem,
  type Subscription,
} from '../services/pairing';
import { getSavedWifiList, saveWifi, type SavedWifi } from '../services/wifiStore';
import {
  describeWifiScanError,
  getCurrentWifiSsid,
  scanWifiNetworks,
  wifiScanAvailable,
  type ScannedWifi,
} from '../services/wifiScanner';

// Luồng theo design 5 màn: intro (confirm cùng Wi-Fi) → searching (radar) → found (Ready to pair)
// → connecting (checklist 3 bước) → paired (✓ + đặt tên + Go to home). Error riêng.
// Design không có nhập Wi-Fi/đặt tên nhưng Tuya bắt buộc → giữ, style theo design (label CAPS).
type Step = 'intro' | 'prepare' | 'searching' | 'found' | 'connecting' | 'paired' | 'error';
type WifiMode = 'EZ' | 'AP';
type Props = { navigate: Navigate; state: AppState; homeId?: number };

// Guard timeout phía JS: nếu native không bao giờ resolve/reject → reject sau ms (audit M-5).
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Pairing timed out — try again')), ms),
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
  const [step, setStep] = useState<Step>('intro');
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savedWifis, setSavedWifis] = useState<SavedWifi[]>([]);
  const [scannedWifis, setScannedWifis] = useState<ScannedWifi[]>([]);
  const [scanningWifi, setScanningWifi] = useState(false);
  const [wifiScanError, setWifiScanError] = useState('');
  const [wifiMode, setWifiMode] = useState<WifiMode>('EZ'); // EZ mặc định; AP = fallback khi EZ fail
  const [activePairMode, setActivePairMode] = useState('');
  const [found, setFound] = useState<BleScanItem | null>(null);
  const [connectIdx, setConnectIdx] = useState(0); // bước active trong CONNECT_STEPS
  const [progressStep, setProgressStep] = useState('');
  const [result, setResult] = useState<PairedDevice | null>(null);
  const [errMsg, setErrMsg] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [saving, setSaving] = useState(false);
  const subs = useRef<Subscription[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const radarWave1 = useRef(new Animated.Value(0)).current;
  const radarWave2 = useRef(new Animated.Value(0)).current;
  const radarWave3 = useRef(new Animated.Value(0)).current;
  const connectPulse = useRef(new Animated.Value(0)).current;
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opRef = useRef(0);
  const foundRef = useRef<BleScanItem | null>(null);
  const stepRef = useRef<Step>('intro');
  stepRef.current = step;
  foundRef.current = found;

  // Prefill Wi-Fi đang kết nối; fallback sang Wi-Fi đã nhớ (local) — chỉ khi user chưa gõ gì.
  useEffect(() => {
    void (async () => {
      const [current, saved] = await Promise.all([getCurrentWifiSsid(), getSavedWifiList()]);
      setSavedWifis(saved);
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
  }, []);

  useEffect(() => {
    subs.current = [
      onPairingProgress((e) => {
        setProgressStep(e.step);
        // Mỗi event tiến trình → nhích checklist (tối đa bước cuối).
        setConnectIdx((i) => Math.min(i + 1, CONNECT_STEPS.length - 1));
      }),
      onBleScan((e) => {
        // Design: tìm thấy thiết bị đầu tiên → sang màn "Ready to pair" (ice bath thường chỉ 1 máy).
        if (stepRef.current === 'searching') {
          stopBleScan();
          setFound(e);
          setStep('found');
        }
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

  useEffect(() => {
    if (step !== 'searching' && step !== 'connecting') return undefined;
    radarWave1.setValue(0);
    radarWave2.setValue(0);
    radarWave3.setValue(0);
    connectPulse.setValue(0);

    const wave = (value: Animated.Value, delayMs: number) =>
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(value, {
          toValue: 1,
          duration: 1700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(Math.max(0, 2300 - delayMs - 1700)),
      ]);
    const waveLoop = Animated.loop(
      Animated.parallel([
        wave(radarWave1, 0),
        wave(radarWave2, 560),
        wave(radarWave3, 1120),
      ]),
    );
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

    if (step === 'searching') waveLoop.start();
    if (step === 'connecting') connectLoop.start();
    return () => {
      waveLoop.stop();
      connectLoop.stop();
    };
  }, [connectPulse, radarWave1, radarWave2, radarWave3, step]);

  const finishSuccess = (dev: PairedDevice) => {
    setResult(dev);
    setDeviceName(dev.name || 'Walrus Ice Bath'); // gợi ý tên mặc định, user sửa được
    setStep('paired');
  };
  const finishError = (e: unknown) => {
    setErrMsg(describeError(e));
    setStep('error');
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
    setProgressStep('');
    setConnectIdx(0);
    setActivePairMode('');
    setStep('intro');
  };

  const prepareWifiPairing = () => {
    void persistWifi();
    setFound(null);
    setActivePairMode(`Wi-Fi ${wifiMode}`);
    setStep('prepare');
  };

  // "Search for device" (design) = BLE scan; timeout 120s không thấy gì → error + Search again.
  const startSearch = () => {
    const op = ++opRef.current;
    clearScanTimer();
    void persistWifi(); // nhớ Wi-Fi cho lần sau (local)
    setFound(null);
    setActivePairMode('Bluetooth + Wi-Fi');
    setStep('searching');
    startBleScan(Math.floor(SCAN_TIMEOUT_MS / 1000));
    scanTimerRef.current = setTimeout(() => {
      scanTimerRef.current = null;
      if (opRef.current === op && stepRef.current === 'searching') {
        stopBleScan();
        finishError(new Error('No Walrus devices found — check the device power and Wi-Fi, then try again.'));
      }
    }, SCAN_TIMEOUT_MS);
  };

  // "Connect to this device" → pair BLE + gửi Wi-Fi credentials.
  const connectFound = async () => {
    if (!found) return;
    const op = ++opRef.current;
    clearScanTimer();
    setActivePairMode('Bluetooth + Wi-Fi');
    setConnectIdx(0);
    setProgressStep('connecting');
    setStep('connecting');
    try {
      const hid = await resolveHomeId();
      const dev = await withTimeout(pairBleWifi(hid, found.uuid, ssid, password), PAIR_TIMEOUT_MS);
      if (opRef.current === op) finishSuccess(dev);
    } catch (e) {
      if (opRef.current === op) finishError(e);
    }
  };

  // Flow chính: pair thẳng qua Wi-Fi (EZ/AP) sau khi user xác nhận thiết bị đã ở đúng pairing mode.
  const runWifi = async () => {
    const op = ++opRef.current;
    clearScanTimer();
    void persistWifi(); // nhớ Wi-Fi cho lần sau (local)
    setFound(null);
    setActivePairMode(`Wi-Fi ${wifiMode}`);
    setConnectIdx(0);
    setProgressStep(`starting (${wifiMode})`);
    setStep('connecting');
    try {
      const hid = await resolveHomeId();
      const dev = await withTimeout(pairWifi(hid, wifiMode, ssid, password), PAIR_TIMEOUT_MS);
      if (opRef.current === op) finishSuccess(dev);
    } catch (e) {
      if (opRef.current === op) finishError(e);
    }
  };

  // "Go to home": lưu tên (nếu đổi) + connect + về Device List (list refetch lúc remount — AC4).
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
      // Đặt tên lỗi không chặn hoàn tất — thiết bị đã pair; đổi tên lại ở detail sau (audit L-2).
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

  const wifiCard = () => {
    const hasSsid = ssid.trim().length > 0;
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 16,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>
          WI-FI NETWORK
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, flex: 1 }}>
            {wifiScanAvailable
              ? 'Scan nearby networks, then enter the password.'
              : 'Use the connected Wi-Fi if detected, or enter the network name.'}
          </Text>
          {wifiScanAvailable ? (
            <Pressable
              onPress={runWifiScan}
              disabled={scanningWifi}
              style={{
                borderWidth: 1,
                borderColor: C.ochre,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 8,
                opacity: scanningWifi ? 0.55 : 1,
              }}
            >
              <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 12 }}>
                {scanningWifi ? 'Scanning...' : 'Scan'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {wifiScanError ? (
          <Text style={{ fontFamily: F.body, color: '#E5484D', fontSize: 12, lineHeight: 18, marginBottom: 12 }}>
            {wifiScanError}
          </Text>
        ) : null}

        {wifiScanAvailable && scannedWifis.length === 0 ? (
          <View style={{ marginBottom: 18 }}>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, marginBottom: 10 }}>
              Nearby networks
            </Text>
            <View
              style={{
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 13,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {scanningWifi ? <ActivityIndicator size="small" color={C.ochre} /> : null}
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, flex: 1 }}>
                {scanningWifi ? 'Scanning nearby networks...' : 'Tap Scan to show nearby networks.'}
              </Text>
            </View>
          </View>
        ) : null}

        {scannedWifis.length > 0 ? (
          <View style={{ marginBottom: 18 }}>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, marginBottom: 10 }}>
              Nearby networks
            </Text>
            <View style={{ gap: 8 }}>
              {scannedWifis.slice(0, 8).map((wifi) => {
                const selected = wifi.ssid === ssid.trim();
                const saved = savedWifis.some((item) => item.ssid === wifi.ssid);
                return (
                  <Pressable
                    key={`${wifi.ssid}-${wifi.bssid}`}
                    onPress={() => chooseScannedWifi(wifi)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: selected ? C.ochre : C.border,
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 11,
                      backgroundColor: selected ? 'rgba(196,135,58,0.1)' : 'transparent',
                      gap: 10,
                    }}
                  >
                    <Text style={{ fontFamily: F.body, color: selected ? C.ochre : C.white, fontSize: 13, flex: 1 }}>
                      {wifi.ssid}
                    </Text>
                    {saved ? (
                      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11 }}>saved</Text>
                    ) : null}
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11 }}>
                      {signalLabel(wifi.level)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {savedWifis.length > 0 ? (
          <View style={{ marginBottom: 18 }}>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, marginBottom: 10 }}>
              Choose a saved network
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {savedWifis.map((wifi) => {
                const selected = wifi.ssid === ssid.trim();
                return (
                  <Pressable
                    key={wifi.ssid}
                    onPress={() => chooseWifi(wifi)}
                    style={{
                      borderWidth: 1,
                      borderColor: selected ? C.ochre : C.border,
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      backgroundColor: selected ? 'rgba(196,135,58,0.1)' : 'transparent',
                    }}
                  >
                    <Text style={{ fontFamily: F.body, color: selected ? C.ochre : C.white, fontSize: 12 }}>
                      {wifi.ssid}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, marginBottom: 8 }}>
            Network name
          </Text>
          <TextInput
            value={ssid}
            onChangeText={setSsid}
            onFocus={() => scrollToWifiInput(280)}
            placeholder="2.4GHz Wi-Fi name"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            autoCorrect={false}
            selectTextOnFocus={false}
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
            placeholder="Wi-Fi password"
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

        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 14 }}>
          Walrus pairs over a 2.4GHz network. Saved Wi-Fi stays only on this phone.
        </Text>
      </View>
    );
  };

  const pairingOrb = (mode: 'searching' | 'connecting') => {
    const waveStyle = (value: Animated.Value) => ({
      opacity: value.interpolate({
        inputRange: [0, 0.18, 0.72, 1],
        outputRange: [0, 0.42, 0.14, 0],
      }),
      transform: [
        {
          scale: value.interpolate({
            inputRange: [0, 1],
            outputRange: [0.62, 1.85],
          }),
        },
      ],
    });
    const centerScale = radarWave1.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.04],
    });
    const breatheScale = connectPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.96, 1.05],
    });
    const isSearching = mode === 'searching';
    return (
      <View style={{ width: 230, height: 230, alignItems: 'center', justifyContent: 'center' }}>
        {isSearching
          ? [radarWave1, radarWave2, radarWave3].map((waveValue, index) => (
              <Animated.View
                key={index}
                style={[
                  {
                    position: 'absolute',
                    width: 126,
                    height: 126,
                    borderRadius: 63,
                    borderWidth: 1.4,
                    borderColor: C.ochre,
                  },
                  waveStyle(waveValue),
                ]}
              />
            ))
          : null}
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
            transform: [{ scale: isSearching ? centerScale : breatheScale }],
          }}
        >
          {isSearching ? (
            <Text style={{ fontSize: 32 }}>📡</Text>
          ) : (
            <ActivityIndicator color={C.ochre} />
          )}
        </Animated.View>
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <SafeAreaView style={{ flex: 1 }}>
        {/* Back về Device List (chỉ ở màn tĩnh — đang search/connect thì không thoát ngang) */}
        {(step === 'intro' || step === 'prepare' || step === 'found' || step === 'error') && (
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
            justifyContent: step === 'intro' || step === 'prepare' || step === 'found' || step === 'error' ? 'flex-start' : 'center',
          }}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'intro' && (
            <>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginTop: 10, marginBottom: 12 }}>
                DEVICE PAIRING
              </Text>
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 32, lineHeight: 40, marginBottom: 12 }}>
                Pair your{'\n'}Walrus.
              </Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, lineHeight: 22, marginBottom: 28 }}>
                Control your Ice Bath remotely.{'\n'}Set the temperature before you arrive.
              </Text>

              {/* Card confirm cùng Wi-Fi (design màn 1) */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  borderWidth: 1,
                  borderColor: C.border,
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 26,
                }}
              >
                <Text style={{ fontSize: 18 }}>📶</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.body, color: C.white, fontSize: 14, marginBottom: 4 }}>
                    Same Wi-Fi required
                  </Text>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, lineHeight: 18 }}>
                    Put Walrus in pairing mode, then send your 2.4GHz Wi-Fi credentials.
                  </Text>
                </View>
              </View>

              {/* Tuya cần Wi-Fi credentials để thiết bị join mạng. Cho chọn mạng đã lưu hoặc nhập mới. */}
              {wifiCard()}

              <View style={{ marginBottom: 18 }}>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 10 }}>
                  PAIRING MODE
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {(['EZ', 'AP'] as WifiMode[]).map((mode) => {
                    const selected = wifiMode === mode;
                    return (
                      <Pressable
                        key={mode}
                        onPress={() => setWifiMode(mode)}
                        style={{
                          flex: 1,
                          borderWidth: 1,
                          borderColor: selected ? C.ochre : C.border,
                          borderRadius: 14,
                          padding: 14,
                          backgroundColor: selected ? 'rgba(196,135,58,0.1)' : 'transparent',
                        }}
                      >
                        <Text style={{ fontFamily: F.body, color: selected ? C.ochre : C.white, fontSize: 14, marginBottom: 5 }}>
                          {mode}
                        </Text>
                        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, lineHeight: 16 }}>
                          {mode === 'EZ' ? 'Fast blink setup' : 'Hotspot setup'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ height: 6 }} />
              <PrimaryButton label={`Continue with ${wifiMode} mode`} onPress={prepareWifiPairing} disabled={ssid.trim().length === 0} />
              <View style={{ height: 6 }} />

              {/* BLE combo vẫn giữ như một option phụ khi thiết bị hỗ trợ BLE provisioning. */}
              <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
                <Pressable onPress={startSearch} hitSlop={8} disabled={ssid.trim().length === 0}>
                  <Text style={{ fontFamily: F.body, color: ssid.trim() ? C.ochre : C.muted, fontSize: 13 }}>
                    Search via Bluetooth instead
                  </Text>
                </Pressable>
              </View>

              <View style={{ alignItems: 'center', marginTop: 16 }}>
                <Pressable onPress={() => navigate('device-list', { homeId })} hitSlop={8}>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>Skip for now</Text>
                </Pressable>
              </View>
            </>
          )}

          {step === 'prepare' && (
            <>
              <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 11, letterSpacing: 3, marginTop: 10, marginBottom: 12 }}>
                {wifiMode} MODE
              </Text>
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 30, lineHeight: 38, marginBottom: 12 }}>
                Put Walrus into{'\n'}pairing mode.
              </Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 21, marginBottom: 24 }}>
                {wifiMode === 'EZ'
                  ? 'Use EZ when the Wi-Fi indicator is blinking quickly. The app will send your network credentials through the router.'
                  : 'Use AP when Walrus exposes its own hotspot. Connect this phone to the Walrus hotspot, then return here to start pairing.'}
              </Text>

              <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 18, marginBottom: 22 }}>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 14 }}>
                  BEFORE PAIRING
                </Text>
                {(wifiMode === 'EZ'
                  ? [
                      'Reset Walrus until the Wi-Fi indicator blinks quickly.',
                      'Keep this phone connected to the selected 2.4GHz Wi-Fi.',
                      'Stay near the device until pairing completes.',
                    ]
                  : [
                      'Reset Walrus until the Wi-Fi indicator blinks slowly.',
                      'Open phone Wi-Fi settings and connect to the Walrus hotspot.',
                      'Return to this screen and start pairing.',
                    ]
                ).map((item, index) => (
                  <View key={item} style={{ flexDirection: 'row', gap: 12, marginBottom: index === 2 ? 0 : 14 }}>
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
                      {item}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 24 }}>
                {infoRow('Pairing mode', `Wi-Fi ${wifiMode}`, true)}
                {infoRow('Network', ssid || '—')}
                {infoRow('Timeout', '120 seconds')}
              </View>

              <PrimaryButton label="Start pairing" onPress={runWifi} disabled={ssid.trim().length === 0} />
              <View style={{ height: 10 }} />
              <GhostButton label="Back to Wi-Fi details" onPress={() => setStep('intro')} />
            </>
          )}

          {step === 'searching' && (
            <View style={{ alignItems: 'center' }}>
              {pairingOrb('searching')}
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 26, marginTop: 32 }}>
                Searching for Walrus…
              </Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 10 }}>
                Keep the device powered on and near this phone.{'\n'}Tuya BLE scan is running now.
              </Text>
              <View style={{ alignSelf: 'stretch', marginTop: 30, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16 }}>
                {infoRow('Pairing mode', 'Bluetooth + Wi-Fi', true)}
                {infoRow('Network', ssid || '—')}
                {infoRow('Timeout', '120 seconds')}
              </View>
              <View style={{ alignSelf: 'stretch', marginTop: 20 }}>
                <GhostButton label="Cancel" onPress={cancelPairing} />
              </View>
            </View>
          )}

          {step === 'found' && found && (
            <>
              <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 11, letterSpacing: 3, marginTop: 10, marginBottom: 12 }}>
                DEVICE FOUND
              </Text>
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 30, marginBottom: 22 }}>
                Ready to pair.
              </Text>

              {/* Card thiết bị (design màn 3) — data thật từ BLE scan */}
              <View style={{ borderWidth: 1, borderColor: C.ochre, borderRadius: 16, padding: 18, marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 19 }}>
                    {found.name || 'Walrus Ice Bath'}
                  </Text>
                  <Text style={{ color: C.ochre, fontSize: 14 }}>▂▄▆</Text>
                </View>
                {infoRow('Device ID', found.mac || found.uuid)}
                {infoRow('Signal', 'Strong', true)}
                {infoRow('Network', ssid || '—')}
                {infoRow('Status', 'Ready', true)}
              </View>

              <PrimaryButton label="Connect to this device" onPress={connectFound} />
              <View style={{ alignItems: 'center', marginTop: 16 }}>
                <Pressable onPress={startSearch} hitSlop={8}>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>Search again</Text>
                </Pressable>
              </View>
            </>
          )}

          {step === 'connecting' && (
            <View style={{ alignItems: 'center' }}>
              {pairingOrb('connecting')}
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 26, marginTop: 24 }}>
                Connecting…
              </Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, marginTop: 6 }}>
                {(found?.name || result?.name || 'Walrus Ice Bath') + ''}
              </Text>

              <View style={{ alignSelf: 'stretch', marginTop: 26, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16 }}>
                {infoRow('Pairing mode', activePairMode || `Wi-Fi ${wifiMode}`, true)}
                {infoRow('Network', ssid || '—')}
                {infoRow('Timeout', '120 seconds')}
              </View>

              {/* Checklist 3 bước (design màn 4) — nhích theo tiến trình pairing thật */}
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

              {/* Đặt tên (Tuya/SmartLife — design thiếu, giữ + style design) */}
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
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 28 }}>
                {errMsg}
              </Text>
              <PrimaryButton label="Try again" onPress={() => setStep('intro')} />
              <View style={{ height: 10 }} />
              <GhostButton label="Back" onPress={() => navigate('device-list', { homeId })} />
            </>
          )}
        </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}
