import Link from 'next/link';
import { apiGet } from '@/lib/api';
import DeviceControlPanel, { type DeviceDetail } from '@/components/DeviceControlPanel';

export const dynamic = 'force-dynamic';

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const device = await apiGet<DeviceDetail>(`/admin/devices/${id}`).catch(() => null);

  return (
    <main>
      <div style={{ marginBottom: 8 }}>
        <Link href="/devices">← Back to devices</Link>
      </div>

      {device === null ? (
        <p className="muted">
          Couldn&apos;t load this device from Tuya - it may be unavailable or the backend/creds need checking.
        </p>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <h1 className="page-title">{device.name || 'Device'}</h1>
            <p className="page-sub" title={device.id}>
              {device.id} · control via Tuya Cloud API
            </p>
          </div>
          <DeviceControlPanel device={device} />
        </>
      )}
    </main>
  );
}
