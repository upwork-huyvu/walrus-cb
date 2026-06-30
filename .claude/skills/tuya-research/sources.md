# Tuya doc source map (curated)

Entry points for `tuya-research`. This is an **RN CLI** app bridging **both**
native SDKs, so research both iOS and Android for any topic.

- ✅ = fetched & confirmed reachable in this session.
- 🔗 = official link extracted from a confirmed overview page (fetch on demand).
- Base: `https://developer.tuya.com/en/docs/app-development/`

## Top-level entry points
| Platform | Page | URL |
|---|---|---|
| Android | Feature overview (START HERE) | ✅ https://developer.tuya.com/en/docs/app-development/featureoverview?id=Ka69nt97vtsfu |
| iOS | Feature overview (START HERE) | ✅ https://developer.tuya.com/en/docs/app-development/feature-overview?id=Ka5cgmlybhjk8 |

## Android sub-docs
| Topic | URL |
|---|---|
| Fast Integration | 🔗 https://developer.tuya.com/en/docs/app-development/integrated |
| Quick Start (Android) | 🔗 https://developer.tuya.com/en/docs/app-development/tutorial-for-android-final |
| **Home SDK (Android)** — pairing/control/home | 🔗 https://developer.tuya.com/en/docs/app-development/android-home-sdk-dir |
| BizBundle SDK | 🔗 https://developer.tuya.com/en/docs/app-development/extension-sdk |
| UI BizBundle | 🔗 https://developer.tuya.com/en/docs/app-development/introduction |

## iOS sub-docs
| Topic | URL |
|---|---|
| What is app development (overview) | 🔗 https://developer.tuya.com/en/docs/app-development/What-is-app-development |
| Fast Integration | 🔗 https://developer.tuya.com/en/docs/app-development/integrate-sdk |
| Quick Start (iOS) | 🔗 https://developer.tuya.com/en/docs/app-development/tutorial-for-ios-final |
| **Home SDK (iOS)** — pairing/control/home | 🔗 https://developer.tuya.com/en/docs/app-development/ios-home-sdk-dir |
| Upgrade Guide | 🔗 https://developer.tuya.com/en/docs/app-development/migration_guide |
| Privacy Manifest (iOS) | 🔗 https://developer.tuya.com/en/docs/app-development/PrivacyInfo |

## Capability areas (confirmed on both overview pages)
- **User Account Management** — register/login (email/phone), reset password,
  session expiration.
- **Home Management** — homes & rooms, sharing, member/owner roles.
- **Device Operations** — pair, control, report status, groups, scheduled tasks,
  firmware (OTA).

## Priority topics for this project (map to milestones)
1. SDK init + **Data Center/region** config + AppKey/AppSecret (M1) — region MUST
   match the Cloud Project's Data Center.
2. Login / session (M1) — reconcile with app auth (Supabase Email/Google/Apple).
3. Home management + **Owner permission** required for SDK linking (M1).
4. **Device pairing**: Wi-Fi EZ + AP fallback, pairing **token & expiry**, 2.4GHz;
   **BLE / dual-mode** pairing (M1).
5. **Device control & status via DP** (data points) → ice-bath functions: current
   temp, target temp, light, UV sterilize, defrost, power (M1–M2).
6. **Error codes** for pairing/control (cross-cutting).
7. OTA firmware (optional, later).

> When you discover a deeper page (e.g. the exact "device pairing" or "DP control"
> URL under a Home SDK dir, or an error-code reference), add it here with the
> topic, and upgrade 🔗 → ✅ once you've fetched it.

