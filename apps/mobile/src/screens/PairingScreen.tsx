import { useEffect, useRef, useState } from 'react';
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

type Step = 'choose' | 'scanning' | 'progress' | 'naming' | 'error';
type WifiMode = 'EZ' | 'AP';
type Props = { navigate: Navigate; state: AppState; homeId?: number };

// Guard timeout phía JS: nếu native không bao giờ resolve/reject → reject sau ms (audit M-5).
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Pairing timed out — thử lại')), ms),
    ),
  ]);
}
const PAIR_TIMEOUT_MS = 130_000;

export default function PairingScreen({ navigate, state, homeId }: Props) {
  const C = useTheme();
  // homeId tường minh từ Device List (đã qua home-gate). Fallback ensureHome chỉ khi vào pairing trực tiếp.
  const resolveHomeId = async () => homeId ?? (await ensureHome());
  const [step, setStep] = useState<Step>('choose');
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [wifiMode, setWifiMode] = useState<WifiMode>('EZ'); // EZ mặc định; AP = fallback khi EZ fail
  const [bleItems, setBleItems] = useState<BleScanItem[]>([]);
  const [progressStep, setProgressStep] = useState('');
  const [result, setResult] = useState<PairedDevice | null>(null);
  const [errMsg, setErrMsg] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [saving, setSaving] = useState(false);
  const subs = useRef<Subscription[]>([]);

  useEffect(() => {
    subs.current = [
      onPairingProgress((e) => setProgressStep(e.step)),
      onBleScan((e) =>
        setBleItems((prev) => (prev.some((x) => x.uuid === e.uuid) ? prev : [...prev, e])),
      ),
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
    setStep('naming'); // chuẩn SmartLife: kết nối OK → đặt tên trước khi hoàn tất
  };
  const finishError = (e: unknown) => {
    setErrMsg(describeError(e));
    setStep('error');
  };

  const runWifi = async () => {
    setStep('progress');
    setProgressStep(`starting (${wifiMode})`);
    try {
      const hid = await resolveHomeId();
      finishSuccess(await withTimeout(pairWifi(hid, wifiMode, ssid, password), PAIR_TIMEOUT_MS));
    } catch (e) {
      finishError(e);
    }
  };

  const startScan = () => {
    setBleItems([]);
    setStep('scanning');
    startBleScan(60);
  };

  const pickBle = async (item: BleScanItem) => {
    stopBleScan();
    setStep('progress');
    setProgressStep('connecting');
    try {
      const hid = await resolveHomeId();
      finishSuccess(await withTimeout(pairBleWifi(hid, item.uuid, ssid, password), PAIR_TIMEOUT_MS));
    } catch (e) {
      finishError(e);
    }
  };

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
      // Đặt tên lỗi không nên chặn hoàn tất — thiết bị đã pair; user đổi tên lại ở detail sau. Nhưng vẫn log (audit L-2).
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[pairing] renameDevice failed', describeError(e));
      }
    }
    await state.connectDevice(result.devId);
    setSaving(false);
    // Pair xong → quay về Device List (thiết bị mới sẽ xuất hiện khi list refetch lúc remount) (AC4).
    navigate('device-list', { homeId });
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.white,
    fontFamily: F.body,
    fontSize: 15,
    marginBottom: 12,
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 32, flexGrow: 1, justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 32, marginBottom: 24 }}>
            Pair your Walrus
          </Text>

          {step === 'choose' && (
            <>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, marginBottom: 4 }}>
                Wi-Fi (2.4GHz)
              </Text>
              <TextInput
                style={inputStyle}
                value={ssid}
                onChangeText={setSsid}
                placeholder="SSID"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
              />
              <TextInput
                style={inputStyle}
                value={password}
                onChangeText={setPassword}
                placeholder="Wi-Fi password"
                placeholderTextColor={C.muted}
                secureTextEntry
                autoCapitalize="none"
              />
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                {(['EZ', 'AP'] as WifiMode[]).map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setWifiMode(m)}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: wifiMode === m ? C.ochre : C.border,
                      borderRadius: 10,
                      paddingVertical: 10,
                      alignItems: 'center',
                      backgroundColor: wifiMode === m ? 'rgba(196,135,58,0.08)' : 'transparent',
                    }}
                  >
                    <Text style={{ fontFamily: F.body, color: wifiMode === m ? C.ochre : C.muted, fontSize: 13 }}>
                      {m === 'EZ' ? 'EZ (nhanh)' : 'AP (fallback)'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ height: 8 }} />
              <PrimaryButton label={`Pair via Wi-Fi (${wifiMode})`} onPress={runWifi} />
              <View style={{ height: 10 }} />
              <GhostButton label="Pair via Bluetooth" onPress={startScan} />
              <View style={{ height: 10 }} />
              <GhostButton label="Skip for now" onPress={() => navigate('device-list', { homeId })} />
            </>
          )}

          {step === 'scanning' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <ActivityIndicator color={C.ochre} />
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, marginLeft: 10 }}>
                  Scanning for devices…
                </Text>
              </View>
              {bleItems.map((it) => (
                <Pressable
                  key={it.uuid}
                  onPress={() => pickBle(it)}
                  style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16, marginBottom: 10 }}
                >
                  <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 16 }}>{it.name || it.uuid}</Text>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12 }}>{it.mac}</Text>
                </Pressable>
              ))}
              <View style={{ height: 12 }} />
              <GhostButton label="Cancel" onPress={() => { stopBleScan(); setStep('choose'); }} />
            </>
          )}

          {step === 'progress' && (
            <View style={{ alignItems: 'center' }}>
              <ActivityIndicator size="large" color={C.ochre} />
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 16, marginTop: 20 }}>
                {pairingStepLabel(progressStep)}
              </Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                Giữ thiết bị gần điện thoại và trong tầm Wi-Fi. Việc này có thể mất tới 2 phút.
              </Text>
            </View>
          )}

          {step === 'naming' && (
            <>
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 22, marginBottom: 6 }}>
                Đã kết nối ✓
              </Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, marginBottom: 20 }}>
                Đặt tên cho thiết bị của bạn để dễ nhận biết trong danh sách.
              </Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, marginBottom: 6 }}>Tên thiết bị</Text>
              <TextInput
                style={inputStyle}
                value={deviceName}
                onChangeText={setDeviceName}
                placeholder="Ví dụ: Bồn tắm phòng khách"
                placeholderTextColor={C.muted}
                editable={!saving}
                returnKeyType="done"
                onSubmitEditing={done}
              />
              <View style={{ height: 8 }} />
              {saving ? (
                <ActivityIndicator color={C.ochre} />
              ) : (
                <PrimaryButton label="Hoàn tất" onPress={done} disabled={deviceName.trim().length === 0} />
              )}
            </>
          )}

          {step === 'error' && (
            <>
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 20, marginBottom: 8 }}>
                Pairing failed
              </Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, marginBottom: 24 }}>
                {errMsg}
              </Text>
              <PrimaryButton label="Try again" onPress={() => setStep('choose')} />
              <View style={{ height: 10 }} />
              <GhostButton label="Back" onPress={() => navigate('device-list', { homeId })} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
