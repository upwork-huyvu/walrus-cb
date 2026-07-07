# Tuya Research: Home Management (nâng cao) - thành viên, phòng, weather, update/dismiss/transfer, change listeners

- **Ngày:** 2026-06-29 · **SDK version tham chiếu:** Android `com.thingclips.smart:thingsmart` **7.5.x**; iOS `ThingSmartHomeKit` **~7.5**
- **Data Center:** Central Europe (đồng bộ với note nền tảng).
- **Nguồn chính:**
  - Home Information Management (Android) - https://developer.tuya.com/en/docs/app-development/familyrelations?id=Ka6ki8h2c2yo5
  - Room Information Management (Android) - https://developer.tuya.com/en/docs/app-development/room-information-management?id=Kaiy7xla9is7e
  - Member Information Management (Android) - https://developer.tuya.com/en/docs/app-development/member-information-management?id=Kaiy91tma26nh
  - Home Member Management (Biz/CoreKit, đa nền tảng) - https://developer.tuya.com/en/docs/app-development/extension-family-member?id=Kcy2iwdhz60pm
  - Home Information Management (iOS) - https://developer.tuya.com/en/docs/app-development/iOS_family?id=Kaixeor409hck
  - Room Information Management (iOS) - https://developer.tuya.com/en/docs/app-development/iOS-room?id=Kaixll0l9ue4t
  - Member Information Management (iOS) - https://developer.tuya.com/en/docs/app-development/iOS-family-member?id=Kaixlyjh6uer8
  - iOS Home SDK API Reference - https://tuya.github.io/tuyasmart_home_ios_sdk_api_reference/
- **Lưu ý độ tin cậy:** Signature **Android** + **iOS classic SDK** lấy verbatim khá đầy đủ từ doc + API reference. Tuya có **2 thế hệ API song song**: (1) **classic** `ThingHomeSdk.getMemberInstance()` / `ThingSmartHome*`; (2) **Biz/CoreKit** mới (`FamilyManagerCoreKit` / `ThingSmartFamilyBiz`/`ThingSmartRoomBiz`/`ThingSmartMemberBiz`). Vài chi tiết (enum role iOS verbatim đầy đủ, một số field model iOS) WebFetch tóm tắt bằng model nhỏ → đánh dấu ở "Câu hỏi mở". Phương thức **transfer owner** đã xác minh tồn tại cả 2 nền tảng + cả 2 thế hệ API.

---

## TL;DR (cho người sắp code)
1. **App ice-bath dùng 1 home/user**, nên phần này chủ yếu cần: **updateHome** (đổi tên/vị trí), **getHomeWeather** (hiển thị nhiệt độ ngoài trời, optional), **room CRUD + gán device vào phòng** (nếu muốn nhóm thiết bị), **member** (mời người nhà cùng điều khiển), **transfer owner** (đổi chủ khi bán/sang nhượng bồn), và **registerThingHomeChangeListener** để UI tự cập nhật khi có thay đổi từ thiết bị khác.
2. **2 instance khác nhau:** `ThingHomeSdk.getHomeManagerInstance()` (IThingHomeManager) cho thao tác **cấp danh sách home + listener toàn cục**; `ThingHomeSdk.newHomeInstance(homeId)` (IThingHome) cho thao tác **trong 1 home cụ thể** (room, member, weather, detail, dismiss). Member còn có instance riêng `ThingHomeSdk.getMemberInstance()` (IThingHomeMember).
3. **Role số (Android `HomeBean.role` / `MemberBean.role`):** `2` = owner, `1` = admin, `0` = member, `-1` = custom, `-999` = invalid. (Trang Biz mới ghi nhầm thứ tự - **lấy theo classic + note nền tảng: 2 = owner**.) iOS dùng enum `ThingHomeRoleType_Owner` / `ThingHomeRoleType_Admin` / common.
4. **Mời thành viên có 2 cơ chế:** (a) **theo account** (`addMember` với `MemberWrapperBean`, có `autoAccept`); (b) **theo mã mời** (`getInvitationMessage` → trả invitation code → người kia `joinHomeByInviteCode`). `autoAccept=false` ⇒ phía được mời phải `processInvitation(homeId, true, ...)` mới vào home.
5. **Transfer owner:** chỉ **owner** mới gọi được; chuyển cho 1 **member đã có trong home**. Android classic chưa public rõ method → **dùng Biz** `transferOwner(homeId, memberId, IFamilyDataCallback<Boolean>)`; iOS `[home transferHomeWithMemberId:success:failure:]` (hoặc `ThingSmartHomeMember`/`ThingSmartMemberBiz`).
6. **Listener là 2 nhóm khác nhau:** `IThingHomeChangeListener` (đăng ký ở **HomeManager**, bắt **thêm/xoá/đổi home, được mời, shared device/group**) vs `IThingHomeStatusListener` (đăng ký ở **newHomeInstance**, bắt **device/group/mesh thêm-xoá trong home**). iOS dùng `ThingSmartHomeManagerDelegate` + `ThingSmartHomeDelegate`.
7. **Phải gọi `getHomeDetail` (Android) / `getHomeDataWithSuccess` (iOS) trước** khi đọc `deviceList`/`roomList`/`groupList` của home - nếu không các list rỗng.
8. **Weather**: 2 mức - `getHomeWeatherSketch` (condition + temp + icon) và `getHomeWeatherDetail` (nhiều ngày, có `unit` map). Cần `lat/lon` của home → khi `createHome`/`updateHome` nên set toạ độ thật, nếu không weather trả rỗng.

