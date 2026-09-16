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
// 2. **iOS CÓ EZ kể từ khi Apple duyệt multicast entitlement (2026-08-07).** iOS 14.5+ chặn gói
//    broadcast/multicast tuỳ biến nếu thiếu `com.apple.developer.networking.multicast`, mà EZ chạy
//    đúng bằng cơ chế đó. Entitlement đã được duyệt và khai trong `CoolBathMobile.entitlements`
//    ⇒ EZ là mode mặc định trên CẢ HAI nền tảng, giống Smart Life.
//    ⚠️ Entitlement chỉ có tác dụng khi provisioning profile chứa quyền đó - profile cũ sẽ làm
//    Xcode FAIL LÚC KÝ (không phải lỗi runtime), nên nếu build được thì quyền chắc chắn đã vào.
//    Khác biệt còn lại giữa 2 nền: iOS không liệt kê được Wi-Fi và không đọc được băng tần.
//
// 3. **Tự điền mạng đang kết nối ở CẢ EZ lẫn AP - chỉ cấm khi mạng đó là HOTSPOT THIẾT BỊ.**
//    (Đính chính 2026-09-15, client chỉ ra. Bản trước cấm hẳn tự điền ở AP.)
//      · Ở AP, credentials nhập vào là CỦA ROUTER: "the ssid and password respectively specify the
//        hotspot name and password of the router rather than that of the device" (doc iOS SDK).
//        Nhưng bước NHẬP đứng TRƯỚC bước nối hotspot - lúc đó máy vẫn đang ở Wi-Fi nhà ⇒ mạng đang
//        nối CHÍNH LÀ mạng cần truyền. Smart Life cũng tự điền ở màn này (màn nhập Wi-Fi nằm trước
//        cả chỗ chọn EZ/AP). Cấm tự điền ở AP = bắt user gõ tay vô cớ.
//      · Ca DUY NHẤT tự điền sai: máy ĐÃ ở hotspot `SmartLife-xxxx` / `SL-…-xxxx` của thiết bị
//        (vào lại sau lần pair hỏng, hoặc nối hotspot trước theo thói quen). Tên hotspot nhận ra
//        được bằng prefix ⇒ `isTuyaHotspotSsid()` chặn ở prefill, ở nút "Use the network I'm
//        connected to", ở dropdown quét, và ở preflight trước khi bấm Start - cho MỌI mode, vì
//        SSID hotspot không bao giờ là SSID router hợp lệ (EZ cũng dính nếu máy còn kẹt ở hotspot).
//      · `scanWifiNetworks()` (Android) trả về mọi mạng xung quanh ⇒ dropdown luôn an toàn, chỉ cần
//        lọc tên hotspot ra khỏi danh sách để nó không nằm ngay đầu với nhãn "Strong".
//    ⇒ `prefillCurrentWifi` = true cho cả EZ và AP; false chỉ ở BLE (không có ô Wi-Fi).

export type PairingPlatform = 'ios' | 'android';

/**
 * Tên hotspot Tuya phát ra khi thiết bị ở AP mode: mặc định `SmartLife-XXXX`, tuỳ biến `SL-<tên>-XXXX`
 * (XXXX = 4 ký tự cuối MAC). Hậu tố 4 ký tự được neo cho dạng `SL-` để không chặn nhầm router nhà
 * tên kiểu "SL-Home"; dạng `SmartLife-` thì khớp mọi hậu tố vì không ai đặt tên router như vậy.
 */
export function isTuyaHotspotSsid(ssid: string | null | undefined): boolean {
  const s = (ssid ?? '').trim();
  if (!s) return false;
  return /^SmartLife[-_]/i.test(s) || /^SL-.+-[0-9A-Za-z]{4}$/i.test(s);
}

