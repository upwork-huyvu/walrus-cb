import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate } from '../navigation';
import type { AppState } from '../state/useAppState';
import {
  sdkAvailable,
  sdkGetSnapshot,
  sdkPublishDps,
  sdkListen,
  type Subscription,
} from '../services/deviceSdkTest';
import {
  resolveProfile,
  parseDps,
  formatDpValue,
  readWord0Hex,
  writeWord0Hex,
  type DpProp,
} from '../services/deviceProfile';

type Props = { navigate: Navigate; state: AppState; devId?: string };
type Snapshot = { dps: Record<string, unknown>; profile: DpProp[]; online?: boolean; raw?: unknown };
type ActionResult = { dpId: string; ok: boolean; error?: string };

// Màn TEST (dev): panel TỰ SINH theo schema thiết bị (getDeviceSnapshot). DP `ro` → chỉ SHOW trạng thái,
// DP `rw` → cho ĐIỀU KHIỂN (bool=toggle, raw=nhập hex/±nhiệt). Gọi thẳng App SDK - không Cloud/backend.
export default function DeviceTestScreen({ navigate, state, devId: devIdProp }: Props) {
  const C = useTheme();
  const [devId, setDevId] = useState(devIdProp || state.devId || '');
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busyDp, setBusyDp] = useState<string | null>(null);
  const [last, setLast] = useState<ActionResult | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({}); // input hex/số cho DP rw raw/value
  const [showRaw, setShowRaw] = useState(false);

  const [listening, setListening] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const subRef = useRef<Subscription | null>(null);
  useEffect(() => () => subRef.current?.remove(), []);

  const id = devId.trim();

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadErr(null);
    const r = await sdkGetSnapshot(id);
    if (!r.ok) {
      setLoadErr(r.error ?? 'Đọc snapshot lỗi');
      setSnap(null);
    } else {
      const s = (r.result ?? {}) as Record<string, any>;
      const dps = parseDps(s.dpsJson ?? '{}');
      const profile = resolveProfile(s.schemaJson ?? '');
      setSnap({ dps, profile, online: s.isOnline, raw: s });
      // seed input cho DP rw kiểu raw/value từ giá trị hiện tại
      const seed: Record<string, string> = {};
      for (const p of profile) {
        if (p.rw && (p.type === 'raw' || p.type === 'value')) {
          const v = dps[p.dpId];
          if (v !== undefined) seed[p.dpId] = String(v);
        }
      }
      setEdits((prev) => ({ ...seed, ...prev }));
    }
    setLoading(false);
  }, [id]);

  // Tự load lần đầu khi có devId.
  useEffect(() => {
    if (id) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publishDp = async (dpId: string, value: unknown) => {
    setBusyDp(dpId);
    setLast(null);
    const r = await sdkPublishDps(id, JSON.stringify({ [dpId]: value }));
    setLast({ dpId, ok: r.ok, error: r.error });
    setBusyDp(null);
    if (r.ok) setTimeout(() => void refresh(), 600); // đọc lại trạng thái thật sau khi gửi
  };

  const setRaw = (p: DpProp) => {
    const hex = (edits[p.dpId] ?? '').trim();
    if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
      setLast({ dpId: p.dpId, ok: false, error: 'Raw phải là hex chẵn chữ số' });
      return;
    }
    void publishDp(p.dpId, hex);
  };

  const setValue = (p: DpProp) => {
    const raw = Number((edits[p.dpId] ?? '').trim());
    if (isNaN(raw)) {
      setLast({ dpId: p.dpId, ok: false, error: 'Giá trị phải là số (raw, đã ×scale)' });
      return;
    }
    void publishDp(p.dpId, raw);
  };

  const bumpTempWord0 = (p: DpProp, deltaRaw: number) => {
    const hex = (edits[p.dpId] ?? String(snap?.dps[p.dpId] ?? '')).trim();
    const cur = readWord0Hex(hex);
    if (cur == null) {
      setLast({ dpId: p.dpId, ok: false, error: 'Không đọc được word0 (hex hiện tại rỗng?)' });
      return;
    }
    const next = writeWord0Hex(hex, cur + deltaRaw);
    if (next == null) return;
    setEdits((e) => ({ ...e, [p.dpId]: next }));
    void publishDp(p.dpId, next);
  };

  const toggleListen = () => {
    if (listening) {
      subRef.current?.remove();
      subRef.current = null;
      setListening(false);
      return;
    }
    setEvents([]);
    subRef.current = sdkListen(id, (e) => {
      let line: string;
      try {
        line = JSON.stringify(e);
      } catch {
        line = String(e);
      }
      setEvents((prev) => [line, ...prev].slice(0, 40));
    });
    setListening(true);
  };

  const roList = snap?.profile.filter((p) => !p.rw) ?? [];
  const rwList = snap?.profile.filter((p) => p.rw) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 12, marginBottom: 8 }}>
          <Pressable onPress={() => navigate('me')} hitSlop={14} style={{ width: 40 }}>
            <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28 }}>‹</Text>
          </Pressable>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 20 }}>Device SDK test</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          {!sdkAvailable && (
            <Text style={{ color: '#D98A3A', fontFamily: F.body, fontSize: 12, marginBottom: 12 }}>
              Native SDK vắng (Metro-only). Chạy bản build native để test.
            </Text>
          )}

          <TextInput
            value={devId}
            onChangeText={setDevId}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="devId"
            placeholderTextColor={C.muted}
            style={inputStyle(C)}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <Pressable disabled={!id || loading} onPress={() => void refresh()} style={[btnStyle(C, !id || loading), { backgroundColor: C.ochre }]}>
              {loading ? (
                <ActivityIndicator color={C.bg} size="small" />
              ) : (
                <Text style={{ fontFamily: F.body, color: C.bg, fontSize: 13, fontWeight: '600' }}>Load / Refresh</Text>
              )}
            </Pressable>
            {snap && (
              <Text style={{ fontFamily: F.body, color: snap.online ? '#3FB56B' : '#D98A3A', fontSize: 12 }}>
                {snap.online ? 'ONLINE' : 'OFFLINE'}
              </Text>
            )}
          </View>

          {loadErr && <Text style={{ color: '#D9534F', fontFamily: F.body, fontSize: 13, marginTop: 12 }}>{loadErr}</Text>}

          {snap && (
            <>
              {/* ── STATUS (ro) ── */}
              <Text style={sectionLabel(C)}>STATUS · read-only</Text>
              {roList.map((p) => (
                <View key={p.dpId} style={rowStyle(C)}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.body, color: C.white, fontSize: 14 }}>{p.name}</Text>
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11 }}>
                      {p.code} · dp{p.dpId} · {p.type}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'Courier', color: C.ochre, fontSize: 13, maxWidth: 150, textAlign: 'right' }}>
                    {formatDpValue(p, snap.dps[p.dpId])}
                  </Text>
                </View>
              ))}

              {/* ── CONTROLS (rw) ── */}
              <Text style={sectionLabel(C)}>CONTROLS · read-write</Text>
              {rwList.map((p) => (
                <View key={p.dpId} style={[rowStyle(C), { flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: F.body, color: C.white, fontSize: 14 }}>{p.name}</Text>
                      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11 }}>
                        {p.code} · dp{p.dpId} · {p.type} · now {formatDpValue(p, snap.dps[p.dpId])}
                      </Text>
                    </View>
                    {busyDp === p.dpId && <ActivityIndicator color={C.ochre} size="small" />}
                  </View>

                  {p.type === 'bool' ? (
                    <Pressable
                      disabled={busyDp != null}
                      onPress={() => publishDp(p.dpId, !(snap.dps[p.dpId] === true))}
                      style={[btnStyle(C, busyDp != null), { alignSelf: 'flex-start', backgroundColor: snap.dps[p.dpId] === true ? C.ochre : 'transparent' }]}
                    >
                      <Text style={{ fontFamily: F.body, color: snap.dps[p.dpId] === true ? C.bg : C.white, fontSize: 13 }}>
                        {snap.dps[p.dpId] === true ? 'ON → tap to turn OFF' : 'OFF → tap to turn ON'}
                      </Text>
                    </Pressable>
                  ) : p.type === 'value' ? (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TextInput
                        value={edits[p.dpId] ?? ''}
                        onChangeText={(t) => setEdits((e) => ({ ...e, [p.dpId]: t }))}
                        keyboardType="numbers-and-punctuation"
                        placeholder="raw (đã ×scale)"
                        placeholderTextColor={C.muted}
                        style={[inputStyle(C), { flex: 1 }]}
                      />
                      <Pressable disabled={busyDp != null} onPress={() => setValue(p)} style={btnStyle(C, busyDp != null)}>
                        <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13 }}>Set</Text>
                      </Pressable>
                    </View>
                  ) : (
                    // raw: nhập hex + Set; riêng setting_temp có ± nhiệt (word0, ±0.5°)
                    <View style={{ gap: 8 }}>
                      {p.code === 'setting_temp' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Pressable disabled={busyDp != null} onPress={() => bumpTempWord0(p, -5)} style={stepBtn(C, busyDp != null)}>
                            <Text style={{ color: C.white, fontSize: 20 }}>−</Text>
                          </Pressable>
                          <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 18, minWidth: 64, textAlign: 'center' }}>
                            {(() => {
                              const w = readWord0Hex(edits[p.dpId] ?? String(snap.dps[p.dpId] ?? ''));
                              return w == null ? '—' : `${w / 10}°C`;
                            })()}
                          </Text>
                          <Pressable disabled={busyDp != null} onPress={() => bumpTempWord0(p, 5)} style={stepBtn(C, busyDp != null)}>
                            <Text style={{ color: C.white, fontSize: 20 }}>+</Text>
                          </Pressable>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TextInput
                          value={edits[p.dpId] ?? ''}
                          onChangeText={(t) => setEdits((e) => ({ ...e, [p.dpId]: t }))}
                          autoCapitalize="none"
                          autoCorrect={false}
                          placeholder="hex (chẵn chữ số)"
                          placeholderTextColor={C.muted}
                          style={[inputStyle(C), { flex: 1, fontFamily: 'Courier', fontSize: 12 }]}
                        />
                        <Pressable disabled={busyDp != null} onPress={() => setRaw(p)} style={btnStyle(C, busyDp != null)}>
                          <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13 }}>Set</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              ))}

              {last && (
                <Text style={{ fontFamily: F.body, color: last.ok ? '#3FB56B' : '#D9534F', fontSize: 12, marginTop: 12 }}>
                  publishDps dp{last.dpId}: {last.ok ? 'ok (đã gửi)' : last.error}
                </Text>
              )}

              {/* ── Realtime ── */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12 }}>Realtime onDeviceStatus</Text>
                <Pressable disabled={!id} onPress={toggleListen} style={[btnStyle(C, !id), listening ? { backgroundColor: C.ochre } : null]}>
                  <Text style={{ fontFamily: F.body, color: listening ? C.bg : C.white, fontSize: 13 }}>{listening ? 'Stop' : 'Listen'}</Text>
                </Pressable>
              </View>
              {events.length > 0 && (
                <View style={[resultBox(C), { marginTop: 8 }]}>
                  {events.map((e, i) => (
                    <Text key={i} selectable style={{ fontFamily: 'Courier', color: C.white, fontSize: 11, marginBottom: 2 }}>
                      {e}
                    </Text>
                  ))}
                </View>
              )}

              {/* ── Raw snapshot ── */}
              <Pressable onPress={() => setShowRaw((v) => !v)} style={{ marginTop: 20 }}>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12 }}>
                  {showRaw ? '▾' : '▸'} Raw getDeviceSnapshot
                </Text>
              </Pressable>
              {showRaw && (
                <View style={[resultBox(C), { marginTop: 8 }]}>
                  <Text selectable style={{ fontFamily: 'Courier', color: C.white, fontSize: 11 }}>
                    {JSON.stringify(snap.raw, null, 2)}
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const inputStyle = (C: ReturnType<typeof useTheme>) => ({
  borderWidth: 1,
  borderColor: C.border,
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 10,
  color: C.white,
  fontFamily: F.body,
  fontSize: 14,
});

const btnStyle = (C: ReturnType<typeof useTheme>, disabled: boolean) => ({
  borderWidth: 1,
  borderColor: C.border,
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 10,
  opacity: disabled ? 0.4 : 1,
});

const stepBtn = (C: ReturnType<typeof useTheme>, disabled: boolean) => ({
  width: 44,
  height: 44,
  borderRadius: 22,
  borderWidth: 1,
  borderColor: C.border,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  opacity: disabled ? 0.4 : 1,
});

const sectionLabel = (C: ReturnType<typeof useTheme>) => ({
  fontFamily: F.body,
  color: C.muted,
  fontSize: 12,
  letterSpacing: 2,
  marginTop: 24,
  marginBottom: 8,
});

const rowStyle = (C: ReturnType<typeof useTheme>) => ({
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
  borderWidth: 1,
  borderColor: C.border,
  borderRadius: 12,
  padding: 14,
  marginBottom: 8,
});

const resultBox = (C: ReturnType<typeof useTheme>) => ({
  borderWidth: 1,
  borderColor: C.border,
  borderRadius: 10,
  backgroundColor: 'rgba(245,236,215,0.03)',
  padding: 12,
});
