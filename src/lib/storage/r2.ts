import "server-only";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { PutObjectInput, PutObjectResult, StorageAdapter } from "@/lib/storage/types";
import { classifyMediaKey } from "@/lib/storage/media-access";

/**
 * Cloudflare R2 is S3-API-compatible, so the official AWS SDK works
 * against it unmodified — just point `endpoint` at the account's R2
 * S3 endpoint. See docs/DEPLOYMENT.md for the exact R2 setup steps.
 *
 * Children's media (recognitions/, media/) is never given a public
 * bucket URL: putObject returns the guarded app path "/uploads/<key>"
 * and src/app/api/media/[...path]/route.ts streams it back with
 * getObject after the access check. Public CMS content keeps its
 * public URL.
 */
export class R2StorageAdapter implements StorageAdapter {
  readonly driver = "r2" as const;
  private readonly client: S3Client;

  constructor(
    private readonly accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
    private readonly bucket: string,
    private readonly publicUrl: string
  ) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async putObject({ key, data, contentType }: PutObjectInput): Promise<PutObjectResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      })
    );
    if (classifyMediaKey(key.split("/")).type !== "public") {
      return { url: `/uploads/${key}`, key };
    }
    const base = this.publicUrl.replace(/\/$/, "");
    return { url: `${base}/${key}`, key };
  }

  async getObject(
    key: string,
    range: string | null
  ): Promise<{ body: ReadableStream; contentType?: string; contentLength: number; contentRange?: string } | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: range ?? undefined })
      );
      if (!res.Body) return null;
      return {
        body: res.Body.transformToWebStream(),
        contentType: res.ContentType,
        contentLength: res.ContentLength ?? 0,
        contentRange: res.ContentRange,
      };
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === "NoSuchKey" || name === "NotFound" || name === "InvalidRange") return null;
      throw err;
    }
  }
}
