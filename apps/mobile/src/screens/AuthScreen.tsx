import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate } from '../navigation';
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
import CountryPicker from '../components/CountryPicker';
import { GoogleLogo, AppleLogo } from '../components/BrandLogos';
import { DEFAULT_COUNTRY_CODE } from '../config/countries';
import { getIntroSeen } from '../state/introFlag';

// Màn auth theo design:
// - variant 'welcome'  (landing guest): "The ritual starts here." + Continue with Google/Apple/email.
// - variant 'signin'   (Welcome back.): Sign in with Google/Apple/email.
// - view 'register'    (Create your account.): email + password + confirm (+ code Tuya, design không có
//   nhưng Tuya bắt buộc → giữ, style theo design) + country dropdown.
// - view 'email-signin': email + password + country.
type Variant = 'welcome' | 'signin';
type ViewName = 'landing' | 'email-signin' | 'register';
type Props = { navigate: Navigate; onAuthed: (u: AuthUser) => void; variant?: Variant };

export default function AuthScreen({ navigate, onAuthed, variant = 'signin' }: Props) {
  const C = useTheme();
  const [view, setView] = useState<ViewName>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const emailValid = email.includes('@') && email.includes('.');
  const canSignIn = emailValid && password.length >= 6 && !busy;
  // Design: "Min. 8 characters" + confirm password. Code xác thực: Tuya bắt buộc khi đăng ký email.
  const canRegister =
    emailValid && password.length >= 8 && confirm === password && code.length > 0 && !busy;

  const succeed = async (u: AuthUser) => {
    onAuthed(u);
    // Lần đăng nhập ĐẦU TIÊN trên máy → show intro 4 slide; các lần sau → thẳng home-gate
    // (chưa có nhà → tự tạo "My Home" → Device List).
    navigate((await getIntroSeen()) ? 'home-gate' : 'intro');
  };

  const run = async (fn: () => Promise<AuthUser>) => {
    setBusy(true);
    setError('');
    try {
      await succeed(await fn());
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
  // countryCode dùng cho cả social login → Tuya suy data center từ đây (xem config/countries.ts).
  const doThird = (type: 'gg' | 'ap') =>
    run(async () => {
      if (type === 'gg') return thirdLogin(await signInGoogle(), 'gg', undefined, country);
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

  const switchView = (v: ViewName) => {
    setView(v);
    setError('');
  };

  // ---------- pieces theo design ----------

  // Field: label CAPS + input gạch chân + accessory phải (SHOW / SEND CODE).
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

  // Nút social theo design: Google nền trắng + logo G 4 màu, Apple nền đen + táo trắng, email viền.
  const socialButton = (
    label: string,
    icon: ReactNode,
    onPress: () => void,
    style: 'google' | 'apple' | 'outline',
  ) => (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        borderRadius: 14,
        paddingVertical: 16,
        marginBottom: 12,
        backgroundColor: style === 'google' ? '#FFFFFF' : style === 'apple' ? '#000000' : 'transparent',
        borderWidth: style === 'google' ? 0 : 1,
        borderColor: C.border,
        opacity: busy ? 0.6 : 1,
      }}
    >
      {icon}
      <Text
        style={{
          fontFamily: F.body,
          fontSize: 15,
          letterSpacing: 0.3,
          color: style === 'google' ? '#1C1712' : C.white,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );

  const footerLink = (question: string, action: string, onPress: () => void) => (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14 }}>
      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>{question}</Text>
      <Pressable onPress={onPress} hitSlop={8}>
        <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 13 }}>{action}</Text>
      </Pressable>
    </View>
  );

  const errorText = error ? (
    <Text style={{ fontFamily: F.body, color: '#e06c5a', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
      {error}
    </Text>
  ) : null;

  // Nút chính (Create account / Sign in) - pill ochre như design.
  const primary = (label: string, onPress: () => void, enabled: boolean) =>
    busy ? (
      <ActivityIndicator color={C.ochre} style={{ marginVertical: 18 }} />
    ) : (
      <Pressable
        onPress={onPress}
        disabled={!enabled}
        style={{
          backgroundColor: C.ochre,
          borderRadius: 14,
          paddingVertical: 18,
          alignItems: 'center',
          opacity: enabled ? 1 : 0.5,
        }}
      >
        <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15, letterSpacing: 0.3 }}>{label}</Text>
      </Pressable>
    );

  // ---------- views ----------

  // Landing (ảnh 1 & 3): headline giữa màn + khối nút social ở đáy.
  if (view === 'landing') {
    const isWelcome = variant === 'welcome';
    const verb = isWelcome ? 'Continue' : 'Sign in';
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 44 }}>
            <Text
              style={{
                fontFamily: F.headline,
                color: C.white,
                fontSize: 34,
                lineHeight: 44,
                textAlign: 'center',
                marginBottom: 16,
              }}
            >
              {isWelcome ? 'The ritual\nstarts here.' : 'Welcome\nback.'}
            </Text>
            <Text
              style={{ fontFamily: F.body, color: C.muted, fontSize: 14, lineHeight: 22, textAlign: 'center' }}
            >
              {isWelcome ? 'Cold. Breath. Presence.\nEvery day.' : 'Sign in to continue\nyour practice.'}
            </Text>
          </View>

          <View style={{ paddingHorizontal: 28, paddingBottom: 18 }}>
            {errorText}
            {socialButton(`${verb} with Google`, <GoogleLogo size={18} />, () => doThird('gg'), 'google')}
            {socialButton(`${verb} with Apple`, <AppleLogo size={18} />, () => doThird('ap'), 'apple')}

            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginHorizontal: 12 }}>
                OR
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
            </View>

            {socialButton(
              `${verb} with email`,
              null,
              () => switchView(isWelcome ? 'register' : 'email-signin'),
              'outline',
            )}

            {isWelcome
              ? footerLink('Already have an account?', 'Sign in', () => navigate('auth'))
              : footerLink("Don't have an account?", 'Sign up', () => switchView('register'))}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const isRegister = view === 'register';
  // Form (ảnh 2): back arrow + headline lớn + fields label CAPS + nút ochre + footer link.
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <Pressable onPress={() => switchView('landing')} hitSlop={12} style={{ paddingHorizontal: 28, paddingTop: 20 }}>
          <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
        </Pressable>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 32, lineHeight: 40, marginBottom: 8 }}>
            {isRegister ? 'Create your\naccount.' : 'Welcome\nback.'}
          </Text>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, marginBottom: 32 }}>
            {isRegister ? 'Start your cold practice today.' : 'Sign in to continue your practice.'}
          </Text>

          {field('EMAIL', email, setEmail, 'hello@you.com', { keyboard: 'email-address' })}
          {field('PASSWORD', password, setPassword, isRegister ? 'Min. 8 characters' : 'Your password', {
            secure: !showPass,
            accessory: { label: showPass ? 'HIDE' : 'SHOW', onPress: () => setShowPass((s) => !s) },
          })}
          {isRegister
            ? field('CONFIRM PASSWORD', confirm, setConfirm, 'Re-enter password', {
                secure: !showConfirm,
                accessory: { label: showConfirm ? 'HIDE' : 'SHOW', onPress: () => setShowConfirm((s) => !s) },
              })
            : null}

          <CountryPicker value={country} onChange={setCountry} disabled={busy} />

          {isRegister
            ? field('VERIFICATION CODE', code, setCode, 'Code from email', {
                keyboard: 'number-pad',
                accessory: {
                  label: codeSent ? 'RESEND' : 'SEND CODE',
                  onPress: doSendCode,
                  disabled: busy || !emailValid,
                },
              })
            : null}

          {errorText}

          <View style={{ height: 6 }} />
          {isRegister
            ? primary('Create account', () => canRegister && run(() => registerEmail(country, email, password, code)), canRegister)
            : primary('Sign in', () => canSignIn && run(() => loginEmail(country, email, password)), canSignIn)}

          {isRegister
            ? footerLink('Already have an account?', 'Sign in', () =>
                variant === 'welcome' ? navigate('auth') : switchView('email-signin'),
              )
            : footerLink("Don't have an account?", 'Sign up', () => switchView('register'))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
