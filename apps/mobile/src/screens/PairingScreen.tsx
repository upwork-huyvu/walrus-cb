import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
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
import { getSavedWifi, saveWifi } from '../services/wifiStore';

// Luồng theo design 5 màn: intro (confirm cùng Wi-Fi) → searching (radar) → found (Ready to pair)
// → connecting (checklist 3 bước) → paired (✓ + đặt tên + Go to home). Error riêng.
// Design không có nhập Wi-Fi/đặt tên nhưng Tuya bắt buộc → giữ, style theo design (label CAPS).
type Step = 'intro' | 'searching' | 'found' | 'connecting' | 'paired' | 'error';
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
const PAIR_TIMEOUT_MS = 130_000;
const SCAN_TIMEOUT_MS = 60_000;

// 3 bước hiển thị ở màn Connecting (design): map tiến trình pairing thật vào checklist.
const CONNECT_STEPS = ['Authenticating', 'Syncing settings', 'Finalizing'];

export default function PairingScreen({ navigate, state, homeId }: Props) {
  const C = useTheme();
  // homeId tường minh từ Device List (đã qua home-gate). Fallback ensureHome chỉ khi vào pairing trực tiếp.
  const resolveHomeId = async () => homeId ?? (await ensureHome());
  const [step, setStep] = useState<Step>('intro');
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [wifiMode, setWifiMode] = useState<WifiMode>('EZ'); // EZ mặc định; AP = fallback khi EZ fail
  const [found, setFound] = useState<BleScanItem | null>(null);
  const [connectIdx, setConnectIdx] = useState(0); // bước active trong CONNECT_STEPS
  const [progressStep, setProgressStep] = useState('');
  const [result, setResult] = useState<PairedDevice | null>(null);
  const [errMsg, setErrMsg] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [saving, setSaving] = useState(false);
  const subs = useRef<Subscription[]>([]);
  const stepRef = useRef<Step>('intro');
  stepRef.current = step;

  // Prefill Wi-Fi đã nhớ (local) — chỉ khi user chưa gõ gì.
  useEffect(() => {
    void (async () => {
      const saved = await getSavedWifi();
      if (!saved) return;
      setSsid((cur) => cur || saved.ssid);
      setPassword((cur) => cur || saved.password);
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
      subs.current.forEach((s) => s.remove());
      stopWifi();
      stopBleScan();
    };
  }, []);

  const finishSuccess = (dev: PairedDevice) => {
    setResult(dev);
    setDeviceName(dev.name || 'Walrus Ice Bath'); // gợi ý tên mặc định, user sửa được
    setStep('paired');
  };
  const finishError = (e: unknown) => {
    setErrMsg(describeError(e));
    setStep('error');
  };

  // "Search for device" (design) = BLE scan; timeout 60s không thấy gì → error + Search again.
  const startSearch = () => {
    void saveWifi(ssid.trim(), password); // nhớ Wi-Fi cho lần sau (local)
    setFound(null);
    setStep('searching');
    startBleScan(Math.floor(SCAN_TIMEOUT_MS / 1000));
    setTimeout(() => {
      if (stepRef.current === 'searching') {
        stopBleScan();
        finishError(new Error('No Walrus devices found — check the device power and Wi-Fi, then try again.'));
      }
    }, SCAN_TIMEOUT_MS);
  };

  // "Connect to this device" → pair BLE + gửi Wi-Fi credentials.
  const connectFound = async () => {
    if (!found) return;
    setConnectIdx(0);
    setProgressStep('connecting');
    setStep('connecting');
    try {
      const hid = await resolveHomeId();
      finishSuccess(await withTimeout(pairBleWifi(hid, found.uuid, ssid, password), PAIR_TIMEOUT_MS));
    } catch (e) {
      finishError(e);
    }
  };

  // Fallback: pair thẳng qua Wi-Fi (EZ/AP) — không cần search BLE.
  const runWifi = async () => {
    void saveWifi(ssid.trim(), password); // nhớ Wi-Fi cho lần sau (local)
    setConnectIdx(0);
    setProgressStep(`starting (${wifiMode})`);
    setStep('connecting');
    try {
      const hid = await resolveHomeId();
      finishSuccess(await withTimeout(pairWifi(hid, wifiMode, ssid, password), PAIR_TIMEOUT_MS));
    } catch (e) {
      finishError(e);
    }
  };

  // "Go to home": lưu tên (nếu đổi) + connect + về Device List (list refetch lúc remount — AC4).
  const done = async () => {
    if (!result) {
      navigate('device-list', { homeId });
      return;
    }
    setSaving(true);
    try {
      const name = deviceName.trim();
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
    navigate('device-list', { homeId });
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

  // Vòng tròn lớn giữa màn (searching/connecting/paired).
  const bigCircle = (inner: ReactNode, ringColor: string) => (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 200,
          height: 200,
          borderRadius: 100,
          borderWidth: 1,
          borderColor: C.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            borderWidth: 1.5,
            borderColor: ringColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {inner}
        </View>
      </View>
    </View>
  );

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
      <SafeAreaView style={{ flex: 1 }}>
        {/* Back về Device List (chỉ ở màn tĩnh — đang search/connect thì không thoát ngang) */}
        {(step === 'intro' || step === 'found' || step === 'error') && (
          <Pressable
            onPress={() => navigate('device-list', { homeId })}
            hitSlop={12}
            style={{ paddingHorizontal: 28, paddingTop: 20 }}
          >
            <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
          </Pressable>
        )}

        <ScrollView
          contentContainerStyle={{ padding: 28, flexGrow: 1, justifyContent: step === 'intro' || step === 'found' || step === 'error' ? 'flex-start' : 'center' }}
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
                    Make sure your phone and Walrus are on the same network before searching.
                  </Text>
                </View>
              </View>

              {/* Tuya cần Wi-Fi credentials để thiết bị join mạng — design không có, giữ + style design */}
              {field('WI-FI NAME (2.4GHZ)', ssid, setSsid, 'HomeNetwork')}
              {field('WI-FI PASSWORD', password, setPassword, 'Your Wi-Fi password', true)}

              <View style={{ height: 6 }} />
              <PrimaryButton label="Search for device" onPress={startSearch} disabled={ssid.trim().length === 0} />
              <View style={{ height: 6 }} />

              {/* Fallback Wi-Fi EZ/AP (giữ tính năng cũ, thu gọn) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 }}>
                <Pressable onPress={runWifi} hitSlop={8} disabled={ssid.trim().length === 0}>
                  <Text style={{ fontFamily: F.body, color: ssid.trim() ? C.ochre : C.muted, fontSize: 13 }}>
                    Pair via Wi-Fi ({wifiMode})
                  </Text>
                </Pressable>
                <Pressable onPress={() => setWifiMode((m) => (m === 'EZ' ? 'AP' : 'EZ'))} hitSlop={8}>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>⇄</Text>
                </Pressable>
              </View>

              <View style={{ alignItems: 'center', marginTop: 16 }}>
                <Pressable onPress={() => navigate('device-list', { homeId })} hitSlop={8}>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>Skip for now</Text>
                </Pressable>
              </View>
            </>
          )}

          {step === 'searching' && (
            <View style={{ alignItems: 'center' }}>
              {bigCircle(<Text style={{ fontSize: 30 }}>📡</Text>, C.ochre)}
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 26, marginTop: 32 }}>
                Searching…
              </Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 10 }}>
                Looking for Walrus devices{'\n'}on your network
              </Text>
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
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  borderWidth: 1.5,
                  borderColor: C.ochre,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ActivityIndicator color={C.ochre} />
              </View>
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 26, marginTop: 24 }}>
                Connecting…
              </Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, marginTop: 6 }}>
                {(found?.name || result?.name || 'Walrus Ice Bath') + ''}
              </Text>

              {/* Checklist 3 bước (design màn 4) — nhích theo tiến trình pairing thật */}
              <View style={{ alignSelf: 'stretch', marginTop: 36, paddingHorizontal: 12 }}>
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
    </View>
  );
}