/** Thông báo dùng chung khi phát hiện ô Wi-Fi / mạng đang nối là hotspot thiết bị. */
export const HOTSPOT_SSID_MESSAGE =
  'That is the Walrus hotspot, not your home Wi-Fi. Enter the 2.4GHz network Walrus should join - and if this phone is still on the "SmartLife" hotspot, reconnect it to your home Wi-Fi first.';

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
   * Có ô Wi-Fi để TỰ ĐIỀN mạng đang kết nối không? EZ = AP = true, BLE = false. Tự điền luôn đi qua
   * `isTuyaHotspotSsid()` - xem ràng buộc #3.
   */
  prefillCurrentWifi: boolean;
  /** Cảnh báo hiện ngay trên ô Wi-Fi (AP cần; EZ không). */
  wifiNotice?: string;
  /** Hướng dẫn từng bước, render dạng ĐÁNH SỐ. Mỗi phần tử = 1 bước user làm được. */
  steps: string[];
};

// Đèn báo: EZ nháy NHANH, AP nháy CHẬM (nguyên văn SmartLife user manual). Đây là bước vật lý đầu
// tiên và cũng là thứ user hay làm sai nhất → luôn để bước 1.
// iOS không tự điền được vô điều kiện: đọc SSID cần quyền Location (iOS 13+), user Deny một lần là
// iOS không hỏi lại ⇒ đừng hứa "it is filled in for you" - nói rõ điều kiện và lối thoát gõ tay.
// Đây là step thứ 2 nói về ô Wi-Fi (dùng chung EZ/AP, chỉ khác câu đuôi).
const IOS_WIFI_FIELD_STEP =
  'Check the Wi-Fi name below - it is filled in from the network this phone is on when Location is allowed; otherwise type it - and enter its password.';

function modeEz(platform: PairingPlatform): PairingModeSpec {
  // Android quét được danh sách mạng → dropdown. iOS không có API liệt kê Wi-Fi → gõ tay, GIỐNG AP.
  const pickNetworkStep =
    platform === 'android' ? 'Pick that network below and enter its password.' : IOS_WIFI_FIELD_STEP;
  return {
    id: 'ez',
    label: 'Wi-Fi (EZ)',
    hint: 'Indicator blinking quickly',
    channel: 'ez',
    wifiInput: platform === 'android' ? 'dropdown' : 'manual',
    // EZ: máy đang ở CHÍNH mạng cần truyền cho thiết bị → tự điền là đúng, đỡ cho user một bước.
    // iOS đọc được SSID đang nối qua `com.apple.developer.networking.wifi-info` + quyền Location.
    prefillCurrentWifi: true,
    steps: [
      'Reset Walrus until its Wi-Fi indicator is blinking QUICKLY.',
      'Keep this phone on your 2.4GHz Wi-Fi. Walrus cannot join a 5GHz network.',
      pickNetworkStep,
      'Tap Start searching, then stay near Walrus until it appears on the radar.',
    ],
  };
}

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

// Câu đuôi của bước nhập Wi-Fi ở AP - bước CHỐNG SAI quan trọng nhất: user rất dễ tưởng phải điền
// hotspot SmartLife… của thiết bị. Câu đầu theo `wifiInput` (dropdown → pick, manual → type/check).
const AP_ROUTER_SUFFIX = 'This is the network Walrus will join - NOT the device’s own hotspot.';

