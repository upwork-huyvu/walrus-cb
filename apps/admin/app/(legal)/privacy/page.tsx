import type { Metadata } from 'next';
import Link from 'next/link';
import LegalDoc, { type LegalSection } from '@/components/LegalDoc';
import {
  APP_NAME,
  COMPANY,
  COMPANY_ADDRESS,
  COMPANY_NUMBER,
  DELETION_GRACE_DAYS,
  SUPPORT_EMAIL,
  WEBSITE_URL,
} from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy · Walrus',
  description:
    'How the Walrus ice bath app collects, uses, shares and protects your personal data, and the choices you have.',
};

// Nội dung phải KHỚP thứ app thật sự làm (Apple 5.1.1 / Google User Data policy so sánh với
// App Privacy + Data safety form). Nguồn: apps/mobile (auth Tuya/Google/Apple, FCM, quyền
// Bluetooth/Location/Local network, AsyncStorage) + apps/backend/prisma/schema.prisma.
// Thêm SDK / bảng dữ liệu mới → cập nhật trang này và LEGAL_UPDATED.

const mail = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

const sections: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <>
        <p>
          The {APP_NAME} app is provided by {COMPANY}, a company registered in England and Wales
          (company no. {COMPANY_NUMBER}), whose registered address is {COMPANY_ADDRESS.join(', ')}.
        </p>
        <p>
          We are the data controller for the personal data processed through the app. If you have
          any question about this policy or your data, email {mail}.
        </p>
      </>
    ),
  },
  {
    id: 'data-we-collect',
    title: 'Data we collect',
    body: (
      <>
        <p>We only collect what the app needs to run your ice bath and your account.</p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">What it includes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Account</th>
                <td>
                  Email address or phone number, nickname, country or region, time zone and
                  temperature unit. Your password is sent securely to our platform provider to sign
                  you in; we never see it.
                </td>
              </tr>
              <tr>
                <th scope="row">Sign in with Google or Apple</th>
                <td>
                  If you choose one of these options: your name and email address from Google; or a
                  unique identifier, your email address (which can be a private relay address if you
                  use Hide My Email) and, the first time only, your name from Apple.
                </td>
              </tr>
              <tr>
                <th scope="row">Your ice bath</th>
                <td>
                  Device identifiers and model, the name you give it, the home it belongs to, its
                  status and settings (water temperature, target temperature, power, light,
                  purification, cleaning cycle, fault codes, online status) and firmware version.
                </td>
              </tr>
              <tr>
                <th scope="row">Filter reminders</th>
                <td>
                  Which ice bath the reminder is for, the reminder interval and the date you last
                  changed the filter.
                </td>
              </tr>
              <tr>
                <th scope="row">Notifications</th>
                <td>
                  The push notification token for your phone, its platform (iOS or Android) and a
                  history of the notifications sent to you (title, message and time).
                </td>
              </tr>
              <tr>
                <th scope="row">Technical data</th>
                <td>
                  Phone model, operating system and app version, and the IP address your phone uses
                  when it connects to our service providers, used to run and secure the service.
                </td>
              </tr>
              <tr>
                <th scope="row">Support</th>
                <td>
                  Whatever you send us when you contact support, including pairing diagnostics if
                  you choose to copy and share them.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Data that stays on your phone</h3>
        <p>Some data is stored only in the app on your phone and is never sent to our servers:</p>
        <ul>
          <li>Your cold plunge sessions: date, duration, ritual points and streak.</li>
          <li>
            Up to five Wi-Fi network names and passwords you entered while pairing, so you do not
            have to type them again. During pairing they are sent directly to your ice bath so it
            can join your network.
          </li>
        </ul>

        <h3>What we do not collect</h3>
        <p>
          We do not collect your precise location, contacts, photos, health or fitness data,
          payment details or advertising identifiers, and we do not track you across other apps or
          websites.
        </p>
      </>
    ),
  },
  {
    id: 'permissions',
    title: 'Phone permissions',
    body: (
      <>
        <p>The app asks for these permissions only when a feature needs them:</p>
        <ul>
          <li>
            <strong>Bluetooth</strong> to find, pair and control your ice bath when you are nearby.
          </li>
          <li>
            <strong>Location</strong> because iOS and Android require it to read the name of your
            Wi-Fi network and, on Android, to scan for Bluetooth devices. We do not collect, store
            or share your location.
          </li>
          <li>
            <strong>Local network</strong> (iOS) to discover and pair your ice bath on your Wi-Fi.
          </li>
          <li>
            <strong>Notifications</strong> to send filter reminders and device alerts.
          </li>
        </ul>
        <p>
          You can turn any of them off in your phone settings. Pairing a new ice bath will not work
          without Bluetooth, Location and Local network access.
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use',
    title: 'How we use your data',
    body: (
      <>
        <p>We use your data for these purposes, each with a lawful basis under data protection law:</p>
        <ul>
          <li>
            <strong>To provide the app</strong>: create your account, sign you in, pair and control
            your ice bath and show its status. <em>Basis: performance of our contract with you.</em>
          </li>
          <li>
            <strong>To send notifications</strong>: filter reminders, device alerts and messages
            about the service. <em>Basis: your consent, which you can withdraw at any time by
            turning notifications off.</em>
          </li>
          <li>
            <strong>To support you</strong>: authorised {COMPANY} staff can view your account
            details and linked ice baths through our internal admin tools and, where needed to
            resolve a problem, operate your ice bath remotely.{' '}
            <em>Basis: our legitimate interest in helping our customers.</em>
          </li>
          <li>
            <strong>To keep the service secure and working</strong>: prevent misuse, fix faults and
            keep records of account deletion requests. <em>Basis: our legitimate interests.</em>
          </li>
          <li>
            <strong>To meet legal obligations</strong> where the law requires it.{' '}
            <em>Basis: legal obligation.</em>
          </li>
        </ul>
        <p>
          We do not use your data for advertising or profiling, we never sell or rent it, and we do
          not make decisions about you based solely on automated processing.
        </p>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'Who we share it with',
    body: (
      <>
        <p>We share personal data only with the service providers that run the app for us:</p>
        <ul>
          <li>
            <strong>Tuya</strong>, our Internet-of-Things platform, which runs accounts, pairing and
            device control. Account and device data is stored in Tuya&apos;s Central Europe data
            centre.
          </li>
          <li>
            <strong>Google</strong> for push notifications (Firebase Cloud Messaging) and, if you use
            it, Sign in with Google.
          </li>
          <li>
            <strong>Apple</strong> for push notifications on iPhone and, if you use it, Sign in with
            Apple.
          </li>
          <li>
            <strong>Supabase</strong>, which hosts the database for our service records (push
            tokens, filter reminders, notification history and device links).
          </li>
          <li>
            <strong>Vercel</strong>, which hosts our backend service and admin tools.
          </li>
        </ul>
        <p>
          These providers process data on our instructions and under contracts that protect it.
          Google and Apple handle sign-in under their own privacy policies. We may also disclose
          data if the law requires it, or to a buyer of our business, in which case this policy
          will continue to apply.
        </p>
      </>
    ),
  },
  {
    id: 'transfers',
    title: 'International transfers',
    body: (
      <p>
        Some of our providers process data outside the UK and the European Economic Area, for
        example in the United States. When they do, we rely on adequacy decisions or on safeguards
        such as the European Commission&apos;s Standard Contractual Clauses and the UK International
        Data Transfer Addendum.
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <ul>
        <li>
          <strong>Account, device, reminder and notification data</strong> is kept while your
          account is active.
        </li>
        <li>
          <strong>Push tokens</strong> are removed when you sign out or delete your account, and
          tokens that stop working are removed automatically.
        </li>
        <li>
          <strong>When you delete your account</strong>, there is a {DELETION_GRACE_DAYS}-day recovery
          window, after which your account and device data are permanently deleted. Our remaining
          service records linked to your account are deleted within 30 days after that. See{' '}
          <Link href="/delete-account">Delete your account</Link>.
        </li>
        <li>
          <strong>Support emails</strong> are kept as long as needed to deal with your request and
          any follow-up.
        </li>
        <li>
          <strong>Data on your phone</strong> stays there until you uninstall the app or clear its
          data.
        </li>
      </ul>
    ),
  },
  {
    id: 'security',
    title: 'How we protect it',
    body: (
      <p>
        Data is encrypted in transit (HTTPS/TLS) between the app, your ice bath&apos;s cloud
        service and our servers. Access to our admin tools is limited to authorised staff, and
        secret keys are kept on our servers, never in the app. No system is completely secure, so
        please keep your password private and tell us straight away if you think your account has
        been compromised.
      </p>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: (
      <>
        <p>
          Under the UK GDPR and, where it applies, the EU GDPR, you have the right to access your
          data, correct it, delete it, restrict or object to how we use it, receive it in a portable
          format and withdraw consent at any time.
        </p>
        <ul>
          <li>
            Update your nickname, time zone and temperature unit in the app under{' '}
            <strong>Account → Profile settings</strong>.
          </li>
          <li>
            Delete your account in the app or as described on{' '}
            <Link href="/delete-account">Delete your account</Link>.
          </li>
          <li>For anything else, email {mail}. We reply within one month.</li>
        </ul>
        <p>
          If you are unhappy with how we handle your data, you can complain to the UK Information
          Commissioner&apos;s Office at{' '}
          <a href="https://ico.org.uk/make-a-complaint/" rel="noopener noreferrer">
            ico.org.uk
          </a>{' '}
          or to the data protection authority where you live. We would appreciate the chance to put
          things right first.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>
        The app is intended for adults. We do not knowingly collect personal data from anyone under
        18. If you believe a child has given us personal data, contact us and we will delete it.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        We may update this policy when the app or the law changes. We will post the new version on
        this page and update the date at the top, and we will tell you in the app or by email
        before any significant change takes effect.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: (
      <>
        <p>
          Email {mail} or write to {COMPANY}, {COMPANY_ADDRESS.join(', ')}.
        </p>
        <p className="legal-note">
          This policy covers the {APP_NAME} mobile app. Orders and bookings made on{' '}
          <a href={WEBSITE_URL}>walruswellness.com</a>{' '}
          are covered by the website&apos;s own privacy policy.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      eyebrow={`${APP_NAME} app`}
      title="Privacy Policy"
      intro={
        <p>
          This policy explains what personal data the {APP_NAME} app collects when you use it to
          pair, control and look after your Walrus ice bath, why we collect it, who we share it with
          and the choices you have.
        </p>
      }
      highlight={{
        title: 'At a glance',
        body: (
          <ul>
            <li>We collect only what the app needs: your account, your ice bath and your settings.</li>
            <li>No advertising, no cross-app tracking, and we never sell your data.</li>
            <li>Your session history and saved Wi-Fi networks stay on your phone.</li>
            <li>You can delete your account from inside the app at any time.</li>
          </ul>
        ),
      }}
      sections={sections}
    />
  );
}
