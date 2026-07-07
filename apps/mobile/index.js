/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Handler noti khi app BACKGROUND/QUIT - phải đăng ký ở top-level (ngoài React), require-guard để
// Metro chưa build native không crash. Data-only message → hiện bằng Notifee; notification message
// đã được OS tự hiện (Android/APNs). Xem services/push.ts.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const messaging = require('@react-native-firebase/messaging').default;
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const { displayNotification } = require('./src/services/push');
  messaging().setBackgroundMessageHandler(async (msg) => {
    if (msg?.data && !msg?.notification) await displayNotification(msg);
  });
} catch (e) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[push] background handler not registered (native vắng)', e);
  }
}

AppRegistry.registerComponent(appName, () => App);
