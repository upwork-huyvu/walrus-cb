import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { avatarTone, fmtEpoch, initialOf } from '@/lib/format';
import PurgeButton from '@/components/PurgeButton';
import RestoreButton from '@/components/RestoreButton';
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
            Accounts scheduled for deletion, hidden from the customer list. Tuya keeps them for a
            7-day grace period: <strong>Restore</strong> puts an account back, while{' '}
            <strong>Delete forever</strong> skips the remaining wait and cannot be undone. Once the
            grace period ends Tuya erases the account itself and it can no longer be restored.
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
                          {u.stillOnTuya ? <RestoreButton uid={u.uid} /> : null}
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
        <IconTrash /> <strong>Delete forever</strong> calls Tuya’s permanent-delete API immediately —
        there is no undo. <strong>Restore</strong> is only offered while Tuya still holds the
        account.
      </p>
    </main>
  );
}
