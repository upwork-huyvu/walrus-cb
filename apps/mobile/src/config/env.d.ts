// Khai báo type cho module '@env' do react-native-dotenv sinh ra (xem babel.config.js).
// Biến thiếu trong .env → undefined (allowUndefined: true), nên để optional.
declare module '@env' {
  export const API_BASE_URL: string | undefined;
  export const PUSH_API_KEY: string | undefined;
  export const MOCK_DEVICES: string | undefined;
}
