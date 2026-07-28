import Link from 'next/link';
import { apiGet } from '@/lib/api';
import OnlineChip from '@/components/OnlineChip';

export const dynamic = 'force-dynamic';

// Khớp AdminDeviceListItem của backend (apps/backend/src/devices/devices.service.ts).
type DeviceRow = {
  id: string;
  name: string;
  online: boolean;
  productId?: string;
  ownerUid: string;
  ownerName?: string;
  currentTemp: number | null;
  targetTemp: number | null;
};

const fmtTemp = (t: number | null): string => (t == null ? '—' : `${t}°`);

export default async function DevicesPage() {
  // Lỗi tải (backend down / Tuya) → hiện empty-state, không nổ cả trang.
  const devices = await apiGet<DeviceRow[]>('/admin/devices').catch(() => null);

  return (
    <main>
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Devices</h1>
        <p className="page-sub">
          All ice baths across every user · live status &amp; control via Tuya Cloud API
        </p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Device</th>
            <th>Owner</th>
            <th>Status</th>
            <th className="num">Current</th>
            <th className="num">Target</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {devices === null ? (
            <tr>
              <td colSpan={6} className="muted">
                Couldn&apos;t load devices - check that the backend is running and Tuya Cloud creds are set.
              </td>
            </tr>
          ) : devices.length === 0 ? (
            <tr>
              <td colSpan={6} className="muted">
                No devices found on any user account.
              </td>
            </tr>
          ) : (
            devices.map((d) => (
              <tr key={d.id}>
                <td>
                  <div className="cell-main">
                    <Link href={`/devices/${d.id}`}>{d.name || 'Device'}</Link>
                  </div>
                  <div className="cell-sub" title={d.id}>
                    {d.id}
                  </div>
                </td>
                <td>
                  <Link href={`/users/${d.ownerUid}`}>{d.ownerName || d.ownerUid}</Link>
                </td>
                <td>
                  <OnlineChip online={d.online} />
                </td>
                <td className="num">{fmtTemp(d.currentTemp)}</td>
                <td className="num">{fmtTemp(d.targetTemp)}</td>
                <td>
                  <Link href={`/devices/${d.id}`}>Control</Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </main>
  );
}
