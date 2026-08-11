import Link from 'next/link';
import { apiGet } from '@/lib/api';
import DeleteButton from '@/components/DeleteButton';
import CopyButton from '@/components/CopyButton';
import { avatarTone, countryLabel, displayName, fmtEpoch, initialOf } from '@/lib/format';
import {
  IconArrowLeft,
  IconArrowRight,
  IconBox,
  IconCalendar,
  IconChart,
  IconClock,
  IconDevice,
  IconMail,
  IconUsers,
} from '@/components/Icons';

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

/** Khớp `AdminUserDeviceItem` của backend (devices.service.ts). */
type UserDevice = {
  id: string;
  name: string;
  online: boolean;
  productName?: string;
  currentTemp: number | null;
  targetTemp: number | null;
  activeTime?: number;
};

// Tuya: 1 = Celsius, 2 = Fahrenheit
function tempUnit(u?: number): string | null {
  if (u === 1) return '°C';
  if (u === 2) return '°F';
  return null;
}

/**
 * Nguồn tài khoản, suy từ TIỀN TỐ username của Tuya: `gg-` Google, `ap-` Apple, `wx-` WeChat,
 * `fb-` Facebook; còn lại là đăng ký thẳng bằng email/điện thoại. Đây là suy luận từ dữ liệu
 * thật, KHÔNG phải field Tuya trả về - Tuya không có "user source".
 */
function userSource(username?: string): string {
  if (!username) return 'Unknown';
  if (username.startsWith('gg-')) return 'Google';
  if (username.startsWith('ap-')) return 'Apple';
  if (username.startsWith('wx-')) return 'WeChat';
  if (username.startsWith('fb-')) return 'Facebook';
  return 'Email / phone';
}

function Dash() {
  return <span className="muted">—</span>;
}

