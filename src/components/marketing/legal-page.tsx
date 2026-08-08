import type { ReactNode } from "react";

export function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Effective date: {effectiveDate}
      </p>
      <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        This is a template document generated for a development build and has
        not been reviewed by legal counsel. Replace with counsel-reviewed
        terms before operating this service commercially.
      </div>
      <div className="prose-legal mt-10 space-y-8 text-[15px] leading-relaxed text-navy-700 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-navy-900 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </div>
  );
}