## Deep pages confirmed ✅ (M1 foundation — 2026-06-28)
Note: [docs/research/tuya-m1-sdk-foundation.md](../../../docs/research/tuya-m1-sdk-foundation.md)
| Topic | URL |
|---|---|
| Android Fast Integration (gradle 7.5.6, security-algorithm.aar, manifest keys) | ✅ https://developer.tuya.com/en/docs/app-development/integrated?id=Ka69nt96cw0uj |
| iOS Fast Integration (pods, ios_core_sdk.tar.gz, startWithAppKey) | ✅ https://developer.tuya.com/en/docs/app-development/integrate-sdk?id=Ka5d52ewngdoi |
| Preparation (create App SDK, package/bundle, SHA-256) | ✅ https://developer.tuya.com/en/docs/app-development/preparation?id=Ka69nt983bhh5 |
| **Data Center mappings** (EU=Western Europe, launched 2025-11-25) | ✅ https://developer.tuya.com/en/docs/iot/oem-app-data-center-distributed?id=Kafi0ku9l07qb |
| Third-party login (thirdLogin: gg/ap/fb, idToken) | ✅ https://developer.tuya.com/en/docs/app-development/userthirdlogin?id=Ka6a9oalounvd |
| Email register/login (sendVerifyCodeWithUserName, loginWithEmail) | ✅ https://developer.tuya.com/en/docs/app-development/useremail?id=Ka6a99luv3tr1 |
| Home Information Management (createHome, role==2 owner) | ✅ https://developer.tuya.com/en/docs/app-development/familyrelations?id=Ka6ki8h2c2yo5 |
| Wi-Fi EZ Mode (getActivatorToken 10min, ActivatorBuilder TY_EZ) | ✅ https://developer.tuya.com/en/docs/app-development/quick-connection-mode?id=Kaixju76a5iq9 |
| Wi-Fi AP Mode | 🔗 https://developer.tuya.com/en/docs/app-development/hotspot-mode?id=Kceugwuabayha |
| Device Pairing (iOS, ThingSmartActivator) | ✅ https://developer.tuya.com/en/docs/app-development/activator?id=Ka5cgmlzpfig4 |
| Bluetooth LE pairing (Android, startLeScan + BleActivatorBean) | ✅ https://developer.tuya.com/en/docs/app-development/android-bluetooth-ble?id=Karv7r2ju4c21 |
| Bluetooth Pairing (combo) | 🔗 https://developer.tuya.com/en/docs/app-development/ble_activator?id=Kdljgsdlp1f7z |
| Device Control (Android, publishDps + IDevListener.onDpUpdate) | ✅ https://developer.tuya.com/en/docs/app-development/andoird_device_control?id=Kaixh4pfm8f0y |
| Error Codes (-33/-55/-56/-1400...) | ✅ https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6nxw2k97l8a |
| Privacy Manifest (iOS) | 🔗 https://developer.tuya.com/en/docs/app-development/PrivacyInfo?id=Kdgwv9p6ual8m |
| Matter pairing (iOS, unified ThingSmartActivatorDiscovery) | ✅ https://developer.tuya.com/en/docs/app-development/activator_matter_ios?id=Kcy5lrzc7s20k |
| SIG Mesh (iOS, ThingSmartBleMesh/ThingSmartSIGMeshManager) | ✅ https://developer.tuya.com/en/docs/app-development/sigmesh?id=Ka5vdjp2tlb23 |
| Tuya Mesh (iOS, ThingSmartBleMesh/ThingBLEMeshManager) | ✅ https://developer.tuya.com/en/docs/app-development/mesh?id=Ka5vdjp3ikagz |

## Cloud OpenAPI — App Push Notification (server→user) confirmed ✅ (2026-06-30)
Note: [docs/research/tuya-cloud-app-push.md](../../../docs/research/tuya-cloud-app-push.md)
Khác với App SDK ở trên — đây là **Cloud OpenAPI** (backend gọi, target theo `uid`).
| Topic | URL |
|---|---|
| Mobile Push Notification Service (mục lục 4 endpoint) | ✅ https://developer.tuya.com/en/docs/cloud/app-push?id=Kaiuye3tb3yho |
| Send Push to App (`POST .../app-notifications/actions/push`) | ✅ https://developer.tuya.com/en/docs/cloud/571df1f27e?id=Kagp27bb0hkxe |
| Add template (`POST .../msg-templates/app-notifications`, name/title/content/type/remark) | ✅ https://developer.tuya.com/en/docs/cloud/db8cac79e4?id=Kagp29fdj4yse |
| List templates (`GET .../msg-templates/app-notifications`) | ✅ https://developer.tuya.com/en/docs/cloud/d42a2cefb7?id=Kaio7tuala794 |
| Subscription & Template (subscribe product + duyệt ≤2 ngày, biz_type) | ✅ https://developer.tuya.com/en/docs/iot/app-push-notification?id=Kaiuyyn5po2kw |
| Configure Placeholders (`${var}` / `${dp**}`) | ✅ https://developer.tuya.com/en/docs/iot/message-push-Placeholder?id=Kby77w6kmpfdt |

## How to find a deep page you don't have
`WebSearch` with `allowed_domains: ["developer.tuya.com"]`, e.g.
`tuya home sdk android device pairing EZ mode token`, or
`tuya ios sdk publish dps device control`. Prefer the specific page over an
overview's paraphrase for exact API signatures.
