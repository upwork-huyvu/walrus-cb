import { useState } from 'react';
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
import type { AuthUser } from '../services/auth';
import { sendEmailCode, resetPassword, describeError } from '../services/auth';
import CountryPicker from '../components/CountryPicker';
import { DEFAULT_COUNTRY_CODE } from '../config/countries';

type Props = {
  navigate: Navigate;
  state: AppState;
  user: AuthUser | null;
  onSignOut: () => void;
};

// Account → Change password. Tuya App SDK chỉ hỗ trợ RESET qua OTP email (không có đổi bằng
// password cũ khi đang login - verify spec NativeTuyaAuth). Google/Apple: provider quản lý password.
// Flow: SEND CODE (type 3 = reset) → code + new password → resetPassword → sign out để login lại.
export default function ChangePasswordScreen({ navigate, state, user, onSignOut }: Props) {
  const C = useTheme();
  const [email, setEmail] = useState(user?.email ?? '');
  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const emailValid = email.includes('@') && email.includes('.');
  const canSubmit = emailValid && code.length > 0 && password.length >= 8 && confirm === password && !busy;

  const doSendCode = async () => {
    setBusy(true);
    setErr('');
    try {
      await sendEmailCode(email, country, 3); // type 3 = reset password
      setCodeSent(true);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setErr('');
    try {
      await resetPassword(country, email, code, password);
      setDone(true);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const field = (
    label: string,
    value: string,
    onChange: (s: string) => void,
    placeholder: string,
    opts: {
      secure?: boolean;
      keyboard?: 'email-address' | 'number-pad';
      accessory?: { label: string; onPress: () => void; disabled?: boolean };
    } = {},
  ) => (
    <View style={{ marginBottom: 26 }}>
      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 10 }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: C.border,
          paddingBottom: 10,
          gap: 12,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
          secureTextEntry={opts.secure}
          keyboardType={opts.keyboard}
          autoCapitalize="none"
          editable={!busy}
          style={{ fontFamily: F.body, color: C.white, fontSize: 16, padding: 0, flex: 1 }}
        />
        {opts.accessory ? (
          <Pressable onPress={opts.accessory.onPress} disabled={opts.accessory.disabled} hitSlop={8}>
            <Text
              style={{
                fontFamily: F.body,
                color: opts.accessory.disabled ? C.muted : C.ochre,
                fontSize: 11,
                letterSpacing: 2,
              }}
            >
              {opts.accessory.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  // Đổi xong → bắt đăng nhập lại bằng password mới (phiên cũ có thể bị Tuya kick sau reset).
  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              borderWidth: 1.5,
              borderColor: C.ochre,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            <Text style={{ color: C.ochre, fontSize: 30 }}>✓</Text>
          </View>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 26, marginBottom: 8 }}>
            Password changed.
          </Text>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, textAlign: 'center', marginBottom: 30 }}>
            Sign in again with your new password.
          </Text>
          <Pressable
            onPress={onSignOut}
            style={{ backgroundColor: C.ochre, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 48 }}
          >
            <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15 }}>Sign in again</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginTop: 24, marginBottom: 16, gap: 14 }}>
          <Pressable onPress={() => navigate('profile')} hitSlop={12}>
            <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
          </Pressable>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 22 }}>Change password</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          {/* Google/Apple: password do provider quản lý */}
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
            <Text style={{ fontSize: 16 }}>🔒</Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, lineHeight: 18, flex: 1 }}>
              If you signed in with Google or Apple, your password is managed by that provider. The
              form below applies to Walrus email accounts only.
            </Text>
          </View>

          {field('EMAIL', email, setEmail, 'hello@you.com', { keyboard: 'email-address' })}
          <CountryPicker value={country} onChange={setCountry} disabled={busy} />
          {field('VERIFICATION CODE', code, setCode, 'Code from email', {
            keyboard: 'number-pad',
            accessory: {
              label: codeSent ? 'RESEND' : 'SEND CODE',
              onPress: () => void doSendCode(),
              disabled: busy || !emailValid,
            },
          })}
          {field('NEW PASSWORD', password, setPassword, 'Min. 8 characters', {
            secure: !showPass,
            accessory: { label: showPass ? 'HIDE' : 'SHOW', onPress: () => setShowPass((s) => !s) },
          })}
          {field('CONFIRM NEW PASSWORD', confirm, setConfirm, 'Re-enter new password', { secure: !showPass })}

          {err ? (
            <Text style={{ fontFamily: F.body, color: '#e06c5a', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
              {err}
            </Text>
          ) : null}

          {busy ? (
            <ActivityIndicator color={C.ochre} style={{ marginVertical: 18 }} />
          ) : (
            <Pressable
              onPress={() => void submit()}
              disabled={!canSubmit}
              style={{
                backgroundColor: C.ochre,
                borderRadius: 14,
                paddingVertical: 18,
                alignItems: 'center',
                opacity: canSubmit ? 1 : 0.5,
              }}
            >
              <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15 }}>Change password</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
