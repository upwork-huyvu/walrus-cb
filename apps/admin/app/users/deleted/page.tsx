import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { avatarTone, fmtEpoch, initialOf } from '@/lib/format';
import PurgeButton from '@/components/PurgeButton';
import { IconArrowLeft, IconTrash } from '@/components/Icons';

export const dynamic = 'force-dynamic';

type DeletedUser = {
  uid: string;
  status: string;
  deletedAt: string;
  lastError?: string | null;
  email?: string;
  username?: string;
  nickName?: string;
  avatar?: string;
  stillOnTuya: boolean;
};

/** Ngày ISO từ backend (không phải epoch Tuya) → cùng định dạng với phần còn lại của admin. */
function fmtIso(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? '—' : fmtEpoch(Math.floor(ms / 1000), true);
}

export default async function DeletedUsersPage() {
  const rows = await apiGet<DeletedUser[]>('/users/deleted');

  return (
    <main className="page-wide">
      <Link href="/users" className="back-link">
        <IconArrowLeft />
        Back to users
      </Link>

      <div className="page-head">
        <div>
          <h1 className="page-title">Deleted users</h1>
          <p className="page-sub">
            Accounts scheduled for deletion. Tuya keeps them for a 7-day grace period, then removes
            them for good — deleting here skips the wait and cannot be undone.
          </p>
        </div>
      </div>

      <section className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Deleted on</th>
                <th>State</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    Nothing here. Deleted users appear in this list until they are removed for good.
                  </td>
                </tr>
              ) : (
                rows.map((u) => {
                  const name = u.nickName || u.username || u.email || u.uid;
                  return (
                    <tr key={u.uid}>
                      <td>
                        <div className="user-cell">
                          <span className={`avatar tone-${avatarTone(u.uid)}`}>
                            {u.avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={u.avatar} alt="" />
                            ) : (
                              initialOf(name)
                            )}
                          </span>
                          <div className="user-text">
                            <div className="cell-main" title={name}>
                              {name}
                            </div>
                            <div className="cell-sub">{u.uid}</div>
                          </div>
                        </div>
                      </td>
                      <td className="break">{u.email ?? <span className="muted">—</span>}</td>
                      <td>{fmtIso(u.deletedAt)}</td>
                      <td>
                        {u.stillOnTuya ? (
                          <span className="badge" title="Tuya still holds the account until the grace period ends">
                            Grace period
                          </span>
                        ) : (
                          <span className="badge success" title="Tuya has already removed the account">
                            Removed by Tuya
                          </span>
                        )}
                        {u.status === 'pending' && u.lastError ? (
                          <div className="cell-sub" title={u.lastError}>
                            Retrying — last error recorded
                          </div>
                        ) : null}
                      </td>
                      <td className="right">
                        <div className="row-actions">
                          <PurgeButton uid={u.uid} name={name} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="page-sub" style={{ marginTop: 14 }}>
        <IconTrash /> Deleting from this page calls Tuya’s permanent-delete API. There is no undo and
        no grace period.
      </p>
    </main>
  );
}
