import Link from 'next/link';
import { apiGet } from '@/lib/api';
import DeleteButton from '@/components/DeleteButton';

export const dynamic = 'force-dynamic';

type DeviceMapping = { id: string; deviceId: string; homeId?: string | null };

type UserDetail = {
  uid: string;
  username?: string;
  email?: string;
  mobile?: string;
  country_code?: string;
  nick_name?: string;
  business?: { deviceMappings?: DeviceMapping[] };
};

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const u = await apiGet<UserDetail>(`/users/${uid}`);
  const devices = u.business?.deviceMappings ?? [];

  return (
    <main>
      <div className="bar">
        <h1 style={{ margin: 0, fontSize: 22 }}>Tuya user details</h1>
        <Link href="/users">← Back to list</Link>
      </div>

      <dl className="detail">
        <dt>UID (Tuya)</dt>
        <dd>{u.uid}</dd>
        <dt>Username</dt>
        <dd>{u.username ?? '—'}</dd>
        <dt>Nickname</dt>
        <dd>{u.nick_name ?? '—'}</dd>
        <dt>Email</dt>
        <dd>{u.email ?? '—'}</dd>
        <dt>Mobile</dt>
        <dd>{u.mobile ?? '—'}</dd>
        <dt>Country</dt>
        <dd>{u.country_code ?? '—'}</dd>
        <dt>Devices (business data)</dt>
        <dd>
          {devices.length === 0
            ? '—'
            : devices.map((d) => d.deviceId).join(', ')}
        </dd>
      </dl>

      <DeleteButton uid={u.uid} />
    </main>
  );
}