---

## Phạm vi
Quản lý nâng cao **trong/giữa các home** sau khi đã login + có home (xem note nền tảng cho create/list/detail cơ bản):
- **Home:** cập nhật thông tin (tên, geo, lat/lon, rooms), **dismiss/xoá home**, **weather** (sketch + detail), **transfer owner**.
- **Room:** tạo / đổi tên / đổi icon / xoá phòng, **sắp xếp phòng**, **gán/bỏ device & group vào phòng**, di chuyển hàng loạt.
- **Member:** mời (theo account + theo invite code), query danh sách, đổi tên/role/quyền admin, xoá thành viên, xử lý lời mời (accept/reject), gia hạn/huỷ invite code.
- **Listener:** `IThingHomeChangeListener` (cấp manager), `IThingHomeStatusListener` (cấp home), delegate tương ứng trên iOS.

Ngoài phạm vi: device sharing (trang riêng), group/scene, OTA - sẽ note riêng.

---

## Khái niệm & luồng

**3 entry instance (Android):**
- `ThingHomeSdk.getHomeManagerInstance()` → **IThingHomeManager**: `queryHomeList`, `createHome`, `sortDevInHome`, **`registerThingHomeChangeListener`**, `getHomeWeatherSketch/Detail` (toạ độ truyền tay).
- `ThingHomeSdk.newHomeInstance(homeId)` → **IThingHome**: `getHomeDetail`, `updateHome`, `dismissHome`, **room ops** (`addRoom`/`removeRoom`/`sortRoom`), **`registerHomeStatusListener`**, `getHomeWeatherSketch/Detail` (dùng lat/lon của home).
- `ThingHomeSdk.getMemberInstance()` → **IThingHomeMember**: toàn bộ member ops + invitation.
- `ThingHomeSdk.newRoomInstance(roomId)` → **IThingRoom**: thao tác trong 1 phòng (đổi tên/icon, add/remove device/group).

**Luồng điển hình UI:**
1. Sau login → `queryHomeList` → chọn/khởi tạo home → `newHomeInstance(homeId).getHomeDetail()` để nạp `deviceList/roomList`.
2. `registerThingHomeChangeListener` (1 lần, ở app level) + `registerHomeStatusListener(homeId)` (khi vào màn home) để UI realtime.
3. Màn "Cài đặt nhà": `updateHome` (đổi tên), room CRUD, member mời/xoá, `transferOwner`, `dismissHome`.
4. Weather widget: cần home có lat/lon → `getHomeWeatherSketch`.

**Cơ chế mời thành viên:**
- **autoAccept = true** → thêm thẳng vào home (chủ yếu khi 2 tài khoản cùng owner kiểm soát).
- **autoAccept = false** → tạo lời mời; người được mời nhận `onHomeInvite(homeId, homeName)` (qua `IThingHomeChangeListener`) hoặc dùng **invite code** rồi `joinHomeByInviteCode(code)`; sau đó `processInvitation(homeId, true)` để chấp nhận / `false` để từ chối.

---

## API Android (verbatim)

### A. Home - update / dismiss / detail (IThingHome qua `newHomeInstance(homeId)`)
```java
IThingHome home = ThingHomeSdk.newHomeInstance(homeId);

// Lấy chi tiết (BẮT BUỘC trước khi đọc deviceList/roomList/groupList)
void getHomeDetail(IThingHomeResultCallback callback);          // onSuccess(HomeBean)
void getHomeLocalCache(IThingHomeResultCallback callback);      // cache offline

// Cập nhật thông tin home (bản mới có rooms; bản legacy không có rooms)
void updateHome(String name, double lon, double lat, String geoName,
                List<String> rooms, IResultCallback callback);
void updateHome(String name, double lon, double lat, String geoName,
                IResultCallback callback);   // legacy

// Xoá / giải tán home (chỉ owner)
void dismissHome(IResultCallback callback);
```

