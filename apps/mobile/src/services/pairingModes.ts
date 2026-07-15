// Registry các chế độ pairing - nguồn sự thật cho dropdown chọn mode, hướng dẫn từng bước, và
// kiểu ô nhập Wi-Fi.
//
// Nội dung hướng dẫn lấy từ doc chính chủ, KHÔNG viết theo trí nhớ:
// docs/research/tuya-ios-ap-mode-pairing.md (có trích nguyên văn SmartLife user manual).
//
// ⚠️ BA RÀNG BUỘC ĐỪNG PHÁ:
//
// 1. **Mỗi mode đúng MỘT kênh** (`channel`, số ít - không phải mảng).
//    EZ và AP không thể chạy song song: AP đòi điện thoại RỜI Wi-Fi nhà để nối hotspot thiết bị,
//    EZ đòi điện thoại ĐANG Ở Wi-Fi nhà 2.4GHz - một máy không ở hai mạng cùng lúc. Kiểu dữ liệu
//    để số ít là có chủ đích: để mảng là mời người sau nhét thêm kênh rồi vô tình dựng lại đúng
//    cái thiết kế song song đã bỏ.
//
// 2. **iOS không có EZ.** iOS 14.5+ cần entitlement `com.apple.developer.networking.multicast`
//    (Apple chưa duyệt cho app này). Tuya nói thẳng: "For iOS 14.5 and later, we recommend that
//    you use the AP mode instead of the Wi-Fi EZ mode."
//
// 3. **AP: CẤM tự điền mạng đang kết nối** (`prefillCurrentWifi: false`) - nhưng **QUÉT thì được**.
//    Đây là hai thứ KHÁC NHAU, bản trước gộp nhầm làm một rồi cấm cả hai:
//      · `getCurrentWifiSsid()` trả về **mạng máy đang nối** ⇒ ở AP rất có thể là hotspot
//        `SmartLife-xxxx` của chính thiết bị ⇒ tự điền = **sai**, trong khi Tuya cần SSID CỦA
//        ROUTER: "the ssid and password respectively specify the hotspot name and password of the
//        router rather than that of the device". Lỗi trả về KHÔNG hé lộ gì về nguyên nhân.
//      · `scanWifiNetworks()` trả về **mọi mạng xung quanh** (Android), không liên quan tới việc
//        đang nối mạng nào ⇒ **luôn an toàn**, kể cả khi máy đã ở hotspot thiết bị. Và ở màn nhập
//        thì máy thường VẪN CÒN ở Wi-Fi nhà (bước nối hotspot đứng SAU bước nhập).
//    ⇒ AP trên Android: dropdown (quét được) nhưng **không tự điền**. AP trên iOS: gõ tay, vì iOS
//    không có API liệt kê Wi-Fi.

export type PairingPlatform = 'ios' | 'android';

/** Kênh ghép nối vật lý. Mỗi mode đúng 1 kênh - xem ràng buộc #1 đầu file. */
export type PairingChannel = 'ez' | 'ap' | 'ble';

export type PairingModeId = 'ez' | 'ap' | 'ble';

/**
 * Kiểu ô nhập Wi-Fi của mode. Là DỮ LIỆU chứ không phải logic → UI khỏi rải `if (id === 'ap')`.
 * - `dropdown`: xổ danh sách mạng quét được để chọn (chỉ Android quét được)
 * - `manual`  : gõ tay (iOS - không có API liệt kê Wi-Fi)
 * - `none`    : mode không cần Wi-Fi (BLE)
 */
export type WifiInput = 'dropdown' | 'manual' | 'none';

export type PairingModeSpec = {
  id: PairingModeId;
  label: string;
  /** Dòng phụ trong dropdown - "khi nào chọn cái này". */
  hint: string;
  channel: PairingChannel;
  wifiInput: WifiInput;
  /**
   * Được phép TỰ ĐIỀN mạng đang kết nối không? **Tách hẳn khỏi `wifiInput`** - xem ràng buộc #3:
   * quét danh sách thì luôn an toàn, còn tự điền mạng ĐANG NỐI thì ở AP sẽ ra hotspot của chính
   * thiết bị. AP = false, EZ = true.
   */
  prefillCurrentWifi: boolean;
  /** Cảnh báo hiện ngay trên ô Wi-Fi (AP cần; EZ không). */
  wifiNotice?: string;
  /** Hướng dẫn từng bước, render dạng ĐÁNH SỐ. Mỗi phần tử = 1 bước user làm được. */
  steps: string[];
};

// Đèn báo: EZ nháy NHANH, AP nháy CHẬM (nguyên văn SmartLife user manual). Đây là bước vật lý đầu
// tiên và cũng là thứ user hay làm sai nhất → luôn để bước 1.
const MODE_EZ: PairingModeSpec = {
  id: 'ez',
  label: 'Wi-Fi (EZ)',
  hint: 'Indicator blinking quickly',
  channel: 'ez',
  wifiInput: 'dropdown',
  // EZ: máy đang ở CHÍNH mạng cần truyền cho thiết bị → tự điền là đúng, đỡ cho user một bước.
  prefillCurrentWifi: true,
  steps: [
    'Reset Walrus until its Wi-Fi indicator is blinking QUICKLY.',
    'Keep this phone on your 2.4GHz Wi-Fi. Walrus cannot join a 5GHz network.',
    'Pick that network below and enter its password.',
    'Tap Start searching, then stay near Walrus until it appears on the radar.',
  ],
};

