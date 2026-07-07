import { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { F, ThemeToggleContext, useTheme } from '../theme';
import type { Navigate } from '../navigation';
import type { AppState } from '../state/useAppState';
import { describeError, type AuthUser, type LoginIdentityKind, type LoginIdentityMode } from '../services/auth';
import CountryPicker from '../components/CountryPicker';
import { countryName, DEFAULT_COUNTRY_CODE } from '../config/countries';

type Props = {
  navigate: Navigate;
  state: AppState;
  user: AuthUser | null;
  onRefreshUser: () => Promise<AuthUser | null>;
  onUpdateProfile: (input: { nickName?: string; tempUnit?: number; timezoneId?: string }) => Promise<AuthUser>;
  onSendIdentityCode: (kind: LoginIdentityKind, countryCode: string, value: string) => Promise<void>;
  onUpdateIdentity: (
    kind: LoginIdentityKind,
    mode: LoginIdentityMode,
    countryCode: string,
    value: string,
    code: string,
  ) => Promise<AuthUser>;
  onDeleteAccount: () => Promise<void>;
  onSignOut: () => void;
};

function tempUnitLabel(unit?: number): string {
  if (unit === 1) return 'Celsius';
  if (unit === 2) return 'Fahrenheit';
  return '';
}

// Me → Cấu hình thông tin: thông tin tài khoản Tuya, đổi tên hiển thị, xoá account.
export default function ProfileScreen({
  navigate,
  state,
  user,
  onRefreshUser,
  onUpdateProfile,
  onSendIdentityCode,
  onUpdateIdentity,
  onDeleteAccount,
  onSignOut,
}: Props) {
  const C = useTheme();
  const toggleTheme = useContext(ThemeToggleContext);
  const [name, setName] = useState(user?.nickName ?? '');
  const [tempUnit, setTempUnit] = useState(user?.tempUnit || 1);
  const [timezoneId, setTimezoneId] = useState(user?.timezoneId ?? '');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [identityKind, setIdentityKind] = useState<LoginIdentityKind>('email');
  const [identityCountry, setIdentityCountry] = useState(user?.countryCode || DEFAULT_COUNTRY_CODE);
  const [identityValue, setIdentityValue] = useState('');
  const [identityCode, setIdentityCode] = useState('');
  const [identityCodeSent, setIdentityCodeSent] = useState(false);
  const [identityBusy, setIdentityBusy] = useState(false);

  useEffect(() => {
    setName(user?.nickName ?? '');
    setTempUnit(user?.tempUnit || 1);
    setTimezoneId(user?.timezoneId ?? '');
    setIdentityCountry(user?.countryCode || DEFAULT_COUNTRY_CODE);
  }, [user?.nickName, user?.tempUnit, user?.timezoneId, user?.countryCode]);

  const cleanName = name.trim();
  const cleanTimezone = timezoneId.trim();
  const nameChanged = cleanName !== (user?.nickName ?? '');
  const tempUnitChanged = tempUnit !== (user?.tempUnit || 1);
  const timezoneChanged = cleanTimezone !== (user?.timezoneId ?? '');
  const canSave =
    cleanName.length > 0 &&
    cleanTimezone.length > 0 &&
    (nameChanged || tempUnitChanged || timezoneChanged) &&
    !busy;
  const canDelete = deleteText.trim().toUpperCase() === 'DELETE' && !deleting;
  const identityMode: LoginIdentityMode =
    identityKind === 'email'
      ? user?.email
        ? 'change'
        : 'bind'
      : user?.mobile
        ? 'change'
        : 'bind';
  const identityLabel = identityKind === 'email' ? 'email' : 'phone number';
  const canSendIdentityCode = identityValue.trim().length > 0 && identityCountry.trim().length > 0 && !identityBusy;
  const canSubmitIdentity =
    canSendIdentityCode && identityCode.trim().length > 0 && identityCodeSent && !identityBusy;

  const row = (label: string, value: string) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: C.border,
        gap: 12,
      }}
    >
      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>{label}</Text>
      <Text numberOfLines={1} style={{ fontFamily: F.body, color: C.white, fontSize: 14, flexShrink: 1 }}>
        {value || '-'}
      </Text>
    </View>
  );

  const sectionLabel = (label: string) => (
    <View style={{ paddingHorizontal: 18, paddingVertical: 16 }}>
      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>{label}</Text>
    </View>
  );

  const runRefresh = async () => {
    setRefreshing(true);
    setError('');
    setMessage('');
    try {
      await onRefreshUser();
      setMessage('Account information refreshed.');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setRefreshing(false);
    }
  };

  const deviceTimezone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
      return '';
    }
  };

  const saveProfile = async () => {
    if (!canSave) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const patch: { nickName?: string; tempUnit?: number; timezoneId?: string } = {};
      if (nameChanged) patch.nickName = cleanName;
      if (tempUnitChanged) patch.tempUnit = tempUnit;
      if (timezoneChanged) patch.timezoneId = cleanTimezone;
      await onUpdateProfile(patch);
      setMessage('Account profile updated.');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const sendIdentityCode = async () => {
    if (!canSendIdentityCode) return;
    setIdentityBusy(true);
    setError('');
    setMessage('');
    try {
      await onSendIdentityCode(identityKind, identityCountry.trim(), identityValue.trim());
      setIdentityCodeSent(true);
      setMessage(`Verification code sent to ${identityValue.trim()}.`);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setIdentityBusy(false);
    }
  };

  const submitIdentity = async () => {
    if (!canSubmitIdentity) return;
    setIdentityBusy(true);
    setError('');
    setMessage('');
    try {
      await onUpdateIdentity(
        identityKind,
        identityMode,
        identityCountry.trim(),
        identityValue.trim(),
        identityCode.trim(),
      );
      setIdentityValue('');
      setIdentityCode('');
      setIdentityCodeSent(false);
      setMessage(`${identityKind === 'email' ? 'Email' : 'Phone number'} updated.`);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setIdentityBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setError('');
    try {
      await onDeleteAccount();
    } catch (e) {
      setError(describeError(e));
      setDeleting(false);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: F.body,
    color: C.white,
    fontSize: 15,
  } as const;

  const actionButton = (
    label: string,
    onPress: () => void,
    disabled: boolean,
    tone: 'primary' | 'danger' | 'neutral' = 'primary',
  ) => {
    const borderColor = tone === 'danger' ? '#E5484D' : tone === 'primary' ? C.ochre : C.border;
    const color = disabled ? C.muted : tone === 'danger' ? '#E5484D' : tone === 'primary' ? C.ochre : C.white;
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={{
          borderWidth: 1,
          borderColor: disabled ? C.border : borderColor,
          borderRadius: 14,
          paddingVertical: 14,
          paddingHorizontal: 18,
          alignItems: 'center',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <Text style={{ fontFamily: F.body, color, fontSize: 13, letterSpacing: 0.8 }}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginTop: 24, marginBottom: 16, gap: 14 }}>
          <Pressable onPress={() => navigate('me')} hitSlop={12}>
            <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
          </Pressable>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 22 }}>Profile settings</Text>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
        >
          {(error || message) ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: error ? '#E5484D' : C.border,
                borderRadius: 14,
                padding: 14,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontFamily: F.body, color: error ? '#E5484D' : C.white, fontSize: 13, lineHeight: 19 }}>
                {error || message}
              </Text>
            </View>
          ) : null}

          {/* Thông tin tài khoản Tuya */}
          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 18, marginBottom: 20 }}>
            {sectionLabel('ACCOUNT')}
            {row('Display name', user?.nickName ?? '')}
            {row('Email', user?.email ?? '')}
            {row('Mobile', user?.mobile ?? '')}
            {row('Temperature unit', tempUnitLabel(user?.tempUnit))}
            {row('Timezone', user?.timezoneId ?? '')}
            {row('Country', user?.countryCode ? `${countryName(user.countryCode)} (+${user.countryCode})` : '')}
            {row('Region', user?.regionCode ?? '')}
            {row('Avatar URL', user?.headPic ?? '')}
            {row('UID', user?.uid ?? '')}
            <View style={{ padding: 18, borderTopWidth: 1, borderTopColor: C.border }}>
              {actionButton(
                refreshing ? 'REFRESHING...' : 'REFRESH FROM TUYA',
                runRefresh,
                refreshing,
                'neutral',
              )}
            </View>
          </View>

          {/* Chỉnh sửa thông tin cá nhân */}
          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 18, marginBottom: 20 }}>
            {sectionLabel('PERSONAL INFO')}
            <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: 12 }}>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>Display name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your display name"
                placeholderTextColor={C.muted}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={48}
                style={inputStyle}
              />

              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, marginTop: 6 }}>Temperature unit</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[
                  { label: 'Celsius', value: 1 },
                  { label: 'Fahrenheit', value: 2 },
                ].map((option) => {
                  const selected = tempUnit === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setTempUnit(option.value)}
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: selected ? C.ochre : C.border,
                        borderRadius: 12,
                        paddingVertical: 12,
                        alignItems: 'center',
                        backgroundColor: selected ? 'rgba(196,135,58,0.1)' : 'transparent',
                      }}
                    >
                      <Text style={{ fontFamily: F.body, color: selected ? C.ochre : C.white, fontSize: 13 }}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>Timezone</Text>
                {deviceTimezone() ? (
                  <Pressable onPress={() => setTimezoneId(deviceTimezone())} hitSlop={8}>
                    <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 12 }}>Use device</Text>
                  </Pressable>
                ) : null}
              </View>
              <TextInput
                value={timezoneId}
                onChangeText={setTimezoneId}
                placeholder="Europe/Berlin"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                autoCorrect={false}
                style={inputStyle}
              />
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, lineHeight: 17 }}>
                Use an IANA timezone ID, for example Europe/Berlin or Asia/Ho_Chi_Minh.
              </Text>

              {actionButton(busy ? 'SAVING...' : 'SAVE PROFILE', saveProfile, !canSave)}
            </View>
          </View>

          {/* Email / phone identity - Tuya yêu cầu OTP, không update trực tiếp. */}
          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 18, marginBottom: 20 }}>
            {sectionLabel('LOGIN IDENTITY')}
            <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: 12 }}>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 19 }}>
                Email and phone changes require a verification code sent to the new login identity.
              </Text>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[
                  { label: 'Email', value: 'email' as LoginIdentityKind },
                  { label: 'Phone', value: 'phone' as LoginIdentityKind },
                ].map((option) => {
                  const selected = identityKind === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        setIdentityKind(option.value);
                        setIdentityValue('');
                        setIdentityCode('');
                        setIdentityCodeSent(false);
                      }}
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: selected ? C.ochre : C.border,
                        borderRadius: 12,
                        paddingVertical: 12,
                        alignItems: 'center',
                        backgroundColor: selected ? 'rgba(196,135,58,0.1)' : 'transparent',
                      }}
                    >
                      <Text style={{ fontFamily: F.body, color: selected ? C.ochre : C.white, fontSize: 13 }}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12 }}>
                Current {identityLabel}: {identityKind === 'email' ? user?.email || 'not bound' : user?.mobile || 'not bound'}
              </Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12 }}>
                Action: {identityMode === 'change' ? 'change existing identity' : 'bind new identity'}
              </Text>

              <CountryPicker value={identityCountry} onChange={setIdentityCountry} disabled={identityBusy} />
              <TextInput
                value={identityValue}
                onChangeText={(next) => {
                  setIdentityValue(next);
                  setIdentityCodeSent(false);
                }}
                placeholder={identityKind === 'email' ? 'new@email.com' : 'phone number'}
                placeholderTextColor={C.muted}
                keyboardType={identityKind === 'email' ? 'email-address' : 'phone-pad'}
                autoCapitalize="none"
                autoCorrect={false}
                style={inputStyle}
              />
              {actionButton(identityBusy ? 'PLEASE WAIT...' : 'SEND CODE', sendIdentityCode, !canSendIdentityCode, 'neutral')}

              {identityCodeSent ? (
                <>
                  <TextInput
                    value={identityCode}
                    onChangeText={setIdentityCode}
                    placeholder="Verification code"
                    placeholderTextColor={C.muted}
                    keyboardType="number-pad"
                    autoCorrect={false}
                    style={inputStyle}
                  />
                  {actionButton(
                    identityBusy ? 'UPDATING...' : identityMode === 'change' ? 'CHANGE LOGIN IDENTITY' : 'BIND LOGIN IDENTITY',
                    submitIdentity,
                    !canSubmitIdentity,
                  )}
                </>
              ) : null}
            </View>
          </View>

          {/* Bảo mật: đổi password (Tuya reset-qua-OTP; Google/Apple do provider quản) */}
          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 18, marginBottom: 20 }}>
            <Pressable
              onPress={() => navigate('change-password')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 18,
                paddingVertical: 16,
              }}
            >
              <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15 }}>Change password</Text>
              <Text style={{ color: C.muted, fontSize: 16 }}>›</Text>
            </Pressable>
          </View>

          {/* Xoá tài khoản */}
          <View style={{ borderWidth: 1, borderColor: '#E5484D', borderRadius: 18, marginBottom: 20 }}>
            {sectionLabel('DELETE ACCOUNT')}
            <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: 12 }}>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 19 }}>
                Tuya starts account cancellation with a 7-day recovery window. Signing in again during that
                window cancels the deletion request.
              </Text>
              {!deleteOpen ? (
                actionButton('DELETE ACCOUNT', () => setDeleteOpen(true), deleting, 'danger')
              ) : (
                <>
                  <TextInput
                    value={deleteText}
                    onChangeText={setDeleteText}
                    placeholder="Type DELETE"
                    placeholderTextColor={C.muted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    style={inputStyle}
                  />
                  {actionButton(deleting ? 'DELETING...' : 'CONFIRM DELETE', deleteAccount, !canDelete, 'danger')}
                  {actionButton(
                    'CANCEL',
                    () => {
                      setDeleteOpen(false);
                      setDeleteText('');
                    },
                    deleting,
                    'neutral',
                  )}
                </>
              )}
            </View>
          </View>

          {/* Giao diện */}
          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 18, marginBottom: 28 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 18,
                paddingVertical: 14,
              }}
            >
              <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15 }}>Dark mode</Text>
              <Switch
                value={state.isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: C.border, true: C.ochre }}
                thumbColor={C.white}
              />
            </View>
          </View>

          {/* Đăng xuất */}
          <Pressable
            onPress={onSignOut}
            disabled={deleting}
            style={{
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            {deleting ? (
              <ActivityIndicator color="#E5484D" />
            ) : (
              <Text style={{ fontFamily: F.body, color: '#E5484D', fontSize: 14, letterSpacing: 0.5 }}>
                Sign out
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
