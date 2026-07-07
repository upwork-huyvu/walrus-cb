module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Đọc biến từ .env → import qua module '@env' (xem src/config/api.ts).
    // LƯU Ý: giá trị bị nhúng vào JS bundle lúc build → KHÔNG phải secret thật,
    // chỉ để tách config ra khỏi source (khác máy/khác env đổi .env, không sửa code).
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true,
      },
    ],
  ],
};
