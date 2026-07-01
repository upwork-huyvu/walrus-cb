import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'react-native';
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
import OnboardWelcomeScreen from './src/screens/onboarding/OnboardWelcomeScreen';
import OnboardEmailScreen from './src/screens/onboarding/OnboardEmailScreen';
import OnboardNameScreen from './src/screens/onboarding/OnboardNameScreen';
import OnboardWhyScreen from './src/screens/onboarding/OnboardWhyScreen';
import OnboardExperienceScreen from './src/screens/onboarding/OnboardExperienceScreen';
import OnboardDeviceScreen from './src/screens/onboarding/OnboardDeviceScreen';
import PairingScreen from './src/screens/PairingScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import AuthScreen from './src/screens/AuthScreen';
import { useAuth } from './src/state/useAuth';
import { onSessionExpired } from './src/services/auth';
import { initSdk } from './src/services/tuya';

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('splash');
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [userName, setUserName] = useState('');
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
      auth.bootstrap();
    })();
    const sub = onSessionExpired(() => {
      auth.reset();
      setScreen('auth');
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sau splash + đã biết trạng thái → route MỘT lần (authed→home, guest→onboarding).
  useEffect(() => {
    if (routed.current || !splashDone || auth.status === 'checking') return;
    routed.current = true;
    setScreen(auth.status === 'authed' ? 'home' : 'onboard-welcome');
  }, [splashDone, auth.status]);

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
    setScreen(to);
  };

  const handleSessionComplete = (seconds: number) => {
    appState.completeSession(seconds);
  };

  let currentScreen: ReactNode;
  switch (screen) {
    case 'splash':
      currentScreen = <SplashScreen onDone={() => setSplashDone(true)} />;
      break;
    case 'onboard-welcome':
      currentScreen = <OnboardWelcomeScreen navigate={navigate} />;
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
      currentScreen = <AuthScreen navigate={navigate} onAuthed={auth.onAuthed} />;
      break;
    case 'pairing':
      currentScreen = <PairingScreen navigate={navigate} state={state} />;
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
          onSignOut={() => {
            auth.signOut();
            setScreen('auth');
          }}
        />
      );
  }

  return (
    <ThemeToggleContext.Provider value={toggleTheme}>
      <ThemeContext.Provider value={theme}>
        <ErrorBoundary>{currentScreen}</ErrorBoundary>
      </ThemeContext.Provider>
    </ThemeToggleContext.Provider>
  );
}
