import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import {
  DARK_THEME,
  LIGHT_THEME,
  ThemeContext,
  ThemeToggleContext,
} from './src/theme';
import { useAppState, type AppState } from './src/state/useAppState';
import { LOGO_URI, LOGO_URI_LIGHT } from './src/lib/format';
import type { Navigate, ScreenName } from './src/navigation';
import SplashScreen from './src/screens/SplashScreen';
import HomeScreen from './src/screens/HomeScreen';
import BreathworkScreen from './src/screens/BreathworkScreen';
import SessionScreen from './src/screens/SessionScreen';
import CompletionScreen from './src/screens/CompletionScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import OnboardEmailScreen from './src/screens/onboarding/OnboardEmailScreen';
import OnboardNameScreen from './src/screens/onboarding/OnboardNameScreen';
import OnboardWhyScreen from './src/screens/onboarding/OnboardWhyScreen';
import OnboardExperienceScreen from './src/screens/onboarding/OnboardExperienceScreen';
import OnboardDeviceScreen from './src/screens/onboarding/OnboardDeviceScreen';
import PairingScreen from './src/screens/PairingScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import AuthScreen from './src/screens/AuthScreen';
import IntroScreen from './src/screens/IntroScreen';
import CreateHomeScreen from './src/screens/CreateHomeScreen';
import DeviceListScreen from './src/screens/DeviceListScreen';
import MeScreen from './src/screens/MeScreen';
import HomeManagementScreen from './src/screens/HomeManagementScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ReminderScreen from './src/screens/ReminderScreen';
import ShopScreen from './src/screens/ShopScreen';
import HelpScreen from './src/screens/HelpScreen';
import BottomTabBar, { type TabKey } from './src/components/BottomTabBar';
import { useAuth } from './src/state/useAuth';
import { onSessionExpired } from './src/services/auth';
import { initSdk } from './src/services/tuya';
import { configureGoogle } from './src/services/googleAuth';
import { ensureDefaultHome } from './src/services/home';
import { getIntroSeen } from './src/state/introFlag';

