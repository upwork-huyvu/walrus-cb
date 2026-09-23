import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StatusBar, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import type { AppState } from '../state/useAppState';
import type { Navigate } from '../navigation';
import RenameDeviceModal from '../components/RenameDeviceModal';
import { DEVICE_NAME_MAX_LENGTH, readDeviceRaw, removeDeviceOrConfirmAbsent, renameDevice } from '../services/tuya';
import { EMPTY_DEVICE_INFO, parseDeviceInfo, type DeviceInfo } from '../services/deviceInfo';
import { describeTuyaError } from '../services/tuyaError';
import { cleanupRemovedDeviceReminder } from '../services/reminders';

type Props = {
  state: AppState;
  navigate: Navigate;
  goBack: () => void;
  devId?: string;
  devName?: string;
  userUid?: string;
  homeId?: number;
  onDeviceRemoved?: (devId: string) => Promise<void> | void;
  onDeviceRenamed?: (devId: string, name: string) => void;
};

// Màn quản lý 1 thiết bị: thông tin + đổi tên + xoá. Mở từ nút `⋮` của Device Detail (trước đây là
// Alert 2 lựa chọn - không có chỗ hiện thông tin). Mọi thao tác quản lý thiết bị gom về đây, màn điều
// khiển chỉ còn điều khiển.
export default function DeviceSettingsScreen({
  state,
  navigate,
  goBack,
  devId,
  devName,
  userUid,
  homeId,
  onDeviceRemoved,
  onDeviceRenamed,
}: Props) {
  const C = useTheme();
  const id = devId || state.devId;

  const [info, setInfo] = useState<DeviceInfo>(EMPTY_DEVICE_INFO);
  const [loading, setLoading] = useState(true);
  const [infoError, setInfoError] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState('');
  const [removing, setRemoving] = useState(false);
  // Tên vừa đổi: App cập nhật `devName` ở lượt render sau, không giữ local thì tiêu đề nháy về tên cũ.
  const [renamedName, setRenamedName] = useState('');

  const name = renamedName || devName || info.name || 'Walrus';

  const loadInfo = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setInfoError('');
    try {
      setInfo(parseDeviceInfo(await readDeviceRaw(id)));
    } catch (e) {
      // Không đọc được thì vẫn hiện tên + các hành động; chỉ phần thông tin là trống.
      setInfoError(describeTuyaError(e, { fallback: 'Could not read this device.' }).message);
      setInfo(EMPTY_DEVICE_INFO);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setRenamedName('');
    void loadInfo();
  }, [loadInfo]);

  /** Đổi tên đi thẳng qua Tuya → Smart Life + admin web thấy tên mới, không chỉ đổi nhãn trong app. */
  const runRename = async (input: string) => {
    if (!id || renaming) return;
    setRenaming(true);
    setRenameError('');
    try {
      const saved = await renameDevice(id, input);
      setRenamedName(saved);
      onDeviceRenamed?.(id, saved);
      setRenameOpen(false);
    } catch (e) {
      // Giữ modal MỞ kèm message thật để người dùng sửa/thử lại - chưa lưu được thì đừng đổi UI.
      setRenameError(describeTuyaError(e, {
        fallback: 'Could not rename this device. Check your connection and try again.',
      }).message);
    } finally {
      setRenaming(false);
    }
  };

  const runRemove = async () => {
    if (!id || removing) return;
    setRemoving(true);
    try {
      await removeDeviceOrConfirmAbsent(id, homeId);
      // Dọn metadata KHÔNG chặn thành công của Tuya; lỗi backend được queue để retry lần sau.
      await cleanupRemovedDeviceReminder(id, userUid ?? '');
      if (onDeviceRemoved) await onDeviceRemoved(id);
      else {
        await state.forgetDevice(id);
        navigate('device-list');
      }
    } catch (e) {
      Alert.alert(
        'Could not remove device',
        describeTuyaError(e, { fallback: 'Could not remove this device. Check your connection and try again.' })
          .message,
        [{ text: 'OK' }],
      );
    } finally {
      setRemoving(false);
    }
  };

  const confirmRemove = () => {
    if (removing) return;
    Alert.alert(
      'Remove device?',
      `${name} will be removed from your Walrus account and Tuya Home. You will need to pair it again to use it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => void runRemove() },
      ],
    );
  };

  const statusLabel = (): string => {
    if (info.online != null) return info.online ? 'Online' : 'Offline';
    return state.connStatus === 'online' ? 'Online' : 'Offline';
  };
  const isOnline = info.online ?? state.connStatus === 'online';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        {/* ── Header ── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            marginTop: 14,
            marginBottom: 18,
          }}
        >
          <Pressable onPress={goBack} hitSlop={14} style={{ width: 40 }} testID="settings-back">
            <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 30, lineHeight: 34 }}>‹</Text>
          </Pressable>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3 }}>
            DEVICE SETTINGS
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}>
          {/* ── Tên + trạng thái ── */}
          <View
            style={{
              borderWidth: 1,
              borderColor: C.border,
              backgroundColor: 'rgba(245,236,215,0.03)',
              borderRadius: 20,
              padding: 20,
            }}
          >
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2 }}>NAME</Text>
            <Text numberOfLines={2} style={{ fontFamily: F.headline, color: C.white, fontSize: 24, marginTop: 6 }}>
              {name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <View
                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isOnline ? '#4CAF50' : C.muted }}
              />
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, letterSpacing: 1 }}>
                {statusLabel().toUpperCase()}
              </Text>
            </View>

            <Pressable
              testID="settings-rename"
              onPress={() => {
                setRenameError('');
                setRenameOpen(true);
              }}
              disabled={!id || removing}
              style={{
                marginTop: 18,
                borderWidth: 1,
                borderColor: C.ochre,
                borderRadius: 14,
                paddingVertical: 13,
                alignItems: 'center',
                backgroundColor: 'rgba(196,135,58,0.08)',
                opacity: !id || removing ? 0.5 : 1,
              }}
            >
              <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 14, letterSpacing: 0.5 }}>
                Rename device
              </Text>
            </Pressable>
          </View>

          {/* ── Thông tin ── */}
          <Text
            style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginTop: 28, marginBottom: 12 }}
          >
            INFORMATION
          </Text>
          <View
            style={{
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 20,
              paddingHorizontal: 20,
              paddingVertical: 4,
            }}
          >
            {loading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator color={C.ochre} />
              </View>
            ) : info.rows.length === 0 ? (
              <View style={{ paddingVertical: 20 }}>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, textAlign: 'center' }}>
                  {infoError || 'No details available for this device.'}
                </Text>
                <Pressable onPress={() => void loadInfo()} hitSlop={10} style={{ marginTop: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 12, letterSpacing: 1 }}>RETRY</Text>
                </Pressable>
              </View>
            ) : (
              info.rows.map((row, i) => (
                <View
                  key={row.label}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    paddingVertical: 14,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: C.border,
                  }}
                >
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>{row.label}</Text>
                  <Text
                    numberOfLines={1}
                    style={{ fontFamily: F.body, color: C.white, fontSize: 13, flexShrink: 1, textAlign: 'right' }}
                  >
                    {row.value}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* ── Xoá thiết bị (luôn hỏi xác nhận) ── */}
          <Pressable
            testID="settings-remove"
            onPress={confirmRemove}
            disabled={!id || removing}
            style={{
              marginTop: 28,
              borderWidth: 1,
              borderColor: '#D9534F',
              borderRadius: 999,
              paddingVertical: 16,
              alignItems: 'center',
              opacity: !id || removing ? 0.6 : 1,
            }}
          >
            {removing ? (
              <ActivityIndicator size="small" color="#D9534F" />
            ) : (
              <Text style={{ fontFamily: F.body, color: '#D9534F', fontSize: 14, letterSpacing: 0.5 }}>
                Remove device
              </Text>
            )}
          </Pressable>
          <Text
            style={{ fontFamily: F.body, color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 10 }}
          >
            Removing unpairs the tub from your account. You can pair it again later.
          </Text>
        </ScrollView>

        <RenameDeviceModal
          visible={renameOpen}
          initialName={name}
          maxLength={DEVICE_NAME_MAX_LENGTH}
          saving={renaming}
          error={renameError}
          onCancel={() => {
            if (renaming) return; // đang gọi Tuya → không cho đóng nửa chừng
            setRenameOpen(false);
            setRenameError('');
          }}
          onSubmit={(next) => void runRename(next)}
        />
      </SafeAreaView>
    </View>
  );
}
