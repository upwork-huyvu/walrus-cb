import Link from 'next/link';
import { apiGet } from '@/lib/api';
import DeleteButton from '@/components/DeleteButton';
import { countryLabel, displayName, fmtEpoch, initialOf } from '@/lib/format';

export const dynamic = 'force-dynamic';

type DeviceMapping = { id: string; deviceId: string; homeId?: string | null };

type UserDetail = {
  uid: string;
  username?: string;
  email?: string;
  mobile?: string;
  country_code?: string;
  nick_name?: string;
  avatar?: string;
  create_time?: number;
  update_time?: number;
  time_zone_id?: string;
  temp_unit?: number;
  business?: { deviceMappings?: DeviceMapping[] };
};

type DeviceStatus = { code: string; value: unknown };

type TuyaDevice = {
  id: string;
  name?: string;
  online?: boolean;
  product_name?: string;
  category?: string;
  status?: DeviceStatus[];
  create_time?: number;
  update_time?: number;
  sub?: boolean;
};

// Tuya: 1 = Celsius, 2 = Fahrenheit
function tempUnit(u?: number): string | null {
  if (u === 1) return '°C';
  if (u === 2) return '°F';
  return null;
}

function Dash() {
  return <span className="muted">-</span>;
}

/** Tóm tắt vài DP đầu cho cột status: `code=value · ...` */
function statusSnapshot(status?: DeviceStatus[]): string {
  if (!status?.length) return '';
  return status
    .slice(0, 3)
    .map(
      (s) =>
        `${s.code}=${typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value)}`,
    )
    .join(' · ');
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const [u, devices] = await Promise.all([
    apiGet<UserDetail>(`/users/${uid}`),
    // Lỗi phía Tuya (quota, device kit chưa authorize...) không được làm sập cả trang user.
    apiGet<TuyaDevice[]>(`/users/${uid}/devices`).catch(() => null),
  ]);
  const mappings = u.business?.deviceMappings ?? [];
  const name = displayName(u);

  return (
    <main>
      <div className="bar">
        <div className="user-cell">
          <span className="avatar lg">
            {u.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={u.avatar} alt={name} />
            ) : (
              initialOf(name)
            )}
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>{name}</h1>
            <div className="cell-sub">{u.uid}</div>
          </div>
        </div>
        <Link href="/users">← Back to list</Link>
      </div>

      <dl className="detail">
        <dt>Username</dt>
        <dd>{u.username ?? <Dash />}</dd>
        <dt>Nickname</dt>
        <dd>{u.nick_name ?? <Dash />}</dd>
        <dt>Email</dt>
        <dd>{u.email ?? <Dash />}</dd>
        <dt>Mobile</dt>
        <dd>{u.mobile ?? <Dash />}</dd>
        <dt>Country</dt>
        <dd title={u.country_code ? `+${u.country_code}` : undefined}>
          {countryLabel(u.country_code) ?? <Dash />}
        </dd>
        <dt>Time zone</dt>
        <dd>{u.time_zone_id ?? <Dash />}</dd>
        <dt>Temperature unit</dt>
        <dd>{tempUnit(u.temp_unit) ?? <Dash />}</dd>
        <dt>Registered</dt>
        <dd>{fmtEpoch(u.create_time, true)}</dd>
        <dt>Last active (profile update)</dt>
        <dd>{fmtEpoch(u.update_time, true)}</dd>
        <dt>Device mappings (Supabase)</dt>
        <dd>
          {mappings.length === 0 ? (
            <Dash />
          ) : (
            mappings.map((d) => d.deviceId).join(', ')
          )}
        </dd>
      </dl>

      <h2 style={{ fontSize: 18, margin: '24px 0 10px' }}>
        Devices (Tuya){' '}
        {devices ? (
          <span className="muted" style={{ fontSize: 13 }}>
            · {devices.length}
          </span>
        ) : null}
      </h2>
      {devices === null ? (
        <p className="error">
          Couldn&apos;t load devices from Tuya - check that the Device
          Management API is authorized for this cloud project.
        </p>
      ) : devices.length === 0 ? (
        <p className="muted">No devices paired yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Device</th>
              <th>Product</th>
              <th>Online</th>
              <th>Status snapshot</th>
              <th>Paired</th>
              <th>Last update</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id}>
                <td>
                  <div className="cell-main">
                    {d.name ?? d.id}
                    {d.sub ? (
                      <span
                        className="badge"
                        style={{ marginLeft: 8 }}
                        title="Sub-device (via gateway)"
                      >
                        sub
                      </span>
                    ) : null}
                  </div>
                  <div className="cell-sub">{d.id}</div>
                </td>
                <td>
                  {d.product_name ?? <Dash />}
                  {d.category ? (
                    <div className="cell-sub">{d.category}</div>
                  ) : null}
                </td>
                <td>
                  {d.online ? (
                    <span className="badge success">Online</span>
                  ) : (
                    <span className="badge">Offline</span>
                  )}
                </td>
                <td>
                  {statusSnapshot(d.status) || <Dash />}
                </td>
                <td>{fmtEpoch(d.create_time)}</td>
                <td>{fmtEpoch(d.update_time, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 24 }}>
        <DeleteButton uid={u.uid} />
      </div>
    </main>
  );
}
