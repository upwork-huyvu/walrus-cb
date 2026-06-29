import { createHmac } from 'node:crypto';
import {
  buildSignUrl,
  buildStringToSign,
  calcSign,
  contentSha256,
  EMPTY_BODY_SHA256,
  sha256Hex,
} from './tuya-sign';

describe('tuya-sign', () => {
  it('empty body SHA256 khớp hằng số Tuya', () => {
    expect(sha256Hex('')).toBe(EMPTY_BODY_SHA256);
    expect(contentSha256()).toBe(EMPTY_BODY_SHA256);
    expect(contentSha256(undefined)).toBe(EMPTY_BODY_SHA256);
  });

  it('contentSha256 cho body khác rỗng = sha256 của body', () => {
    const body = JSON.stringify({ a: 1 });
    expect(contentSha256(body)).toBe(sha256Hex(body));
    expect(contentSha256(body)).not.toBe(EMPTY_BODY_SHA256);
  });

  it('buildSignUrl sort query theo alphabet', () => {
    expect(
      buildSignUrl('/v1.0/users', { page_no: 1, last_id: 'z', a: 'x' }),
    ).toBe('/v1.0/users?a=x&last_id=z&page_no=1');
    expect(buildSignUrl('/v1.0/token', { grant_type: 1 })).toBe(
      '/v1.0/token?grant_type=1',
    );
    expect(buildSignUrl('/v1.0/ping')).toBe('/v1.0/ping');
  });

  it('buildStringToSign = METHOD\\n contentSha256\\n headers\\n url', () => {
    const url = '/v1.0/token?grant_type=1';
    expect(buildStringToSign('get', url)).toBe(
      `GET\n${EMPTY_BODY_SHA256}\n\n${url}`,
    );
  });

  it('calcSign token-style: clientId + t + nonce + stringToSign', () => {
    const clientId = 'cid';
    const secret = 'sec';
    const t = '1700000000000';
    const nonce = 'n-123';
    const stringToSign = buildStringToSign('GET', '/v1.0/token?grant_type=1');

    const expected = createHmac('sha256', secret)
      .update(clientId + t + nonce + stringToSign, 'utf8')
      .digest('hex')
      .toUpperCase();

    expect(calcSign({ clientId, secret, t, nonce, stringToSign })).toBe(
      expected,
    );
    expect(calcSign({ clientId, secret, t, nonce, stringToSign })).toMatch(
      /^[0-9A-F]{64}$/,
    );
  });

  it('calcSign business-style chèn accessToken sau clientId', () => {
    const clientId = 'cid';
    const secret = 'sec';
    const t = '1700000000000';
    const nonce = 'n-123';
    const accessToken = 'at-xyz';
    const stringToSign = buildStringToSign('GET', '/v1.0/users');

    const expected = createHmac('sha256', secret)
      .update(clientId + accessToken + t + nonce + stringToSign, 'utf8')
      .digest('hex')
      .toUpperCase();

    expect(
      calcSign({ clientId, secret, t, nonce, stringToSign, accessToken }),
    ).toBe(expected);
    // token-style và business-style phải khác nhau
    expect(calcSign({ clientId, secret, t, nonce, stringToSign })).not.toBe(
      expected,
    );
  });
});