### B. Home list + sort + listener (IThingHomeManager qua `getHomeManagerInstance()`)
```java
IThingHomeManager mgr = ThingHomeSdk.getHomeManagerInstance();

void queryHomeList(IThingGetHomeListCallback callback);         // onSuccess(List<HomeBean>)
void createHome(String name, double lon, double lat, String geoName,
                List<String> rooms, IThingHomeResultCallback callback);

// Sắp xếp device & group hiển thị trong home
void sortDevInHome(String homeId, List<DeviceAndGroupInHomeBean> list,
                   IResultCallback callback);  // BizParentTypeEnum: LOCATION/MESH/ROOM/GROUP/DEVICE

// Listener thay đổi cấp manager (thêm/xoá/đổi home, được mời, shared device/group)
void registerThingHomeChangeListener(IThingHomeChangeListener listener);
void unRegisterThingHomeChangeListener(IThingHomeChangeListener listener);
```

### C. Weather
```java
// Sketch (gọn): condition + nhiệt độ + icon
void getHomeWeatherSketch(double lon, double lat, IIGetHomeWetherSketchCallBack callback);
// onSuccess(WeatherBean result)  -> {condition, temp, iconUrl, inIconUrl}

// Detail (nhiều ngày): limit ngày + map đơn vị
void getHomeWeatherDetail(int limit, Map<String,Object> unit, IGetHomeWetherCallBack callback);
// unit keys: "tempUnit", "pressureUnit", "windspeedUnit"
// onSuccess(ArrayList<DashBoardBean> result)
```

### D. Room (IThingHome + IThingRoom)
```java
// --- Trên IThingHome (newHomeInstance(homeId)) ---
void addRoom(String name, IThingRoomResultCallback callback);   // onSuccess(RoomBean)
void removeRoom(long roomId, IResultCallback callback);
void sortRoom(List<Long> idList, IResultCallback callback);

// --- Trên IThingRoom (newRoomInstance(roomId)) ---
void updateRoom(String name, IResultCallback callback);
void updateIcon(File file, IResultCallback callback);
void addDevice(String devId, IResultCallback callback);
void removeDevice(String devId, IResultCallback callback);
void addGroup(long groupId, IResultCallback callback);
void removeGroup(Long groupId, IResultCallback resultCallback);
void moveDevGroupListFromRoom(List<DeviceAndGroupInRoomBean> list, IResultCallback callback);
// DeviceAndGroupInRoomBean: { String id; int type; }  type: 6 = device, 5 = group

// Tra phòng của 1 device
RoomBean getDeviceRoomBean(String devId);   // qua ThingHomeSdk.getDataInstance()
```

### E. Member (IThingHomeMember qua `getMemberInstance()`)
```java
IThingHomeMember m = ThingHomeSdk.getMemberInstance();

// Thêm / xoá / cập nhật
void addMember(MemberWrapperBean memberWrapperBean, IThingDataCallback<MemberBean> callback);
void removeMember(long memberId, IResultCallback callback);
void updateMember(MemberWrapperBean memberWrapperBean, IResultCallback callback);
void updateMember(long memberId, String name, boolean admin, IResultCallback callback);

// Danh sách
void queryMemberList(long mHomeId, IThingGetMemberListCallback callback);

// Mời theo invite code + xử lý lời mời
void getInvitationMessage(long homeId, IThingDataCallback callback);     // -> invitation code/msg
void joinHomeByInviteCode(String code, IResultCallback callback);
void cancelMemberInvitationCode(long invitationId, IResultCallback callBack);
void processInvitation(long homeId, boolean action, IResultCallback callBack); // action=true accept
void getInvitationList(long homeId, IThingDataCallback callback);
void updateInvitedMember(long invitationId, String memberName, int memberRole, IResultCallback callBack);
```

