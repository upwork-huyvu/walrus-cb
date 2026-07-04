// Kiểu dữ liệu trả về từ Tuya Cloud App Push API.
// Một số cấu trúc bao ngoài (list, trạng thái duyệt) chưa xác minh trên data thật
// → để mềm (optional + index signature), siết lại khi có response thực tế.

/** Kết quả gửi push: POST /v1.0/iot-03/messages/app-notifications/actions/push */
export type TuyaPushResult = {
  send_status: boolean;
};

/** Kết quả 1 push trong batch (per-uid). */
export type PushResultItem = {
  uid: string;
  ok: boolean;
  error?: string;
};

/** Tổng hợp gửi push (1 hoặc nhiều uid / tất cả). Tuya loop per-uid → aggregate. */
export type PushBatchResult = {
  total: number;
  success: number;
  failed: number;
  results: PushResultItem[];
};

/** Kết quả tạo template: POST /v1.0/iot-03/msg-templates/app-notifications */
export type TuyaCreateTemplateResult = {
  template_id: string;
};

/** Trạng thái duyệt template (doc 9dc9d8c906): 0 = đang duyệt · 1 = pass · 2 = fail. */
export type TuyaTemplateStatus = 0 | 1 | 2;

/** 1 template thông báo (chi tiết/danh sách). */
export type TuyaTemplate = {
  template_id: string;
  name?: string;
  title?: string;
  content?: string;
  type?: number;
  status?: TuyaTemplateStatus;
  /** Chỉ có ở endpoint detail khi status=2 (bị từ chối). */
  verify_code?: number;
  verify_reason?: string;
  [key: string]: unknown;
};

/** Danh sách template: GET /v1.0/iot-03/msg-templates/app-notifications (phân trang). */
export type TuyaTemplateList = {
  list?: TuyaTemplate[];
  total?: number;
  has_more?: boolean;
  [key: string]: unknown;
};