// Màn nào nằm trong bottom tab (Device/Reminder/Shop/Help/Account). Màn immersive không tab.
const TABBED: Partial<Record<ScreenName, TabKey>> = {
  'device-list': 'device',
  reminder: 'reminder',
  shop: 'shop',
  help: 'help',
  me: 'account',
  'home-management': 'account',
  notifications: 'account',
  profile: 'account',
};

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('splash');
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [userName, setUserName] = useState('');
  const [homeId, setHomeId] = useState<number | undefined>(undefined);
  const [homeName, setHomeName] = useState('');
  const [activeDevId, setActiveDevId] = useState('');
  const [gateError, setGateError] = useState('');
  const [gateNonce, setGateNonce] = useState(0);
  const [isDark, setIsDark] = useState(true);
  const toggleTheme = useCallback(() => setIsDark((d) => !d), []);
  const appState = useAppState();
  const theme = isDark ? DARK_THEME : LIGHT_THEME;
  // Bơm isDark vào state cho screens (replit đọc state.isDark).
  const state: AppState = { ...appState, isDark };

  const auth = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const routed = useRef(false);

  // 0) Init Tuya SDK MỘT lần trước mọi call auth/pairing (nếu không getUserInstance()=null → crash).
  // 1) Kiểm tra phiên lúc khởi động. 2) Phiên hết hạn (SDK kick) → về auth.
  useEffect(() => {
    void (async () => {
      await initSdk();
      configureGoogle(); // cấu hình Google Sign-In 1 lần (no-op nếu native chưa có / client id trống)
      auth.bootstrap();
    })();
    const sub = onSessionExpired(() => {
      auth.reset();
      setScreen('auth');
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sau splash + đã biết trạng thái → route MỘT lần:
  // guest → welcome; authed → intro (nếu là lần đăng nhập đầu, chưa xem) | home-gate.
  useEffect(() => {
    if (routed.current || !splashDone || auth.status === 'checking') return;
    routed.current = true;
    if (auth.status !== 'authed') {
      setScreen('onboard-welcome');
      return;
    }
    void (async () => {
      setScreen((await getIntroSeen()) ? 'home-gate' : 'intro');
    })();
  }, [splashDone, auth.status]);

  // Home-gate (chuẩn SmartLife): sau login → đảm bảo có nhà — chưa có thì TỰ tạo "My Home" mặc định
  // (không bắt user qua màn Create Home) → vào thẳng tab Thiết bị. gateNonce: bump khi bấm "Thử lại".
  // Lỗi (mạng/SDK) → hiện Thử lại, KHÔNG tự tạo nhà mù (tránh tạo trùng khi getHomeList lỗi tạm thời).
  useEffect(() => {
    if (screen !== 'home-gate') return;
    let cancelled = false;
    setGateError('');
    void (async () => {
      try {
        const home = await ensureDefaultHome();
        if (cancelled) return;
        setHomeId(home.homeId);
        setHomeName(home.name || 'My Home');
        setScreen('device-list');
      } catch (e: any) {
        if (!cancelled) setGateError(e?.message ?? 'Could not load your homes — check your connection and try again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [screen, gateNonce]);

  useEffect(() => {
    // RN CLI: font đã link native (không cần Font.loadAsync). Prefetch logo cho mượt.
    Image.prefetch(LOGO_URI);
    Image.prefetch(LOGO_URI_LIGHT);
  }, []);

  const navigate: Navigate = (to, params = {}) => {
    const minutes = params.minutes;
    const seconds = params.seconds;
    if (typeof minutes === 'number') setSessionMinutes(minutes);
    if (typeof seconds === 'number') setSessionSeconds(seconds);
    if (typeof params.homeId === 'number') setHomeId(params.homeId);
    if (typeof params.homeName === 'string') setHomeName(params.homeName);
    if (typeof params.devId === 'string') setActiveDevId(params.devId);
    setScreen(to);
  };

  // Đăng xuất dùng chung (Me → Cấu hình thông tin, và HomeScreen cũ).
  const handleSignOut = () => {
    void auth.signOut();
    setScreen('auth');
  };

  const handleSessionComplete = (seconds: number) => {
    appState.completeSession(seconds);
  };

  let currentScreen: ReactNode;
  switch (screen) {
    case 'splash':
      currentScreen = <SplashScreen onDone={() => setSplashDone(true)} />;
      break;
    case 'intro':
      currentScreen = <IntroScreen navigate={navigate} />;
      break;
    case 'onboard-welcome':
      // Landing guest theo design "The ritual starts here." — social login trực tiếp từ welcome.
      currentScreen = <AuthScreen navigate={navigate} onAuthed={auth.onAuthed} variant="welcome" />;
      break;
    case 'onboard-email':
      currentScreen = <OnboardEmailScreen navigate={navigate} />;
      break;
    case 'onboard-name':
      currentScreen = <OnboardNameScreen navigate={navigate} onSetName={setUserName} />;
      break;
    case 'onboard-why':
      currentScreen = <OnboardWhyScreen navigate={navigate} userName={userName} />;
      break;
    case 'onboard-experience':
      currentScreen = <OnboardExperienceScreen navigate={navigate} />;
      break;
    case 'onboard-device':
      currentScreen = <OnboardDeviceScreen navigate={navigate} userName={userName} />;
      break;
    case 'auth':
      currentScreen = <AuthScreen navigate={navigate} onAuthed={auth.onAuthed} variant="signin" />;
      break;
    case 'home-gate':
      // Transient: effect ở trên đang quyết định create-home | device-list. Lỗi → hiện Thử lại (không tạo nhà trùng).
      currentScreen = (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg, paddingHorizontal: 32 }}>
          {gateError ? (
            <>
              <Text style={{ color: theme.white, fontSize: 15, textAlign: 'center', marginBottom: 20 }}>
                {gateError}
              </Text>
              <Pressable
                onPress={() => setGateNonce((n) => n + 1)}
                style={{ borderWidth: 1, borderColor: theme.ochre, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36 }}
              >
                <Text style={{ color: theme.ochre, fontSize: 14, letterSpacing: 1 }}>TRY AGAIN</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={theme.ochre} />
          )}
        </View>
      );
      break;
    case 'create-home':
      currentScreen = <CreateHomeScreen navigate={navigate} onHomeCreated={setHomeId} />;
      break;
    case 'device-list':
      currentScreen = (
        <DeviceListScreen navigate={navigate} state={state} homeId={homeId} homeName={homeName} />
      );
      break;
    case 'me':
      currentScreen = <MeScreen navigate={navigate} state={state} user={auth.user} />;
      break;
    case 'reminder':
      currentScreen = <ReminderScreen navigate={navigate} state={state} />;
      break;
    case 'shop':
      currentScreen = <ShopScreen navigate={navigate} state={state} />;
      break;
    case 'help':
      currentScreen = <HelpScreen navigate={navigate} state={state} />;
      break;
    case 'home-management':
      currentScreen = <HomeManagementScreen navigate={navigate} state={state} homeId={homeId} />;
      break;
    case 'notifications':
      currentScreen = <NotificationsScreen navigate={navigate} state={state} />;
      break;
    case 'profile':
      currentScreen = (
        <ProfileScreen navigate={navigate} state={state} user={auth.user} onSignOut={handleSignOut} />
      );
      break;
    case 'device-detail':
      currentScreen = <DashboardScreen navigate={navigate} state={state} devId={activeDevId} />;
      break;
    case 'pairing':
      currentScreen = <PairingScreen navigate={navigate} state={state} homeId={homeId} />;
      break;
    case 'dashboard':
      currentScreen = <DashboardScreen navigate={navigate} state={state} />;
      break;
    case 'breathwork':
      currentScreen = (
        <BreathworkScreen navigate={navigate} onComplete={appState.completeBreathwork} state={state} />
      );
      break;
    case 'session':
      currentScreen = <SessionScreen navigate={navigate} onComplete={handleSessionComplete} />;
      break;
    case 'completion':
      currentScreen = (
        <CompletionScreen state={state} minutes={sessionMinutes} seconds={sessionSeconds} navigate={navigate} />
      );
      break;
    case 'progress':
      currentScreen = <ProgressScreen state={state} navigate={navigate} />;
      break;
    case 'home':
    default:
      currentScreen = (
        <HomeScreen
          state={state}
          navigate={navigate}
          userName={userName}
          onSignOut={handleSignOut}
        />
      );
  }

  // Màn thuộc bottom tab → bọc thêm tab bar (Thiết bị / Tôi) ở đáy.
  const activeTab = TABBED[screen];

  return (
    <ThemeToggleContext.Provider value={toggleTheme}>
      <ThemeContext.Provider value={theme}>
        <ErrorBoundary>
          {activeTab ? (
            <View style={{ flex: 1, backgroundColor: theme.bg }}>
              <View style={{ flex: 1 }}>{currentScreen}</View>
              <BottomTabBar active={activeTab} navigate={navigate} />
            </View>
          ) : (
            currentScreen
          )}
        </ErrorBoundary>
      </ThemeContext.Provider>
    </ThemeToggleContext.Provider>
  );
}
