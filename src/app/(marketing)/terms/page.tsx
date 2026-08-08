import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { brand } from "@/lib/config/brand";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" effectiveDate="January 1, 2026">
      <section>
        <h2>1. Agreement to terms</h2>
        <p>
          These Terms of Service (&quot;Terms&quot;) govern access to and use
          of {brand.name}&apos;s proxy infrastructure, dashboard, and related
          services (the &quot;Service&quot;), operated at {brand.domain}. By
          creating an account or using the Service, you agree to be bound by
          these Terms and by our{" "}
          <a href="/acceptable-use">Acceptable Use Policy</a>.
        </p>
      </section>

      <section>
        <h2>2. Accounts</h2>
        <p>
          You must provide accurate registration information and keep your
          credentials secure. You are responsible for all activity that
          occurs through your account, including through proxy credentials
          generated under your account.
        </p>
      </section>

      <section>
        <h2>3. The Service</h2>
        <p>
          {brand.name} provides access to residential, ISP, and mobile proxy
          infrastructure routed through gateways we operate. We do not
          guarantee the availability of any specific IP address, geographic
          location, or upstream provider, and we may change upstream
          providers, gateways, or routing at our discretion to maintain
          service quality.
        </p>
      </section>

      <section>
        <h2>4. Acceptable use</h2>
        <p>
          Use of the Service is subject to our{" "}
          <a href="/acceptable-use">Acceptable Use Policy</a>, which
          prohibits illegal activity, unauthorized access, credential
          attacks, fraud, spam, malware distribution, and attempts to bypass
          third-party access controls. Violations may result in suspension
          or termination of your account without refund.
        </p>
      </section>

      <section>
        <h2>5. Billing</h2>
        <ol>
          <li>Fees are billed as described at the time of purchase, either as one-time bandwidth/IP purchases or recurring subscriptions.</li>
          <li>Recurring plans renew automatically until cancelled through your dashboard.</li>
          <li>Unused balances from one-time purchases do not expire unless stated otherwise at purchase.</li>
          <li>All fees are exclusive of applicable taxes unless stated otherwise.</li>
        </ol>
      </section>

      <section>
        <h2>6. Suspension and termination</h2>
        <p>
          We may suspend or terminate access to the Service, including
          revoking proxy credentials, if we reasonably believe your account
          is being used in violation of these Terms or the Acceptable Use
          Policy, or to protect the security or integrity of our
          infrastructure or upstream providers.
        </p>
      </section>

      <section>
        <h2>7. Disclaimers</h2>
        <p>
          The Service is provided &quot;as is&quot; without warranties of any
          kind, express or implied, including warranties of merchantability,
          fitness for a particular purpose, and non-infringement.
        </p>
      </section>

      <section>
        <h2>8. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, {brand.name} will not be
          liable for any indirect, incidental, special, consequential, or
          punitive damages, or any loss of profits or revenues, arising out
          of or related to your use of the Service.
        </p>
      </section>

      <section>
        <h2>9. Changes to these Terms</h2>
        <p>
          We may update these Terms from time to time. Material changes will
          be communicated via the dashboard or by email. Continued use of the
          Service after changes take effect constitutes acceptance of the
          revised Terms.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>
          Questions about these Terms can be sent to {brand.legalEmail}.
        </p>
      </section>
    </LegalPage>
  );
}
