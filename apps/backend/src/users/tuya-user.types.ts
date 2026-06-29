// Shape response Tuya Cloud user-management (xem docs/research/tuya-cloud-user-management.md)

export type TuyaUserListItem = {
  uid: string;
  username?: string;
  email?: string;
  mobile?: string;
  country_code?: string;
  create_time?: number;
  update_time?: number;
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
