import { z } from 'zod';

/**
 * Schema biến môi trường. Secret (service_role, Tuya Access Secret) chỉ ở server,
 * KHÔNG vào repo/bundle. Ở dev các secret là optional để app boot được mà chưa cần
 * điền; ở production thì bắt buộc (fail-fast).
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // --- Supabase / Postgres (Prisma) ---
  DATABASE_URL: z.string().url().optional(), // pooled (pgbouncer :6543?pgbouncer=true) cho runtime
  DIRECT_URL: z.string().url().optional(), // direct (:5432) cho prisma migrate
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(), // public key, dùng làm apikey cho Auth
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(), // SERVER-ONLY

  // --- Tuya Cloud OpenAPI (KHÁC AppKey/AppSecret của App SDK mobile) ---
  // Endpoint phải khớp Data Center của Cloud Project.
  // Cloud Project dự án = **Central Europe** (keys.txt) → openapi.tuyaeu.com.
  // (Western Europe = https://openapi-weaz.tuyaeu.com)
  TUYA_OPENAPI_ENDPOINT: z
    .string()
    .url()
    .default('https://openapi.tuyaeu.com'),
  TUYA_ACCESS_ID: z.string().min(1).optional(), // = client_id
  TUYA_ACCESS_SECRET: z.string().min(1).optional(), // = secret, SERVER-ONLY
  TUYA_APP_SCHEMA: z.string().min(1).optional(), // channel của App SDK (cho list users)
  TUYA_APP_BIZ_TYPE: z.coerce.number().int().optional(), // OVERRIDE tuỳ chọn - mặc định resolve runtime qua GET /v1.0/apps/{schema} (TuyaAppInfoService)
  TUYA_APP_TEMPLATE_ID: z.string().min(1).optional(), // template app-push đã duyệt (biến ${title}/${content}) - cho gửi free-form

  // --- Cron nội bộ (Vercel Cron gọi endpoint retry delete_jobs) ---
  CRON_SECRET: z.string().min(1).optional(), // SERVER-ONLY

  // --- Provider gửi thông báo: 'tuya' (Tuya App Push, cần template duyệt) | 'fcm' (Firebase, không cần) ---
  NOTIFICATION_PROVIDER: z.enum(['tuya', 'fcm']).default('tuya'),

  // --- Firebase Cloud Messaging (M3 push) - service account SERVER-ONLY ---
  FCM_PROJECT_ID: z.string().min(1).optional(),
  FCM_CLIENT_EMAIL: z.string().min(1).optional(),
  FCM_PRIVATE_KEY: z.string().min(1).optional(), // SERVER-ONLY (\n escaped trong env → un-escape lúc init)
  // API key tĩnh bảo vệ endpoint đăng ký token của mobile (MVP: tin uid từ app). SERVER + native config.
  PUSH_API_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

const PROD_REQUIRED: (keyof Env)[] = [
  'DATABASE_URL',
  'TUYA_ACCESS_ID',
  'TUYA_ACCESS_SECRET',
];

/** Dùng cho ConfigModule.forRoot({ validate }). Throw = boot fail (fail-fast). */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`❌ Biến môi trường không hợp lệ:\n${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    const missing = PROD_REQUIRED.filter((k) => !env[k]);
    if (missing.length > 0) {
      throw new Error(
        `❌ Thiếu env bắt buộc ở production: ${missing.join(', ')}`,
      );
    }
  }
  return env;
}
