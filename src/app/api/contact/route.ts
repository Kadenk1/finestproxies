import { NextResponse } from "next/server";
import { contactSchema } from "@/lib/validation/contact";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { brand } from "@/lib/config/brand";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const { allowed } = await checkRateLimit(`contact:ip:${ip}`, 5, 60 * 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many messages sent. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // TODO(production): forward to support inbox / ticketing system instead of logging.
  console.log(
    `[contact] New message to ${brand.supportEmail} from ${parsed.data.name} <${parsed.data.email}>: ${parsed.data.subject}\n${parsed.data.message}`,
  );

  return NextResponse.json({ message: "Message sent. We'll get back to you shortly." });
}