### F. Transfer owner (dùng Biz / FamilyManagerCoreKit - đa nền tảng)
```java
// Thế hệ Biz/CoreKit (KHUYẾN NGHỊ cho transfer owner trên Android)
FamilyManagerCoreKit.getFamilyUseCase()
    .transferOwner(long homeId, long memberId, IFamilyDataCallback<Boolean> callback);

// Member ops bản Biz (tham chiếu, không bắt buộc dùng):
FamilyManagerCoreKit.getMemberUseCase()
    .addMember(MemberWrapperBean, IFamilyMemberDataCallback<MemberBean>);
    .removeMember(long homeId, long memberId, IFamilyMemberResultCallback);
    .updateMember(MemberWrapperBean, IFamilyMemberResultCallback);
    .getFamilyMemberList(long homeId, IFamilyDataCallback<BizResponseData<List<MemberBean>>>);
    .getMemberInfo(long homeId, long memberId, IFamilyMemberDataCallback<MemberBean>);
    .getInvitationMessage(long homeId, IFamilyMemberDataCallback<InvitationMessageBean>);
    .reInviteMember(long invitationId, IFamilyMemberDataCallback<InvitationMessageBean>);
    .cancelInviteMember(long invitationId, IFamilyMemberResultCallback);
    .updateMemberByInvitation(long invitationId, MemberBean, IFamilyMemberDataCallback<Boolean>);
```
> **Lưu ý:** classic `IThingHomeMember` (mục E) **không expose** transferOwner verbatim trong doc → transfer owner đi qua **Biz**. Mục E vẫn dùng tốt cho add/remove/invite.

---

## API iOS (verbatim / đối chiếu)

### A. Home - manager + update / dismiss / detail / weather
```objc
// ThingSmartHomeManager
- (void)addHomeWithName:(NSString *)homeName
                geoName:(NSString *)geoName
                  rooms:(NSArray <NSString *>*)rooms
               latitude:(double)latitude
              longitude:(double)longitude
                success:(ThingSuccessLongLong)success
                failure:(ThingFailureError)failure;

- (void)getHomeListWithSuccess:(void(^)(NSArray <ThingSmartHomeModel *> *homes))success
                       failure:(ThingFailureError)failure;

// ThingSmartHome  (init: [ThingSmartHome homeWithHomeId:homeId])
- (void)getHomeDataWithSuccess:(void (^)(ThingSmartHomeModel *homeModel))success
                       failure:(ThingFailureError)failure;   // BẮT BUỘC trước khi đọc deviceList/roomList

- (void)updateHomeInfoWithName:(NSString *)homeName
                       geoName:(NSString *)geoName
                      latitude:(double)latitude
                     longitude:(double)longitude
                       success:(ThingSuccessHandler)success
                       failure:(ThingFailureError)failure;

- (void)dismissHomeWithSuccess:(ThingSuccessHandler)success
                       failure:(ThingFailureError)failure;

// Weather
- (void)getHomeWeatherSketchWithSuccess:(void(^)(ThingSmartWeatherSketchModel *))success
                                failure:(ThingFailureError)failure;
- (void)getHomeWeatherDetailWithOption:(ThingSmartWeatherOptionModel *)optionModel
                               success:(void(^)(NSArray<ThingSmartWeatherModel *> *))success
                               failure:(ThingFailureError)failure;
```

### B. Room
```objc
// ThingSmartHome
- (void)addHomeRoomWithName:(NSString *)name
                    success:(ThingSuccessHandler)success
                    failure:(ThingFailureError)failure;
- (void)removeHomeRoomWithRoomId:(long long)roomId
                         success:(ThingSuccessHandler)success
                         failure:(ThingFailureError)failure;
- (void)sortRoomList:(NSArray <ThingSmartRoomModel *> *)roomList
             success:(ThingSuccessHandler)success
             failure:(ThingFailureError)failure;

// ThingSmartRoom  (init: [ThingSmartRoom roomWithRoomId:homeId:])
- (void)updateRoomName:(NSString *)roomName
               success:(ThingSuccessHandler)success
               failure:(ThingFailureError)failure;
- (void)updateIcon:(UIImage *)icon
           success:(nullable ThingSuccessHandler)success
           failure:(nullable ThingFailureError)failure;
- (void)addDeviceWithDeviceId:(NSString *)deviceId
                      success:(ThingSuccessHandler)success
                      failure:(ThingFailureError)failure;
- (void)removeDeviceWithDeviceId:(NSString *)deviceId
                          success:(ThingSuccessHandler)success
                          failure:(ThingFailureError)failure;
- (void)addGroupWithGroupId:(NSString *)groupId
                    success:(ThingSuccessHandler)success
                    failure:(ThingFailureError)failure;
- (void)removeGroupWithGroupId:(NSString *)groupId
                       success:(ThingSuccessHandler)success
                       failure:(ThingFailureError)failure;
- (void)saveBatchRoomRelationWithDeviceGroupList:(NSArray <NSString *> *)deviceGroupList
                                         success:(ThingSuccessHandler)success
                                         failure:(ThingFailureError)failure;
```

