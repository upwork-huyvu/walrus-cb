// Shape response Tuya Cloud user-management (xem docs/research/tuya-cloud-user-management.md)

export type TuyaUserListItem = {
  uid: string;
  username?: string;
  email?: string;
  mobile?: string;
  country_code?: string;
  create_time?: number;
  update_time?: number;
  // 2 field dưới KHÔNG có trong response list của Tuya - service enrich từ endpoint detail.
  nick_name?: string;
  avatar?: string;
};

export type TuyaUserListResult = {
  list?: TuyaUserListItem[];
  total?: number;
  has_more?: boolean;
};

export type TuyaUserInfo = {
  uid: string;
  username?: string;
  country_code?: string;
  mobile?: string;
  email?: string;
  nick_name?: string;
  avatar?: string;
  create_time?: number;
  update_time?: number;
  time_zone_id?: string;
  temp_unit?: number;
};

export type TuyaUserDeviceStatus = { code: string; value: unknown };

/**
 * Thiết bị của user: GET /v1.0/users/{uid}/devices (result = mảng device trực tiếp).
 * `local_key` là secret - service lược bỏ trước khi trả về FE, KHÔNG khai báo ở đây.
 */
export type TuyaUserDevice = {
  id: string;
  uuid?: string;
  uid?: string;
  name?: string;
  online?: boolean;
  product_id?: string;
  product_name?: string;
  category?: string;
  icon?: string;
  ip?: string;
  status?: TuyaUserDeviceStatus[];
  create_time?: number;
  update_time?: number;
  active_time?: number;
  sub?: boolean;
  time_zone?: string;
};
