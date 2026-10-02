import type { Metadata } from 'next';
import Link from 'next/link';
import LegalDoc, { type LegalSection } from '@/components/LegalDoc';
import { IconMail } from '@/components/Icons';
import { APP_NAME, COMPANY, COMPANY_ADDRESS, SUPPORT_EMAIL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Support · Walrus',
  description: 'Get help with the Walrus ice bath app: pairing, filters, your account and contacting us.',
};

// "Support URL" bắt buộc trong App Store Connect. Câu trả lời lấy từ FAQ trong app
// (apps/mobile/src/screens/HelpScreen.tsx) - sửa bên đó thì sửa cả ở đây cho khớp.

const mail = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

const sections: LegalSection[] = [
  {
    id: 'contact',
    title: 'Contact us',
    body: (
      <>
        <a className="legal-contact-card" href={`mailto:${SUPPORT_EMAIL}`}>
          <span className="legal-contact-icon">
            <IconMail size={20} />
          </span>
          <span>
            <span className="legal-contact-label">Email support</span>
            <span className="legal-contact-value">{SUPPORT_EMAIL}</span>
          </span>
        </a>
        <p>
          To help us help you faster, include your phone model, the app version (shown on the
          app&apos;s page in the App Store or Google Play) and, for pairing problems, the
          diagnostics from the error screen (tap{' '}
          <strong>Copy diagnostics</strong> and paste them into your email).
        </p>
        <p className="legal-note">
          {COMPANY}, {COMPANY_ADDRESS.join(', ')}.
        </p>
      </>
    ),
  },
  {
    id: 'pairing',
    title: 'Pairing and connection',
    body: (
      <dl className="legal-faq">
        <dt>My ice bath won&apos;t connect. What should I do?</dt>
        <dd>
          Make sure your phone and the ice bath are on the same 2.4 GHz Wi-Fi network, and that the
          app is allowed to use Bluetooth, Location and (on iPhone) Local network. Restart the ice
          bath by holding the power button for 5 seconds, then try again or use{' '}
          <strong>Reconnect</strong> in the app.
        </dd>
        <dt>Does Walrus work on 5 GHz Wi-Fi?</dt>
        <dd>
          No. The ice bath uses 2.4 GHz Wi-Fi only. If your router broadcasts both bands under the
          same name, you may need to separate them in your router settings.
        </dd>
        <dt>How do I update the firmware?</dt>
        <dd>
          Updates are installed automatically when your ice bath is online and idle, and the app
          lets you know when one is available. Never unplug the ice bath during an update.
        </dd>
      </dl>
    ),
  },
  {
    id: 'maintenance',
    title: 'Filters and cleaning',
    body: (
      <dl className="legal-faq">
        <dt>How often should I replace the filter?</dt>
        <dd>
          Every 90 days with normal use, or sooner if the water looks less clear. The app tracks the
          days since your last change and reminds you when 7 days are left.
        </dd>
        <dt>How do I clean my ice bath?</dt>
        <dd>
          Run the clean cycle from the app or with the button on the ice bath, weekly or whenever
          the water looks cloudy. Use Walrus-approved cleaning tablets only.
        </dd>
        <dt>Where can I buy replacement filters?</dt>
        <dd>
          From the <a href="https://walruswellness.com/shop">Walrus Wellness shop</a>. Use genuine
          Walrus filters: third-party filters can damage the pump and void your warranty.
        </dd>
      </dl>
    ),
  },
  {
    id: 'safety',
    title: 'Using cold water safely',
    body: (
      <p>
        Start with short sessions of 1 to 2 minutes at 12 to 15 °C and build up gradually. Cold
        exposure is not suitable for everyone: talk to your doctor first if you have a heart
        condition or any other medical condition. Read the full{' '}
        <Link href="/terms#health-safety">health and safety guidance</Link>.
      </p>
    ),
  },
  {
    id: 'account',
    title: 'Your account',
    body: (
      <dl className="legal-faq">
        <dt>I forgot my password.</dt>
        <dd>
          On the email sign-in screen, tap <strong>Forgot password?</strong> and follow the steps.
          We will email you a verification code.
        </dd>
        <dt>How do I delete my account?</dt>
        <dd>
          In the app go to Account → Profile settings → Delete account, or see{' '}
          <Link href="/delete-account">Delete your account</Link> for other options.
        </dd>
        <dt>How is my data used?</dt>
        <dd>
          See our <Link href="/privacy">Privacy Policy</Link> and{' '}
          <Link href="/terms">Terms of Use</Link>.
        </dd>
      </dl>
    ),
  },
];

export default function SupportPage() {
  return (
    <LegalDoc
      eyebrow={`${APP_NAME} app`}
      title="Support"
      intro={
        <p>
          Help with the {APP_NAME} app and your ice bath. Can&apos;t find what you need? Email{' '}
          {mail} and we will get back to you.
        </p>
      }
      sections={sections}
    />
  );
}