### C. Member + transfer owner
```objc
// ThingSmartHome
- (void)getHomeMemberListWithSuccess:(void(^)(NSArray <ThingSmartHomeMemberModel *> *memberList))success
                              failure:(ThingFailureError)failure;
- (void)addHomeMemberWithAddMemeberRequestModel:(ThingSmartHomeAddMemberRequestModel *)requestModel
                                        success:(ThingSuccessDict)success
                                        failure:(ThingFailureError)failure;
- (void)removeHomeMemberWithMemberId:(long long)memberId
                              success:(ThingSuccessHandler)success
                              failure:(ThingFailureError)failure;
- (void)updateHomeMemberInfoWithMemberRequestModel:(ThingSmartHomeMemberRequestModel *)memberRequestModel
                                           success:(ThingSuccessHandler)success
                                           failure:(ThingFailureError)failure;
// Người được mời chấp nhận/từ chối (khi autoAccept=NO)
- (void)joinFamilyWithAccept:(BOOL)accept
                     success:(ThingSuccessBOOL)success
                     failure:(ThingFailureError)failure;

// Transfer owner (xác minh trên API reference)
- (void)transferHomeWithMemberId:(long long)memberId       // ThingSmartHome / ThingSmartHomeMember
                         success:(ThingSuccessHandler)success
                         failure:(ThingFailureError)failure;
```
> iOS có **API legacy** add member kiểu cũ vẫn còn trong reference:
> `addHomeMemberWithName:headPic:countryCode:userAccount:role:success:failure:` và biến thể `...isAdmin:...`.

### D. Biz/CoreKit (iOS) - thay thế hiện đại (observer-based)
```objc
// Singletons: ThingSmartFamilyBiz / ThingSmartRoomBiz / ThingSmartMemberBiz
[ThingSmartFamilyBiz.sharedInstance getFamilyListWithSuccess:failure:];
[ThingSmartRoomBiz.sharedInstance getRoomListWithHomeId:success:failure:];
[ThingSmartRoomBiz.sharedInstance addHomeRoomWithName:homeId:success:failure:];
[ThingSmartRoomBiz.sharedInstance removeHomeRoomWithRoomId:homeId:success:failure:];
[ThingSmartRoomBiz.sharedInstance updateHomeRoomWithName:roomId:homeId:success:failure:];
[ThingSmartRoomBiz.sharedInstance sortRoomList:homeId:success:failure:];
[ThingSmartMemberBiz.sharedInstance getHomeMemberListWithHomeId:success:failure:];
[ThingSmartMemberBiz.sharedInstance addHomeMemberWithModel:homeId:success:failure:];
[ThingSmartMemberBiz.sharedInstance transferHomeWithMemberId:success:failure:];
// đăng ký quan sát thay đổi: addObserver: / removeObserver: + delegate Biz tương ứng
```

---

## Bean/Callback/Listener

### HomeBean / ThingSmartHomeModel
| Field | Ý nghĩa |
|---|---|
| `homeId` (long) | id home |
| `name`, `geoName` | tên + tên vị trí |
| `lon`/`lat` (`longitude`/`latitude` iOS) | toạ độ (cần cho weather) |
| `role` | quyền: **2 owner / 1 admin / 0 member / -1 custom / -999 invalid** |
| `admin` (bool) | có phải admin |
| `homeStatus` / `dealStatus` | trạng thái mời: **1 pending / 2 accepted / 3 rejected** |
| `rooms` (List<RoomBean>/`roomList`) | phòng |
| `deviceList`, `groupList`, `meshList`, `sharedDeviceList`, `sharedGroupList` | tài nguyên (chỉ có sau getHomeDetail/getHomeData) |

### RoomBean / ThingSmartRoomModel
`roomId` (long), `name`, `iconUrl`, `displayOrder`, `deviceList`, `groupList`.

### MemberBean / ThingSmartHomeMemberModel
`memberId` (long), `account`, `nickName`/`name`, `admin` (bool), `headPic`, `role` (int), `memberStatus`/`dealStatus` (1 pending/2 accepted/3 rejected), `invitationCode`, `mobile`.

### MemberWrapperBean (Android, input add/update) / ThingSmartHomeAddMemberRequestModel (iOS)
`homeId`, `nickName`/`name`, `account`, `countryCode`, `role` (int / `ThingHomeRoleType`), `headPic`, `admin` (bool, Android), `autoAccept` (bool).
- iOS `ThingSmartHomeMemberRequestModel`: dùng cho **update** member đã có.

### WeatherBean / ThingSmartWeatherSketchModel + DashBoardBean / ThingSmartWeatherModel
Sketch: `condition`, `temp`, `iconUrl`, `inIconUrl`. Detail: mảng theo ngày (`DashBoardBean`).

### Role enum
- Android: int - **2 owner, 1 admin, 0 member, -1 custom, -999 invalid**.
- iOS: `ThingHomeRoleType_Owner`, `ThingHomeRoleType_Admin`, common member (+ custom).

