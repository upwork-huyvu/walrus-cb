const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// Repo KHÔNG có root workspace → app standalone. Link lib local @jimmy-vu/react-native-turbo-tuya
// (packages/tuya-react-native) bằng watchFolders + đọc TRỰC TIẾP src qua export-condition của lib
// ('react-native-turbo-tuya-source' → src/index.tsx) để khỏi cần `bob build`.
// ⚠️ Verify khi chạy Metro thật; nếu lỗi resolve src → tắt enablePackageExports + chạy `bob build` ở lib rồi
//    consume bản `lib/` (default condition).
const repoRoot = path.resolve(__dirname, '..', '..');
const libRoot = path.resolve(repoRoot, 'packages', 'tuya-react-native');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  watchFolders: [libRoot],
  resolver: {
    unstable_enablePackageExports: true,
    unstable_conditionNames: [
      'react-native-turbo-tuya-source', // đọc src lib trực tiếp (dev, không cần build)
      'react-native',
      'require',
      'default',
    ],
    // Dedupe React/RN về 1 bản của app (tránh "Invalid hook call" do 2 bản React).
    extraNodeModules: {
      react: path.resolve(__dirname, 'node_modules', 'react'),
      'react-native': path.resolve(__dirname, 'node_modules', 'react-native'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
