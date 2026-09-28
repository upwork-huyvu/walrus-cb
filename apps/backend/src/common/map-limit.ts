/**
 * `Promise.all` có TRẦN song song.
 *
 * Dùng cho các vòng gọi Tuya Cloud theo từng uid/thiết bị: bắn hết cùng lúc thì dễ dính rate
 * limit, mà chạy tuần tự thì chậm tuyến tính theo số phần tử.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}