### Listener / Delegate

**Android - IThingHomeChangeListener** (đăng ký ở **HomeManager**):
```java
public interface IThingHomeChangeListener {
    void onHomeAdded(long homeId);
    void onHomeInvite(long homeId, String homeName);     // <-- được mời vào home
    void onHomeRemoved(long homeId);
    void onHomeInfoChanged(long homeId);                 // tên/geo/room đổi
    void onSharedDeviceList(List<DeviceBean> sharedDeviceList);
    void onSharedGroupList(List<GroupBean> sharedGroupList);
    void onServerConnectSuccess();
}
```

**Android - IThingHomeStatusListener** (đăng ký ở **newHomeInstance(homeId)**):
```java
public interface IThingHomeStatusListener {
    void onDeviceAdded(String devId);
    void onDeviceRemoved(String devId);
    void onGroupAdded(long groupId);
    void onGroupRemoved(long groupId);
    void onMeshAdded(String meshId);
}
```

**Callback chính (Android):**
- `IThingHomeResultCallback` - `onSuccess(HomeBean)`, `onError(String code, String msg)`
- `IThingGetHomeListCallback` - `onSuccess(List<HomeBean>)`, `onError(...)`
- `IThingRoomResultCallback` - `onSuccess(RoomBean)`, `onError(...)`
- `IThingGetMemberListCallback` - `onSuccess(List<MemberBean>)`, `onError(...)`
- `IThingDataCallback<T>` / `IResultCallback` - generic / void
- `IIGetHomeWetherSketchCallBack` - `onSuccess(WeatherBean)`, `onFailure(...)`
- `IGetHomeWetherCallBack` - `onSuccess(ArrayList<DashBoardBean>)`, `onFailure(...)`
- Biz: `IFamilyDataCallback<T>`, `IFamilyMemberDataCallback<T>`, `IFamilyMemberResultCallback`

**iOS - delegate:**
- `ThingSmartHomeManagerDelegate`: `homeManager:didAddHome:`, `homeManager:didRemoveHome:`, `homeManagerDidUpdateInfo:`, `homeManager:didShareDeviceList:`, `homeManager:didDeshareDeviceList:` (theo dõi danh sách home).
- `ThingSmartHomeDelegate`: cập nhật trong 1 home - `home:didUpdateInfo:`, `homeDidUpdateInfo:`, `home:didAddDeivce:`/`home:didRemoveDeivce:`, `home:didAddRoom:`/`home:didRemoveRoom:`, `home:roomListDidUpdate:`/`home:didUpdateRoomInfo:`, `home:didAddMember:`/`home:didRemoveMember:`/`home:didUpdateMemberInfo:`, `home:didUpdateSharedInfo:` (tên method cần verify verbatim ở reference khi code - xem Câu hỏi mở).
- iOS callback block typedef: `ThingSuccessHandler`, `ThingSuccessBOOL`, `ThingSuccessDict`, `ThingSuccessLongLong`, `ThingFailureError`.

---

## Mã lỗi liên quan
Dùng chung bảng error code SDK (xem note nền tảng). Liên quan trực tiếp khu vực này:
| Code | Ý nghĩa | Xử lý |
|---|---|---|
| `-1` | SDK chưa init | đảm bảo `initSdk()` trước mọi call |
| `-5` | Param invalid | kiểm tra homeId/memberId/role, countryCode, account |
| `BIZ_*` / HTTP business | "no permission" khi non-owner gọi dismiss/transfer/addMember | kiểm tra `role==2` trước khi cho phép thao tác |
| invite code expired | mã mời hết hạn | `reInviteMember`/`getInvitationMessage` lấy mã mới |
> Doc **không có code riêng** cho "member đã tồn tại" / "transfer cho non-member" → xử lý qua message trả về trong `onError`. Nguồn error code: https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6nxw2k97l8a

---

