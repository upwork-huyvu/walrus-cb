import type { Metadata } from 'next';
import Link from 'next/link';
import LegalDoc, { type LegalSection } from '@/components/LegalDoc';
import { APP_NAME, COMPANY, DELETION_GRACE_DAYS, SUPPORT_EMAIL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Delete your account · Walrus',
  description:
    'How to delete your Walrus app account and its data, what is deleted and how long it takes.',
};

// URL "Delete account" bắt buộc trong Google Play Console (Data safety → Data deletion): phải nêu
// tên app + developer như trên store, các bước yêu cầu xoá, dữ liệu bị xoá / giữ lại và thời hạn.
// Các bước khớp ProfileScreen (Account → Profile settings → DELETE ACCOUNT → gõ DELETE).

const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Delete my Walrus account')}`;

const sections: LegalSection[] = [
  {
    id: 'in-the-app',
    title: 'Delete it in the app',
    body: (
      <>
        <p>This is the quickest way, and it works on both iPhone and Android:</p>
        <ol className="legal-steps">
          <li>Open the {APP_NAME} app and sign in.</li>
          <li>
            Tap <strong>Account</strong> in the bottom bar.
          </li>
          <li>
            Open <strong>Profile settings</strong>.
          </li>
          <li>
            Scroll down to <strong>Delete account</strong> and tap <strong>DELETE ACCOUNT</strong>.
          </li>
          <li>
            Type <kbd>DELETE</kbd> and tap <strong>CONFIRM DELETE</strong>.
          </li>
        </ol>
        <p>You are signed out straight away and your deletion request is recorded.</p>
      </>
    ),
  },
  {
    id: 'by-email',
    title: 'No access to the app?',
    body: (
      <>
        <p>
          Email <a href={mailto}>{SUPPORT_EMAIL}</a>{' '}
          from the email address linked to your account, with the subject &ldquo;Delete my Walrus
          account&rdquo;. If you signed up with a phone number, include that number.
        </p>
        <p>
          We may ask you to confirm that the account is yours. We will then delete it within 30
          days and confirm by email.
        </p>
        <p>
          <a className="legal-button" href={mailto}>
            Email a deletion request
          </a>
        </p>
      </>
    ),
  },
  {
    id: 'recovery-window',
    title: `The ${DELETION_GRACE_DAYS}-day recovery window`,
    body: (
      <p>
        Deletion takes effect {DELETION_GRACE_DAYS} days after your request. If you sign in again
        during that time, the request is cancelled and your account is kept. After{' '}
        {DELETION_GRACE_DAYS} days the deletion is permanent and the account cannot be recovered.
      </p>
    ),
  },
  {
    id: 'what-is-deleted',
    title: 'What is deleted',
    body: (
      <>
        <ul>
          <li>
            Your account profile: email address or phone number, nickname, country or region, time
            zone and preferences.
          </li>
          <li>The link between your account and Sign in with Google or Apple.</li>
          <li>Your homes, your paired ice baths and their settings and history in the cloud.</li>
          <li>Push notification tokens, filter reminder settings and notification history.</li>
        </ul>
        <p>
          Your account and device data are deleted when the recovery window ends. Our remaining
          service records linked to your account are deleted within 30 days after that, and any
          copies in our providers&apos; routine backups are removed as those backups expire.
        </p>
        <p>
          Your ice bath itself is not affected. Once it is removed from your account it can be
          paired again with a new account.
        </p>
      </>
    ),
  },
  {
    id: 'what-is-kept',
    title: 'What is kept',
    body: (
      <>
        <p>
          We do not keep any app data once deletion is complete, unless the law requires us to keep
          a specific record (for example, correspondence about a legal claim).
        </p>
        <p>
          Orders placed on walruswellness.com are not part of your app account. They are kept for
          tax and accounting purposes under the website&apos;s privacy policy.
        </p>
      </>
    ),
  },
  {
    id: 'on-your-phone',
    title: 'Data on your phone',
    body: (
      <>
        <p>
          Your session history and saved Wi-Fi networks are stored only on your phone. Uninstall the
          app to remove them.
        </p>
        <p>If you used Sign in with Google or Apple, you can also remove the app&apos;s access:</p>
        <ul>
          <li>
            <strong>Apple</strong>: on your iPhone, go to Settings → your name → Sign-In &amp;
            Security → Sign in with Apple, then choose {APP_NAME} and stop using your Apple ID.
          </li>
          <li>
            <strong>Google</strong>: visit{' '}
            <a href="https://myaccount.google.com/connections" rel="noopener noreferrer">
              myaccount.google.com/connections
            </a>{' '}
            and remove {APP_NAME}.
          </li>
        </ul>
      </>
    ),
  },
];

export default function DeleteAccountPage() {
  return (
    <LegalDoc
      eyebrow={`${APP_NAME} app · ${COMPANY}`}
      title="Delete your account"
      intro={
        <p>
          You can delete your {APP_NAME} account and its data at any time, from inside the app or by
          asking us. This page applies to the {APP_NAME} app by {COMPANY} on the App Store and
          Google Play. Read our <Link href="/privacy">Privacy Policy</Link> for more on how we
          handle your data.
        </p>
      }
      sections={sections}
    />
  );
}
