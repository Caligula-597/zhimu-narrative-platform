import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ObjectStorage } from "./object-storage.js";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} environment variable`);
  return value;
}

export class R2Storage extends ObjectStorage {
  constructor() {
    super();
    const accountId = required("R2_ACCOUNT_ID");
    this.bucket = required("R2_BUCKET");
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY_ID"),
        secretAccessKey: required("R2_SECRET_ACCESS_KEY")
      }
    });
  }

  async createUploadUrl({ key, contentType, expiresIn }) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async createDownloadUrl({ key, expiresIn }) {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async statObject({ key }) {
    const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    return {
      byteSize: Number(result.ContentLength ?? 0),
      contentType: result.ContentType ?? "application/octet-stream",
      etag: result.ETag ?? null
    };
  }

  async deleteObject({ key }) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