## Cạm bẫy
1. **Quên `getHomeDetail`/`getHomeData`** → `deviceList`/`roomList`/`memberList` rỗng dù home có dữ liệu. Luôn gọi trước khi render.
2. **Nhầm 2 instance**: `getHomeManagerInstance()` (list + IThingHomeChangeListener) vs `newHomeInstance(homeId)` (detail/update/dismiss/room + IThingHomeStatusListener). Đăng ký listener sai chỗ ⇒ không nhận event.
3. **Permission**: chỉ **owner (role 2)** mới `dismissHome` / `transferOwner` / thêm admin; **admin** chỉ thêm member thường. Kiểm tra role ở UI để tránh `no permission` error xấu.
4. **transferOwner** chỉ chuyển cho **member đã có trong home** (mời trước, đợi accept), không truyền account lạ. Sau transfer, app hiện tại mất quyền owner → cần refresh `queryHomeList`/role.
5. **autoAccept=false** mà quên `processInvitation`/`joinFamilyWithAccept` ⇒ member kẹt ở pending, không điều khiển được thiết bị.
6. **Weather cần lat/lon hợp lệ** trên home; `createHome`/`updateHome` set toạ độ 0,0 ⇒ weather trả rỗng. Với ice-bath, weather là tính năng phụ (nhiệt độ ngoài trời) - set optional.
7. **2 thế hệ API**: tránh trộn lẫn classic listener (`IThingHomeChangeListener`) với observer Biz (`addObserver:`) cùng lúc cho cùng việc - chọn 1 đường nhất quán. Transfer owner Android nên đi **Biz** vì classic không expose verbatim.
8. **Thứ tự role**: trang Biz mới mô tả role text dễ gây nhầm (ghi 0=owner). **Chuẩn theo classic + HomeBean.role: 2 = owner.** Đừng hardcode theo trang Biz.
9. **iconUrl room/weather là URL ảnh** → cần tải qua HTTP, không phải resource local.
10. **`dismissHome` xoá toàn bộ home + quan hệ thiết bị** → với app 1-home/user, nên gọi rất hạn chế (vd reset tài khoản), có xác nhận 2 bước.

---

## Đề xuất API TurboModule

Map vào lib `@jimmy-vu/react-native-turbo-tuya`. Phần lớn nằm trong **`TuyaHome`** (mở rộng module home đã có); tách **member** sang module mới **`TuyaMember`** cho gọn nếu surface lớn. Events đẩy qua emitter chung.

### Mở rộng `TuyaHome`
```ts
// Home update / dismiss / detail
updateHome(homeId: number, info: {
  name: string; geoName?: string; lat?: number; lon?: number; rooms?: string[];
}): Promise<void>;
dismissHome(homeId: number): Promise<void>;
getHomeDetail(homeId: number): Promise<HomeDetail>;   // {home, rooms, devices, groups, members?}

// Weather (optional cho ice-bath)
getHomeWeatherSketch(homeId: number): Promise<{ condition: string; temp: string; iconUrl: string }>;
getHomeWeatherDetail(homeId: number, limit: number, unit?: {
  tempUnit?: string; pressureUnit?: string; windspeedUnit?: string;
}): Promise<WeatherDay[]>;

// Transfer owner (đi Biz trên Android, transferHomeWithMemberId trên iOS)
transferHomeOwner(homeId: number, memberId: number): Promise<void>;

// Room
addRoom(homeId: number, name: string): Promise<RoomResult>;          // {roomId, name}
updateRoom(roomId: number, name: string): Promise<void>;
removeRoom(homeId: number, roomId: number): Promise<void>;
sortRooms(homeId: number, roomIdOrder: number[]): Promise<void>;
addDeviceToRoom(roomId: number, devId: string): Promise<void>;
removeDeviceFromRoom(roomId: number, devId: string): Promise<void>;
getDeviceRoom(devId: string): Promise<RoomResult | null>;

// Listener cấp manager + cấp home (bật/tắt push event lên JS)
startHomeChangeListener(): Promise<void>;   // map IThingHomeChangeListener / ThingSmartHomeManagerDelegate
stopHomeChangeListener(): Promise<void>;
startHomeStatusListener(homeId: number): Promise<void>;  // map IThingHomeStatusListener / ThingSmartHomeDelegate
stopHomeStatusListener(homeId: number): Promise<void>;
```

### Module mới `TuyaMember` (member + invitation)
```ts
queryMembers(homeId: number): Promise<Member[]>;          // {memberId, account, name, role, admin, status}
addMember(homeId: number, req: {
  account: string; countryCode: string; name?: string;
  role?: number; admin?: boolean; autoAccept?: boolean;
}): Promise<Member>;
updateMember(homeId: number, memberId: number, changes: {
  name?: string; admin?: boolean; role?: number;
}): Promise<void>;
removeMember(homeId: number, memberId: number): Promise<void>;

// Mời theo invite code
createInvitation(homeId: number): Promise<{ invitationId: number; code: string }>;
reInvite(invitationId: number): Promise<{ invitationId: number; code: string }>;
cancelInvitation(invitationId: number): Promise<void>;
joinHomeByCode(code: string): Promise<void>;
processInvitation(homeId: number, accept: boolean): Promise<void>;   // iOS joinFamilyWithAccept
```

