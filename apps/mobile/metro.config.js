const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// Lib Tuya (@jimmy2k/react-native-turbo-tuya) giờ cài từ npm như mọi dependency khác → không cần
// watchFolders / export-condition đọc src nữa; Metro dùng bản `lib/` đã build trong node_modules.

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
