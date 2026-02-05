import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function getR2Client() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2 credentials (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)");
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("Missing R2_BUCKET_NAME");
  }

  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}