function modeAp(platform: PairingPlatform): PairingModeSpec {
  const routerStep =
    platform === 'android'
      ? `Pick your home 2.4GHz Wi-Fi below - or keep the one already filled in - and enter its password. ${AP_ROUTER_SUFFIX}`
      : `${IOS_WIFI_FIELD_STEP} ${AP_ROUTER_SUFFIX}`;
  // Cả 2 nền tảng đều bảo user TỰ vào Settings nối hotspot (đúng SmartLife user manual + doc iOS SDK
  // "Guide the user to connect their phone to the AP emitted by the device").
  // ⚠️ Doc Android có câu "the SDK automatically connects to the hotspot of the device" - nhưng câu đó
  // thuộc AP flow MỚI (`newOptimizedActivator`, firmware TuyaOS ≥ 3.6.1, mục "Restart pairing").
  // App này đi path legacy `ActivatorBuilder`/`THING_AP` (TuyaPairingModule.kt) ⇒ Android KHÔNG tự
  // nối, đừng viết "If Android offers to connect for you". Câu "no internet, stay connected" là hành
  // vi của Android OS (hộp thoại "Stay connected?" - bấm No là nó rớt hotspot), không phải doc Tuya.
  const joinHotspotStep =
    platform === 'ios'
      ? 'Open iPhone Settings → Wi-Fi and connect this phone to the Walrus hotspot - the network whose name starts with "SmartLife".'
      : 'Open your phone’s Wi-Fi settings and connect this phone to the Walrus hotspot - the network whose name starts with "SmartLife". If Android warns that this network has no internet, stay connected to it anyway.';
  // Thiết bị tắt hotspot NGAY khi nhận xong credentials rồi mới đi nối router + kích hoạt cloud
  // (doc iOS SDK: "The device automatically turns off the AP" → connect to router → activation) - tức
  // hotspot biến mất TRƯỚC khi "pairing finishes". Không doc nào nói điện thoại tự quay về Wi-Fi nhà
  // ⇒ nói "should ... on its own; if not, reconnect yourself", vì app cần online để hoàn tất.
  const steps = [
    'Reset Walrus until its Wi-Fi indicator is blinking SLOWLY.',
    routerStep,
    joinHotspotStep,
    'Come back here and tap Start searching. Keep the phone on the Walrus hotspot until it disappears - Walrus switches it off by itself as soon as it has your Wi-Fi details.',
    'Your phone should then drop back to your home Wi-Fi on its own. If it does not, reconnect to it yourself - the app needs to be online to finish adding Walrus.',
  ];
  return {
    id: 'ap',
    label: 'Wi-Fi hotspot (AP)',
    hint: 'Indicator blinking slowly',
    channel: 'ap',
    // Android quét được danh sách mạng → dropdown (lọc tên hotspot ra). iOS → gõ tay.
    wifiInput: platform === 'android' ? 'dropdown' : 'manual',
    // Tự điền như EZ: lúc nhập máy còn ở Wi-Fi nhà. `isTuyaHotspotSsid()` chặn ca máy đã ở hotspot.
    prefillCurrentWifi: true,
    wifiNotice:
      'Enter your HOME Wi-Fi - the network Walrus should join. Not the device’s own “SmartLife…” hotspot.',
    steps,
  };
}

/**
 * Danh sách mode cho dropdown, theo nền tảng. Phần tử ĐẦU là mặc định.
 * Từ 2026-08-07 (Apple duyệt multicast entitlement) thứ tự GIỐNG NHAU ở cả hai nền:
 * EZ · AP · BLE. Trước đó iOS chỉ có AP · BLE - xem ràng buộc #2.
 */
export function pairingModesFor(platform: PairingPlatform): PairingModeSpec[] {
  return [modeEz(platform), modeAp(platform), MODE_BLE];
}

/** Mode mặc định = phần tử đầu danh sách (EZ trên cả iOS lẫn Android). */
export function defaultPairingMode(platform: PairingPlatform): PairingModeId {
  return pairingModesFor(platform)[0].id;
}

export function getPairingMode(id: PairingModeId, platform: PairingPlatform): PairingModeSpec {
  const list = pairingModesFor(platform);
  const found = list.find((m) => m.id === id);
  // Không ném lỗi: id lạ (state cũ, deep-link) → lùi về mode mặc định. Không đáng làm sập màn
  // pairing. Hiện cả 3 mode đều có trên cả 2 nền, nhưng giữ fallback để nền tảng nào bỏ bớt mode
  // sau này cũng không phải sửa chỗ gọi.
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
