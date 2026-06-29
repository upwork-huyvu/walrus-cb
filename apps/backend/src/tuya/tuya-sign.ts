import { createHash, createHmac, randomUUID } from 'node:crypto';

// Ký request Tuya Cloud OpenAPI (HMAC-SHA256).
// Spec: docs/research/tuya-cloud-openapi-signing.md

/** SHA256 của body rỗng (hằng số Tuya). */
export const EMPTY_BODY_SHA256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function contentSha256(body?: string): string {
  return body ? sha256Hex(body) : EMPTY_BODY_SHA256;
}

/** path + query đã sort alphabet theo key (yêu cầu khi ký). */
export function buildSignUrl(
  path: string,
  query?: Record<string, string | number | undefined>,
): string {
  if (!query) return path;
  const entries = Object.entries(query).filter(
    (e): e is [string, string | number] => e[1] !== undefined,
  );
  if (entries.length === 0) return path;
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const qs = entries.map(([k, v]) => `${k}=${v}`).join('&');
  return `${path}?${qs}`;
}

/** stringToSign = METHOD\n Content-SHA256\n Signature-Headers\n URL */
export function buildStringToSign(
  method: string,
  signUrl: string,
  body?: string,
  signatureHeaders = '',
): string {
  return [
    method.toUpperCase(),
    contentSha256(body),
    signatureHeaders,
    signUrl,
  ].join('\n');
}

export type SignInput = {
  clientId: string;
  secret: string;
  t: string; // timestamp ms (13 chữ số)
  nonce: string;
  stringToSign: string;
  /** Có giá trị = business request; bỏ trống = token request. */
  accessToken?: string;
};

/**
 * sign = UPPERCASE(HMAC_SHA256(str, secret))
 * - token:    str = clientId + t + nonce + stringToSign
 * - business: str = clientId + accessToken + t + nonce + stringToSign
 */
export function calcSign(input: SignInput): string {
  const { clientId, secret, t, nonce, stringToSign, accessToken } = input;
  const str = accessToken
    ? clientId + accessToken + t + nonce + stringToSign
    : clientId + t + nonce + stringToSign;
  return createHmac('sha256', secret)
    .update(str, 'utf8')
    .digest('hex')
    .toUpperCase();
}

export function nowTimestamp(): string {
  return Date.now().toString();
}

export function newNonce(): string {
  return randomUUID();
}