const MODE_BLE: PairingModeSpec = {
  id: 'ble',
  label: 'Bluetooth',
  hint: 'No Wi-Fi details needed',
  channel: 'ble',
  wifiInput: 'none',
  prefillCurrentWifi: false, // không có ô Wi-Fi nào để điền
  steps: [
    'Turn on Bluetooth and Location on this phone.',
    'Put Walrus into pairing mode.',
    'Tap Start searching. Walrus appears on the radar as soon as it is found.',
    'Tap Walrus on the radar to add it.',
  ],
};

// Bước 2 giống nhau ở cả 2 nền tảng và là bước CHỐNG SAI quan trọng nhất của AP: user rất dễ tưởng
// phải điền hotspot SmartLife… của thiết bị.
const AP_ROUTER_STEP =
  'Type your home 2.4GHz Wi-Fi name and password below. This is the network Walrus will join - NOT the device’s own hotspot.';

function modeAp(platform: PairingPlatform): PairingModeSpec {
  // ⚠️ ĐÍNH CHÍNH (2026-07-16, client chỉ ra): bản trước bảo user Android "khỏi rời app, SDK tự nối
  // hotspot" - dựa vào MỘT DÒNG trong doc Android: "the SDK automatically connects to the hotspot
  // of the device within a certain period". Dòng đó **mâu thuẫn với SmartLife user manual** (bắt
  // user vào Wi-Fi settings chọn hotspot `SmartLife…` - và manual đó mô tả app CHẠY THẬT), và rất
  // có thể đã lỗi thời: từ **Android 10** app không còn tự join Wi-Fi ngầm được nữa, mà app này
  // targetSdk 36. ⇒ Cả 2 nền tảng đều hướng dẫn user TỰ NỐI - đúng thì chạy, mà nếu SDK có tự nối
  // thật thì user chỉ thấy nó đã nối sẵn, không hại gì. **Cần B6 xác nhận trên máy thật.**
  const joinHotspotStep =
    platform === 'ios'
      ? 'Open iPhone Settings → Wi-Fi and connect this phone to the Walrus hotspot - the network whose name starts with "SmartLife".'
      : 'Open your phone’s Wi-Fi settings and connect this phone to the Walrus hotspot - the network whose name starts with "SmartLife". If Android offers to connect for you, accept it.';
  const steps = [
    'Reset Walrus until its Wi-Fi indicator is blinking SLOWLY.',
    AP_ROUTER_STEP,
    joinHotspotStep,
    'Come back here and tap Start searching. Keep the phone on the Walrus hotspot until it finishes.',
    'Walrus turns its hotspot off by itself once pairing finishes, and your phone returns to your normal Wi-Fi.',
  ];
  return {
    id: 'ap',
    label: 'Wi-Fi hotspot (AP)',
    hint: 'Indicator blinking slowly',
    channel: 'ap',
    // Android quét được danh sách mạng → cho dropdown luôn (quét là an toàn, xem ràng buộc #3).
    // iOS không có API liệt kê Wi-Fi → gõ tay.
    wifiInput: platform === 'android' ? 'dropdown' : 'manual',
    // Nhưng KHÔNG tự điền ở cả 2 nền tảng: mạng đang nối lúc này có thể là hotspot của thiết bị.
    prefillCurrentWifi: false,
    wifiNotice:
      'Enter your HOME Wi-Fi - the network Walrus should join. Not the device’s own “SmartLife…” hotspot.',
    steps,
  };
}

/**
 * Danh sách mode cho dropdown, theo nền tảng. Thứ tự = thứ tự client chốt (2026-07-16):
 * Android EZ · AP · BLE — iOS AP · BLE. Phần tử ĐẦU là mặc định.
 */
export function pairingModesFor(platform: PairingPlatform): PairingModeSpec[] {
  if (platform === 'ios') return [modeAp(platform), MODE_BLE]; // iOS không có EZ - ràng buộc #2
  return [MODE_EZ, modeAp(platform), MODE_BLE];
}

/** Mode mặc định = phần tử đầu danh sách (Android EZ · iOS AP). */
export function defaultPairingMode(platform: PairingPlatform): PairingModeId {
  return pairingModesFor(platform)[0].id;
}

export function getPairingMode(id: PairingModeId, platform: PairingPlatform): PairingModeSpec {
  const list = pairingModesFor(platform);
  const found = list.find((m) => m.id === id);
  // Không ném lỗi: id lạ, hoặc id hợp lệ nhưng không có trên nền tảng này (vd 'ez' trên iOS - state
  // cũ, deep-link) → lùi về mode mặc định. Không đáng làm sập màn pairing.
  return found ?? list[0];
}

/** Mode này có cần SSID/password không? Suy từ `wifiInput` - đừng thêm cờ riêng, sẽ lệch nhau. */
export function modeNeedsWifi(id: PairingModeId, platform: PairingPlatform): boolean {
  return getPairingMode(id, platform).wifiInput !== 'none';
}

/** Mode này có quét BLE không → dùng để biết có phải xin quyền Bluetooth trước hay không. */
export function modeNeedsBlePermission(id: PairingModeId, platform: PairingPlatform): boolean {
  return getPairingMode(id, platform).channel === 'ble';
}
