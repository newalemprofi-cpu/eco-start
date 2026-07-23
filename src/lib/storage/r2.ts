import "server-only";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { PutObjectInput, PutObjectResult, StorageAdapter } from "@/lib/storage/types";

/**
 * Cloudflare R2 is S3-API-compatible, so the official AWS SDK works
 * against it unmodified — just point `endpoint` at the account's R2
 * S3 endpoint. See docs/DEPLOYMENT.md for the exact R2 setup steps.
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
    const base = this.publicUrl.replace(/\/$/, "");
    return { url: `${base}/${key}`, key };
  }
}