const fmtTemp = (t: number | null): string => (t == null ? '—' : String(t));

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const [u, devices] = await Promise.all([
    apiGet<UserDetail>(`/users/${uid}`),
    // Lỗi phía Tuya (quota, device kit chưa authorize...) không được làm sập cả trang user.
    apiGet<UserDevice[]>(`/admin/devices/by-user/${uid}`).catch(() => null),
  ]);

  const name = displayName(u);
  const list = devices ?? [];
  const online = list.filter((d) => d.online).length;
  const mappings = u.business?.deviceMappings ?? [];
  const unit = tempUnit(u.temp_unit);

  return (
    <main className="page-wide">
      <div className="detail-top">
        <Link href="/users" className="back-link">
          <IconArrowLeft />
          Back to users
        </Link>
        <DeleteButton uid={uid} />
      </div>

      <header className="detail-hero">
        <span className={`avatar xl tone-${avatarTone(uid)}`}>
          {u.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={u.avatar} alt="" />
          ) : (
            initialOf(name)
          )}
          {online > 0 ? <i className="dot online" title="Has a device online" /> : null}
        </span>
        <div className="hero-text">
          <div className="hero-name">
            <h1 className="page-title">{name}</h1>
          </div>
          <div className="hero-uid">
            {uid}
            <CopyButton value={uid} label="user ID" />
          </div>
          <div className="hero-meta">
            <span>{countryLabel(u.country_code) ?? <Dash />}</span>
            <span className="dotsep" />
            <span>
              <IconCalendar size={14} /> Registered on {fmtEpoch(u.create_time, true)}
            </span>
            <span className="dotsep" />
            <span>
              <IconDevice size={14} /> {list.length} device{list.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </header>

      <div className="detail-grid">
        {/* ---------- Account information ---------- */}
        <section className="panel-card">
          <h2 className="card-title">
            <IconUsers size={16} /> Account Information
          </h2>
          <dl className="kv">
            <dt>UID</dt>
            <dd className="kv-copy">
              {u.uid}
              <CopyButton value={u.uid} label="user ID" />
            </dd>

            <dt>Username</dt>
            <dd className="kv-copy">
              {u.username ?? <Dash />}
              {u.username ? <CopyButton value={u.username} label="username" /> : null}
            </dd>

            <dt>Nickname</dt>
            <dd>{u.nick_name ?? <Dash />}</dd>

            <dt>Email</dt>
            <dd className="kv-copy break">
              {u.email ?? <Dash />}
              {u.email ? <IconMail /> : null}
            </dd>

            <dt>Mobile</dt>
            <dd>{u.mobile ? u.mobile : <Dash />}</dd>

            <dt>Country / Region</dt>
            <dd>{countryLabel(u.country_code) ?? <Dash />}</dd>

            <dt>Time zone</dt>
            <dd>{u.time_zone_id ?? <Dash />}</dd>

            <dt>Temperature unit</dt>
            <dd>{unit ?? <Dash />}</dd>

            <dt>Created</dt>
            <dd className="kv-icon">
              <IconCalendar /> {fmtEpoch(u.create_time, true)}
            </dd>

            <dt>Last profile update</dt>
            <dd className="kv-icon">
              <IconClock /> {fmtEpoch(u.update_time, true)}
            </dd>
          </dl>
        </section>

        {/* ---------- Summary + Tuya info ---------- */}
        <div className="detail-side">
          <section className="panel-card">
            <h2 className="card-title">
              <IconChart size={16} /> Summary
            </h2>
            <ul className="stat-list">
              <li>
                <span>
                  <IconDevice size={15} /> Total devices
                </span>
                <b>{devices === null ? '—' : list.length}</b>
              </li>
              <li>
                <span>
                  <i className="dot online" /> Online devices
                </span>
                <b>{devices === null ? '—' : online}</b>
              </li>
              <li>
                <span>
                  <i className="dot offline" /> Offline devices
                </span>
                <b>{devices === null ? '—' : list.length - online}</b>
              </li>
              <li>
                <span>
                  <IconBox size={15} /> Device mappings
                </span>
                <b>{mappings.length}</b>
              </li>
              <li>
                <span>
                  <IconClock size={15} /> Last profile update
                </span>
                <b className="small">{fmtEpoch(u.update_time, true)}</b>
              </li>
            </ul>
          </section>

          <section className="panel-card">
            <h2 className="card-title">
              <span className="tuya-chip">Tuya</span> Tuya Info
            </h2>
            <ul className="stat-list">
              <li>
                <span>User source</span>
                <b title="Suy từ tiền tố username — Tuya không trả field này">
                  {userSource(u.username)}
                </b>
              </li>
              <li>
                <span>Temperature unit</span>
                <b>{unit ?? '—'}</b>
              </li>
              <li>
                <span>Time zone</span>
                <b className="small">{u.time_zone_id ?? '—'}</b>
              </li>
            </ul>
          </section>
        </div>
      </div>

      {/* ---------- Devices ---------- */}
      <section className="panel-card devices-block">
        <div className="card-head">
          <h2 className="card-title">
            <IconBox size={16} /> Devices ({devices === null ? '—' : list.length})
          </h2>
          {list.length > 0 ? (
            <Link href={`/users/${uid}/devices`} className="btn btn-sm view-btn">
              View all devices <IconArrowRight />
            </Link>
          ) : null}
        </div>

        {devices === null ? (
          <p className="muted">Couldn’t load devices from Tuya — try again in a moment.</p>
        ) : list.length === 0 ? (
          <p className="muted">This user has no paired device yet.</p>
        ) : (
          <div className="device-cards">
            {list.slice(0, 4).map((d) => (
              <article key={d.id} className="device-card">
                <span className="device-thumb">
                  <IconDevice size={26} />
                </span>
                <div className="device-body">
                  <div className="device-head">
                    <Link href={`/devices/${d.id}`} className="cell-main">
                      {d.name || 'Device'}
                    </Link>
                    <span className={`badge ${d.online ? 'success' : ''}`}>
                      {d.online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="cell-sub kv-copy">
                    Device ID: {d.id}
                    <CopyButton value={d.id} label="device ID" />
                  </div>
                  {d.productName ? <div className="cell-sub">Product: {d.productName}</div> : null}
                  {d.activeTime ? (
                    <div className="cell-sub">Last online: {fmtEpoch(d.activeTime, true)}</div>
                  ) : null}
                </div>
                <div className="device-temps">
                  <div className="temp-box">
                    <span className="temp-label">Current Temp.</span>
                    <span className="temp-value">
                      {fmtTemp(d.currentTemp)} <em>{unit ?? '°C'}</em>
                    </span>
                  </div>
                  <div className="temp-box">
                    <span className="temp-label">Target Temp.</span>
                    <span className="temp-value gold">
                      {fmtTemp(d.targetTemp)} <em>{unit ?? '°C'}</em>
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
