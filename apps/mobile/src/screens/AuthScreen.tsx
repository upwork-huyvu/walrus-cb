import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate } from '../navigation';
import PrimaryButton from '../components/PrimaryButton';
import {
  loginEmail,
  registerEmail,
  sendEmailCode,
  thirdLogin,
  describeError,
  type AuthUser,
} from '../services/auth';
import { signInGoogle } from '../services/googleAuth';
import { signInApple } from '../services/appleAuth';

type Mode = 'login' | 'register';
type Props = { navigate: Navigate; onAuthed: (u: AuthUser) => void };

export default function AuthScreen({ navigate, onAuthed }: Props) {
  const C = useTheme();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('49');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const emailValid = email.includes('@') && email.includes('.');
  const canLogin = emailValid && password.length >= 6;
  const canRegister = canLogin && code.length > 0;

  const succeed = (u: AuthUser) => {
    onAuthed(u);
    // Chuẩn Tuya SmartLife: sau login qua home-gate (chưa có nhà → Create Home; có → Device List).
    navigate('home-gate');
  };

  const run = async (fn: () => Promise<AuthUser>) => {
    setBusy(true);
    setError('');
    try {
      succeed(await fn());
    } catch (e: any) {
      // Google/AppleSignInError có message tiếng Việt sẵn → dùng thẳng (đừng đẩy qua TuyaErrors kẻo mangle).
      // 'CANCELLED' = user tự huỷ (đóng picker/sheet) → im lặng, không hiện lỗi.
      if (e?.name === 'GoogleSignInError' || e?.name === 'AppleSignInError') {
        if (e.code !== 'CANCELLED') setError(e.message);
      } else {
        setError(describeError(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const doSendCode = async () => {
    setBusy(true);
    setError('');
    try {
      await sendEmailCode(email, country, 1); // type 1 = register
      setCodeSent(true);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  // Lấy token THẬT từ native SDK rồi mới gọi Tuya thirdLogin (mock trả token/user giả trong Metro).
  const doThird = (type: 'gg' | 'ap') =>
    run(async () => {
      // countryCode dùng cho cả social login → Tuya suy ra data center từ đây.
      if (type === 'gg') return thirdLogin(await signInGoogle(), 'gg', undefined, country);
      // Apple: identityToken + profile (Apple chỉ trả email/fullName lần đầu) → extraInfo cho Tuya.
      const cred = await signInApple();
      return thirdLogin(
        cred.identityToken,
        'ap',
        {
          userIdentifier: cred.user,
          email: cred.email ?? undefined,
          nickname: cred.fullName ?? undefined,
          snsNickname: cred.fullName ?? undefined,
        },
        country,
      );
    });

  const input = (
    value: string,
    onChange: (s: string) => void,
    placeholder: string,
    opts: { secure?: boolean; keyboard?: 'email-address' | 'number-pad' } = {},
  ) => (
    <View style={{ borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 10, marginBottom: 22 }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        secureTextEntry={opts.secure}
        keyboardType={opts.keyboard}
        autoCapitalize="none"
        style={{ fontFamily: F.body, color: C.white, fontSize: 16, padding: 0 }}
      />
    </View>
  );

  const tab = (m: Mode, label: string) => (
    <Pressable onPress={() => { setMode(m); setError(''); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
      <Text style={{ fontFamily: F.body, color: mode === m ? C.ochre : C.muted, fontSize: 15, letterSpacing: 0.5 }}>
        {label}
      </Text>
      <View style={{ height: 2, width: 40, marginTop: 8, backgroundColor: mode === m ? C.ochre : 'transparent', borderRadius: 1 }} />
    </Pressable>
  );

  const social = (label: string, glyph: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 14,
        paddingVertical: 16,
        gap: 10,
        marginBottom: 12,
        backgroundColor: pressed ? 'rgba(245,236,215,0.05)' : 'transparent',
      })}
    >
      <Text style={{ fontSize: 16, color: C.white }}>{glyph}</Text>
      <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15, letterSpacing: 0.5 }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <Pressable onPress={() => navigate('onboard-welcome')} style={{ paddingHorizontal: 40, paddingTop: 24 }}>
          <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
        </Pressable>

        <View style={{ flex: 1, paddingHorizontal: 40, paddingTop: 24 }}>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 32, marginBottom: 28 }}>
            {mode === 'login' ? 'Welcome back.' : 'Create account.'}
          </Text>

          <View style={{ flexDirection: 'row', marginBottom: 28 }}>
            {tab('login', 'Sign in')}
            {tab('register', 'Register')}
          </View>

          {input(email, setEmail, 'hello@yourname.com', { keyboard: 'email-address' })}
          {input(password, setPassword, 'Password (≥ 6 chars)', { secure: true })}
          {/* Country code luôn hiện (áp cho CẢ email lẫn Google/Apple) — Tuya suy ra data center từ mã này */}
          {input(country, setCountry, 'Country code (e.g. 49)', { keyboard: 'number-pad' })}

          {mode === 'register' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 }}>
                <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 10 }}>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="Verification code"
                    placeholderTextColor={C.muted}
                    keyboardType="number-pad"
                    style={{ fontFamily: F.body, color: C.white, fontSize: 16, padding: 0 }}
                  />
                </View>
                <Pressable onPress={doSendCode} disabled={busy || !emailValid}>
                  <Text style={{ fontFamily: F.body, color: emailValid ? C.ochre : C.muted, fontSize: 13 }}>
                    {codeSent ? 'Resend' : 'Send code'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {error.length > 0 && (
            <Text style={{ fontFamily: F.body, color: '#e06c5a', fontSize: 13, marginBottom: 16 }}>{error}</Text>
          )}

          {busy ? (
            <ActivityIndicator color={C.ochre} style={{ marginVertical: 18 }} />
          ) : mode === 'login' ? (
            <PrimaryButton label="Sign in" onPress={() => canLogin && run(() => loginEmail(country, email, password))} />
          ) : (
            <PrimaryButton
              label="Create account"
              onPress={() => canRegister && run(() => registerEmail(country, email, password, code))}
            />
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, marginHorizontal: 12 }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
          </View>

          {social('Continue with Google', 'G', () => doThird('gg'))}
          {social('Continue with Apple', '', () => doThird('ap'))}
        </View>
      </SafeAreaView>
    </View>
  );
}
