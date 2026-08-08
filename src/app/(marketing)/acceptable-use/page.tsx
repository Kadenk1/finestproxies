import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { brand } from "@/lib/config/brand";

export const metadata: Metadata = { title: "Acceptable Use Policy" };

export default function AcceptableUsePage() {
  return (
    <LegalPage title="Acceptable Use Policy" effectiveDate="January 1, 2026">
      <section>
        <h2>1. Purpose</h2>
        <p>
          This Acceptable Use Policy (&quot;AUP&quot;) defines activities
          that are prohibited when using {brand.name}&apos;s proxy
          infrastructure. It applies to all customers, proxy credentials, and
          any traffic routed through our gateways.
        </p>
      </section>

      <section>
        <h2>2. Prohibited activities</h2>
        <p>You may not use the Service to:</p>
        <ul>
          <li>Engage in or facilitate any illegal activity under applicable law.</li>
          <li>Gain or attempt to gain unauthorized access to any system, account, or network.</li>
          <li>Perform credential stuffing, brute-force attacks, or other automated credential attacks.</li>
          <li>Commit or facilitate fraud, including payment fraud or ad fraud.</li>
          <li>Send spam or unsolicited bulk communications.</li>
          <li>Develop, distribute, or deploy malware, ransomware, or other malicious code.</li>
          <li>Attempt to bypass, circumvent, or interfere with a third party&apos;s access controls, rate limits, CAPTCHAs, or anti-bot/anti-abuse protections.</li>
          <li>Conduct denial-of-service attacks or other activity intended to disrupt a third-party system.</li>
          <li>Scrape or access data in violation of a target site&apos;s terms of service or applicable law, including personal data protected by privacy law.</li>
          <li>Resell or sublicense proxy credentials outside the scope of your account without authorization.</li>
        </ul>
      </section>

      <section>
        <h2>3. Routing and infrastructure use</h2>
        <p>
          Our routing engine selects upstream capacity based on legitimate
          reliability, availability, performance, geographic, and cost
          factors. Customers may not attempt to use the Service specifically
          to defeat anti-bot, anti-fraud, or access-control systems operated
          by third parties.
        </p>
      </section>

      <section>
        <h2>4. Enforcement</h2>
        <p>
          Suspected violations may result in one or more of the following, at
          our discretion and proportional to severity:
        </p>
        <ul>
          <li>Rate limiting of affected credentials.</li>
          <li>Revocation of specific proxy credentials.</li>
          <li>Suspension of the account pending investigation.</li>
          <li>Termination of the account without refund.</li>
          <li>Reporting to law enforcement where required or appropriate.</li>
        </ul>
        <p>
          We maintain an internal audit history of abuse reports, account
          notes, and enforcement actions for accounts under review.
        </p>
      </section>

      <section>
        <h2>5. Reporting abuse</h2>
        <p>
          To report suspected abuse of our network, contact{" "}
          {brand.legalEmail} with as much detail as possible, including
          timestamps, source IPs, and affected systems.
        </p>
      </section>

      <section>
        <h2>6. Changes to this policy</h2>
        <p>
          We may update this AUP from time to time. Continued use of the
          Service after changes take effect constitutes acceptance of the
          revised policy.
        </p>
      </section>
    </LegalPage>
  );
}
