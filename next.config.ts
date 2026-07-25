import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Server Actions reject any request body over 1MB by default
// (experimental.serverActions.bodySizeLimit) — news video uploads go
// through a Server Action (src/app/[locale]/app/super-admin/news/actions.ts
// -> src/lib/cms/upload.ts::uploadNewsVideo), so without raising this
// every upload above 1MB 413s before validateVideoUpload ever runs.
// The limit here must be set ABOVE MAX_VIDEO_UPLOAD_MB, not equal to
// it: this counts the raw multipart/form-data request body, which
// includes boundary strings, part headers, and field metadata on top
// of the actual file bytes, so a file sized exactly at the configured
// max would still 413 if the two limits matched exactly. +10MB is
// generous headroom for that overhead.
// Same parsing/fallback rule as validateVideoUpload's maxVideoBytes()
// in src/lib/storage/types.ts, so both layers agree on what
// MAX_VIDEO_UPLOAD_MB actually means for any given env value.
const parsedMaxVideoMb = Number(process.env.MAX_VIDEO_UPLOAD_MB);
const MAX_VIDEO_UPLOAD_MB = Number.isFinite(parsedMaxVideoMb) && parsedMaxVideoMb > 0 ? parsedMaxVideoMb : 100;
const SERVER_ACTION_BODY_SIZE_LIMIT_BYTES = (MAX_VIDEO_UPLOAD_MB + 10) * 1024 * 1024;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "http", hostname: "localhost" }],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: SERVER_ACTION_BODY_SIZE_LIMIT_BYTES,
    },
  },
};

export default withNextIntl(nextConfig);
