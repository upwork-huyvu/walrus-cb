import type { Metadata } from 'next';
import Link from 'next/link';
import LegalDoc, { type LegalSection } from '@/components/LegalDoc';
import {
  APP_NAME,
  COMPANY,
  COMPANY_ADDRESS,
  COMPANY_NUMBER,
  SUPPORT_EMAIL,
  WEBSITE_TERMS_URL,
} from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Terms of Use · Walrus',
  description: 'The terms that apply when you use the Walrus ice bath app.',
};

// Terms cho APP (mua bán / bảo hành sản phẩm vẫn theo Terms trên website). Mục "App store terms"
// chứa các điều khoản tối thiểu Apple bắt buộc khi dùng EULA riêng (App Store Review 5.1.1 +
// "Minimum Terms of Developer's End-User License Agreement").

const mail = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

const sections: LegalSection[] = [
  {
    id: 'the-app',
    title: 'The app',
    body: (
      <>
        <p>
          The {APP_NAME} app lets you create an account, pair your Walrus ice bath over Wi-Fi and
          Bluetooth, monitor and control it (temperature, power, light, purification and cleaning),
          time your sessions and receive filter reminders and other notifications.
        </p>
        <p>
          The app is free to download. To use it you need a compatible Walrus ice bath, a supported
          phone and an internet connection. Some features rely on third-party cloud services.
        </p>
      </>
    ),
  },
  {
    id: 'account',
    title: 'Your account',
    body: (
      <ul>
        <li>You must be at least 18 years old to create an account.</li>
        <li>Give accurate information and keep it up to date.</li>
        <li>
          Keep your password private. You are responsible for activity on your account, and you
          should tell us straight away at {mail} if you think someone else has accessed it.
        </li>
        <li>
          You can delete your account at any time. See{' '}
          <Link href="/delete-account">Delete your account</Link>.
        </li>
      </ul>
    ),
  },
  {
    id: 'licence',
    title: 'Your licence to use the app',
    body: (
      <>
        <p>
          We give you a personal, non-exclusive, non-transferable and revocable licence to install
          and use the app on phones you own or control, for your own non-commercial use. You must
          not:
        </p>
        <ul>
          <li>copy, modify or reverse engineer the app, except where the law allows it;</li>
          <li>get around its security or access an ice bath you are not authorised to control;</li>
          <li>interfere with the service, our servers or other users; or</li>
          <li>use the app for anything unlawful or harmful.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'connectivity',
    title: 'Your ice bath and connectivity',
    body: (
      <ul>
        <li>
          Remote features depend on your Wi-Fi, your mobile network and cloud services that we do
          not fully control, so they may sometimes be unavailable or delayed.
        </li>
        <li>
          Readings shown in the app (such as water temperature) can be delayed or differ from the
          ice bath itself. Always check the ice bath before you get in.
        </li>
        <li>
          Firmware updates may be installed automatically when your ice bath is online and idle. Do
          not unplug it during an update.
        </li>
        <li>Keep the app updated to get fixes and new features.</li>
      </ul>
    ),
  },
  {
    id: 'health-safety',
    title: 'Health and safety',
    body: (
      <>
        <p>
          The app is not a medical device and does not give medical advice. Suggested temperatures,
          session lengths, ritual points and streaks are general information for healthy adults.
        </p>
        <ul>
          <li>
            Talk to your doctor before using an ice bath, especially if you are pregnant or have a
            heart condition, high blood pressure, Raynaud&apos;s disease, cold urticaria or any other
            medical condition.
          </li>
          <li>
            Never use the ice bath after drinking alcohol or taking drugs, and never leave children
            unattended near it.
          </li>
          <li>
            Get out straight away if you feel unwell, dizzy or numb, or start to shiver
            uncontrollably.
          </li>
          <li>Only operate the ice bath remotely when you know it is safe to do so.</li>
          <li>
            Follow the user manual and safety instructions supplied with your ice bath. If they
            differ from anything in the app, the manual comes first.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'notifications',
    title: 'Notifications and reminders',
    body: (
      <p>
        Filter reminders and device alerts are there to help, not to replace the maintenance
        schedule in your user manual. You can turn notifications off at any time in your phone
        settings; you may then miss reminders and alerts.
      </p>
    ),
  },
  {
    id: 'privacy',
    title: 'Privacy',
    body: (
      <p>
        Our <Link href="/privacy">Privacy Policy</Link> explains how we collect and use your
        personal data when you use the app.
      </p>
    ),
  },
  {
    id: 'third-parties',
    title: 'Third-party services',
    body: (
      <p>
        The app uses services from third parties such as Tuya (device platform), Google and Apple
        (sign-in and push notifications). Their own terms apply to your use of those services, and
        we are not responsible for them. Links to our website and shop are covered by the{' '}
        <a href={WEBSITE_TERMS_URL}>website Terms and Conditions</a>, which also govern the
        purchase, delivery and warranty of Walrus products.
      </p>
    ),
  },
  {
    id: 'ip',
    title: 'Intellectual property',
    body: (
      <p>
        The app, its design, content and the Walrus name and logo belong to {COMPANY} or our
        licensors. These Terms do not give you any rights in them other than the licence above.
      </p>
    ),
  },
  {
    id: 'changes-termination',
    title: 'Changes, suspension and ending',
    body: (
      <>
        <p>
          We may update the app and change, suspend or withdraw features, for example to improve
          it, fix security issues or meet legal requirements.
        </p>
        <p>
          We may suspend or close your account if you seriously or repeatedly break these Terms or
          misuse the service; where we reasonably can, we will tell you first. You can stop using
          the app and delete your account whenever you like.
        </p>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your legal rights',
    body: (
      <p>
        We provide the app with reasonable care and skill, but to the extent the law allows we
        provide it &ldquo;as is&rdquo; and &ldquo;as available&rdquo; and cannot promise it will be
        uninterrupted or error-free. Nothing in these Terms affects your statutory rights as a
        consumer, including under the Consumer Rights Act 2015.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Our liability',
    body: (
      <>
        <p>
          Nothing in these Terms limits our liability for death or personal injury caused by our
          negligence, for fraud, or for anything else that cannot be limited by law.
        </p>
        <p>Otherwise, we are not responsible for:</p>
        <ul>
          <li>loss or damage that was not reasonably foreseeable;</li>
          <li>business losses, as the app is for personal use only;</li>
          <li>
            loss or damage caused by not following the health and safety guidance above or the
            user manual; or
          </li>
          <li>
            loss or damage caused by events outside our reasonable control, including failures of
            your internet connection or of third-party services.
          </li>
        </ul>
        <p>
          Subject to the above, our total liability to you in connection with the app is limited
          to £100.
        </p>
      </>
    ),
  },
  {
    id: 'app-stores',
    title: 'App store terms',
    body: (
      <>
        <p>
          <strong>If you downloaded the app from Apple&apos;s App Store</strong>, you and we also
          agree that:
        </p>
        <ol type="a">
          <li>
            these Terms are between you and {COMPANY} only, not Apple, and {COMPANY}, not Apple, is
            solely responsible for the app and its content;
          </li>
          <li>
            your licence is limited to using the app on Apple-branded products you own or control,
            as permitted by the Usage Rules in the Apple Media Services Terms and Conditions;
          </li>
          <li>Apple has no obligation to provide maintenance or support services for the app;</li>
          <li>
            if the app fails to conform to any applicable warranty, you may notify Apple and Apple
            will refund the purchase price (if any); to the maximum extent permitted by law, Apple
            has no other warranty obligation with respect to the app;
          </li>
          <li>
            Apple is not responsible for addressing any claims by you or a third party relating to
            the app or your use of it, including product liability claims, claims that the app
            fails to conform to any legal or regulatory requirement, and claims under consumer
            protection, privacy or similar legislation;
          </li>
          <li>
            if a third party claims that the app or your use of it infringes their intellectual
            property rights, {COMPANY}, not Apple, is responsible for the investigation, defence,
            settlement and discharge of that claim;
          </li>
          <li>
            you confirm that you are not located in a country subject to a US Government embargo or
            designated by the US Government as a &ldquo;terrorist supporting&rdquo; country, and that
            you are not on any US Government list of prohibited or restricted parties;
          </li>
          <li>you must comply with any applicable third-party terms when using the app; and</li>
          <li>
            Apple and its subsidiaries are third-party beneficiaries of these Terms and, once you
            accept them, Apple has the right to enforce them against you.
          </li>
        </ol>
        <p>
          <strong>If you downloaded the app from Google Play</strong>, the Google Play Terms of
          Service also apply. Google is not a party to these Terms and is not responsible for the
          app.
        </p>
      </>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: (
      <p>
        These Terms are governed by the laws of England and Wales, and the courts of England and
        Wales have jurisdiction. If you live in Scotland or Northern Ireland you can also bring
        proceedings in your local courts, and if you live in the EU you keep the protection of the
        mandatory consumer laws of your country.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these Terms',
    body: (
      <p>
        We may update these Terms from time to time. We will post the new version on this page and
        update the date at the top, and tell you in the app or by email before any significant
        change takes effect. If you keep using the app after that, the updated Terms apply.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: (
      <p>
        {COMPANY} (company no. {COMPANY_NUMBER}), {COMPANY_ADDRESS.join(', ')}. Email {mail}.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDoc
      eyebrow={`${APP_NAME} app`}
      title="Terms of Use"
      intro={
        <p>
          These Terms of Use (&ldquo;Terms&rdquo;) apply when you use the {APP_NAME} mobile app
          provided by {COMPANY} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or
          using the app you agree to them. If you do not agree, please do not use the app.
        </p>
      }
      highlight={{
        title: 'Safety first',
        body: (
          <p>
            Cold water immersion carries real health risks. The app is not a medical device and
            does not give medical advice. Please read{' '}
            <a href="#health-safety">Health and safety</a> before your first session.
          </p>
        ),
      }}
      sections={sections}
    />
  );
}