### Events (qua `NativeEventEmitter`)
```ts
type HomeEvent =
  | { type: 'homeAdded'; homeId: number }
  | { type: 'homeInvite'; homeId: number; homeName: string }
  | { type: 'homeRemoved'; homeId: number }
  | { type: 'homeInfoChanged'; homeId: number }
  | { type: 'deviceAdded'; homeId: number; devId: string }
  | { type: 'deviceRemoved'; homeId: number; devId: string }
  | { type: 'memberChanged'; homeId: number }
  | { type: 'sharedDeviceList'; devIds: string[] };
// emitter name gợi ý: 'TuyaHomeChange'
```
**Platform notes:**
- **Android**: `updateHome` có 2 overload (có/không `rooms`); weather truyền `lon,lat` tay (lấy từ HomeBean). transferOwner đi **FamilyManagerCoreKit.getFamilyUseCase().transferOwner**. Listener: `IThingHomeChangeListener` (manager) + `IThingHomeStatusListener` (home).
- **iOS**: weather là method trên `ThingSmartHome` (tự dùng lat/lon của home, không cần truyền). `processInvitation` map sang `joinFamilyWithAccept:`. transferOwner = `transferHomeWithMemberId:`. Listener map sang delegate `ThingSmartHomeManagerDelegate`/`ThingSmartHomeDelegate` (hoặc Biz observer).
- Role: chuẩn hoá về **số** ở TS (2 owner / 1 admin / 0 member); native iOS convert sang `ThingHomeRoleType`.

---

## Câu hỏi mở / cần xác minh trên thiết bị
- **transferOwner Android classic**: `IThingHomeMember` có method transfer verbatim không, hay BẮT BUỘC dùng Biz `FamilyManagerCoreKit`? (hiện chốt: dùng Biz). Cần mở API reference Android trực tiếp khi code.
- **ThingSmartHomeDelegate method names verbatim** (didAddRoom/didRemoveMember…): WebFetch tóm tắt, cần đối chiếu trang reference iOS chính xác khi implement listener.
- **`transferHomeWithMemberId:`** nằm trên `ThingSmartHome` hay chỉ `ThingSmartHomeMember`/`ThingSmartMemberBiz`? Reference liệt kê ở Member/Biz - verify khi gọi.
- **Enum `ThingHomeRoleType`** đủ case (có `_CustomAdmin`/`_Member` không) - xác minh ở header iOS.
- **`role` vs `admin`** khi addMember: dùng `role` (int) hay `admin` (bool) là chuẩn mới? (doc có cả hai; ưu tiên `role`).
- **Giới hạn**: tối đa 200 phòng/home (doc iOS) - Android giới hạn? Số member tối đa? - cần verify.
- App ice-bath **1 home/user**: có thực sự cần member/transfer/room đầy đủ, hay chỉ cần updateHome + (optional) member chia sẻ điều khiển? Chốt scope với client trước khi implement đủ surface.

---

## Nguồn (URL đã đọc)
- Home Information Management (Android) - https://developer.tuya.com/en/docs/app-development/familyrelations?id=Ka6ki8h2c2yo5
- Room Information Management (Android) - https://developer.tuya.com/en/docs/app-development/room-information-management?id=Kaiy7xla9is7e
- Member Information Management (Android) - https://developer.tuya.com/en/docs/app-development/member-information-management?id=Kaiy91tma26nh
- Home Member Management (Biz/CoreKit, đa nền tảng) - https://developer.tuya.com/en/docs/app-development/extension-family-member?id=Kcy2iwdhz60pm
- Home Management (overview Biz) - https://developer.tuya.com/en/docs/app-development/extension-family?id=Kcy2dmezshowh
- Room Information Management (Biz) - https://developer.tuya.com/en/docs/app-development/extension-family-room?id=Kcy2jnt10jk0s
- Home Information Management (iOS) - https://developer.tuya.com/en/docs/app-development/iOS_family?id=Kaixeor409hck
- Room Information Management (iOS) - https://developer.tuya.com/en/docs/app-development/iOS-room?id=Kaixll0l9ue4t
- Member Information Management (iOS) - https://developer.tuya.com/en/docs/app-development/iOS-family-member?id=Kaixlyjh6uer8
- iOS Home SDK API Reference (functions) - https://tuya.github.io/tuyasmart_home_ios_sdk_api_reference/functions_func_a.html
- iOS Home SDK API Reference (functions 't' / transfer) - https://tuya.github.io/tuyasmart_home_ios_sdk_api_reference/functions_func_t.html
- Transfer home ownership (FAQ) - https://support.tuya.com/en/help/_detail/K9hrartu9hn2a
- Error Codes - https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6nxw2k97l8a
