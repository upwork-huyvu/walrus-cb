import { apiGet } from '@/lib/api';
import { displayName } from '@/lib/format';
import UserDevicesBrowser, { type UserDevice } from '@/components/UserDevicesBrowser';

export const dynamic = 'force-dynamic';

type UserDetail = {
  uid: string;
  username?: string;
  email?: string;
  mobile?: string;
  nick_name?: string;
  temp_unit?: number;
};

export default async function UserDevicesPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const [u, devices] = await Promise.all([
    apiGet<UserDetail>(`/users/${uid}`),
    apiGet<UserDevice[]>(`/admin/devices/by-user/${uid}`).catch(() => null),
  ]);

  // Tuya: 1 = Celsius, 2 = Fahrenheit. Hiện theo đơn vị NGƯỜI DÙNG chọn, không mặc định °C.
  const unit = u.temp_unit === 2 ? '°F' : '°C';

  return (
    <main className="page-wide">
      <UserDevicesBrowser
        uid={uid}
        ownerName={displayName(u)}
        devices={devices}
        unit={unit}
      />
    </main>
  );
}
