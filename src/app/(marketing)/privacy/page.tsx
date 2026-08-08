import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { brand } from "@/lib/config/brand";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="January 1, 2026">
      <section>
        <h2>1. Information we collect</h2>
        <ul>
          <li>Account information: name, email address, company name, and password (stored as a salted hash, never in plaintext).</li>
          <li>Billing information: processed by our payment provider; we do not store full payment card numbers.</li>
          <li>Usage data: bandwidth, request counts, and session metadata associated with proxy credentials you generate.</li>
          <li>Technical data: IP address, browser/user agent, and login timestamps, used for security and fraud prevention.</li>
        </ul>
      </section>

      <section>
        <h2>2. How we use information</h2>
        <ul>
          <li>To provide, maintain, and bill for the Service.</li>
          <li>To meter bandwidth usage against your product balances.</li>
          <li>To detect and prevent fraud, abuse, and violations of our Acceptable Use Policy.</li>
          <li>To communicate service updates, security notices, and support responses.</li>
        </ul>
      </section>

      <section>
        <h2>3. Data sharing</h2>
        <p>
          We do not sell your personal information. We share data with
          service providers who help us operate the Service (e.g. payment
          processing, email delivery, infrastructure hosting) under
          confidentiality obligations, and with authorities where required by
          law.
        </p>
      </section>

      <section>
        <h2>4. Data retention</h2>
        <p>
          We retain account and usage data for as long as your account is
          active and as needed to comply with legal obligations, resolve
          disputes, and enforce our agreements.
        </p>
      </section>

      <section>
        <h2>5. Security</h2>
        <p>
          Passwords are hashed, not stored in plaintext. Upstream provider
          credentials and customer proxy passwords are encrypted at rest.
          Access to production systems is restricted and audited.
        </p>
      </section>

      <section>
        <h2>6. Your rights</h2>
        <p>
          You may request access to, correction of, or deletion of your
          personal information by contacting {brand.legalEmail}, subject to
          our legitimate need to retain certain records (e.g. for billing or
          legal compliance).
        </p>
      </section>

      <section>
        <h2>7. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Material
          changes will be communicated via the dashboard or by email.
        </p>
      </section>

      <section>
        <h2>8. Contact</h2>
        <p>Questions about this policy can be sent to {brand.legalEmail}.</p>
      </section>
    </LegalPage>
  );
}
