import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { F, useTheme } from '../theme';

type Props = {
  visible: boolean;
  /** Tên đang hiển thị - nạp vào ô lúc mở (mỗi lần mở lại đều reset về tên hiện tại). */
  initialName: string;
  maxLength: number;
  saving: boolean;
  /** Lỗi từ SDK/Tuya - giữ modal MỞ để người dùng sửa & thử lại, không nuốt message. */
  error: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
};

// Dialog đổi tên thiết bị. Vì sao không dùng Alert.prompt: prompt CHỈ có trên iOS - Android sẽ không
// hiện ô nhập nào cả. Modal tự dựng nên chạy đồng nhất 2 nền tảng + theme được như phần còn lại của app.
export default function RenameDeviceModal({
  visible,
  initialName,
  maxLength,
  saving,
  error,
  onCancel,
  onSubmit,
}: Props) {
  const C = useTheme();
  const [value, setValue] = useState(initialName);

  // Mở lại → luôn bắt đầu từ tên HIỆN TẠI (không giữ bản nháp của lần huỷ trước).
  useEffect(() => {
    if (visible) setValue(initialName);
  }, [visible, initialName]);

  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && !saving;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Chạm ra ngoài = huỷ (khi không đang lưu) - quen thuộc như dialog hệ thống. */}
        <Pressable
          onPress={saving ? undefined : onCancel}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 28,
          }}
        >
          {/* Chặn sự kiện chạm lọt xuống lớp nền → bấm trong card không đóng modal. */}
          <Pressable
            onPress={() => {}}
            style={{
              width: '100%',
              backgroundColor: C.bg,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: C.border,
              padding: 22,
            }}
          >
            <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 20, marginBottom: 6 }}>
              Rename device
            </Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, lineHeight: 18, marginBottom: 18 }}>
              The new name is saved to your Tuya account, so it also changes in Smart Life and on your
              other phones.
            </Text>

            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 8 }}>
              DEVICE NAME
            </Text>
            <TextInput
              testID="rename-input"
              value={value}
              onChangeText={setValue}
              editable={!saving}
              autoFocus
              selectTextOnFocus
              maxLength={maxLength}
              placeholder="Walrus Ice Bath"
              placeholderTextColor={C.muted}
              returnKeyType="done"
              onSubmitEditing={() => canSave && onSubmit(trimmed)}
              style={{
                borderBottomWidth: 1,
                borderBottomColor: C.border,
                paddingBottom: 10,
                color: C.white,
                fontFamily: F.body,
                fontSize: 16,
              }}
            />
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, marginTop: 8, textAlign: 'right' }}>
              {trimmed.length}/{maxLength}
            </Text>

            {error ? (
              <Text style={{ fontFamily: F.body, color: '#E5484D', fontSize: 12, lineHeight: 18, marginTop: 6 }}>
                {error}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 20 }}>
              <Pressable
                onPress={onCancel}
                disabled={saving}
                hitSlop={8}
                style={{ paddingVertical: 12, paddingHorizontal: 18, opacity: saving ? 0.5 : 1 }}
              >
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, letterSpacing: 0.5 }}>Cancel</Text>
              </Pressable>
              <Pressable
                testID="rename-save"
                onPress={() => canSave && onSubmit(trimmed)}
                disabled={!canSave}
                style={{
                  backgroundColor: C.ochre,
                  borderRadius: 22,
                  paddingVertical: 12,
                  paddingHorizontal: 26,
                  minWidth: 96,
                  alignItems: 'center',
                  opacity: canSave ? 1 : 0.5,
                }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={C.white} />
                ) : (
                  <Text style={{ fontFamily: F.body, color: C.white, fontSize: 14, letterSpacing: 0.5 }}>Save</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
