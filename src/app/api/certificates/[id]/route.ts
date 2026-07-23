import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { verifySession, toTenantContext } from "@/lib/auth/dal";
import { getCertificate } from "@/db/repo/passport";
import { canAccessChildData } from "@/db/repo/access";
import { CertificateDocument } from "@/lib/pdf/certificate";

// @react-pdf/renderer needs the Node.js runtime (filesystem + Buffer
// APIs) — see docs/ARCHITECTURE.md "Runtime notes" for what this means
// for the Cloudflare deployment target.
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await verifySession();
  const ctx = toTenantContext(session);

  const certificate = await getCertificate(ctx, id);
  if (!certificate) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const allowed = await canAccessChildData(ctx, certificate.childId);
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const locale = session.locale;
  const title = certificate.title[locale] ?? certificate.title.kk ?? Object.values(certificate.title)[0];

  const buffer = await renderToBuffer(
    CertificateDocument({
      childName: certificate.childName,
      title,
      reason: certificate.reason,
      schoolName: certificate.schoolName,
      issuedAt: certificate.issuedAt,
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="certificate-${id}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
