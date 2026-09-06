import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { appEnv } from "./env";

let client: S3Client | undefined;

function objectStore(): S3Client {
  const { garage } = appEnv();
  client ??= new S3Client({
    endpoint: garage.endpoint,
    region: garage.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: garage.accessKeyId,
      secretAccessKey: garage.secretAccessKey,
    },
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

export async function reachBucket(): Promise<void> {
  await objectStore().send(
    new HeadBucketCommand({ Bucket: appEnv().garage.bucket }),
  );
}

/**
 * Where an object's bytes live. The id is the content's SHA-256, so the key
 * derives from the content and two writes of the same bytes land in one place
 * rather than twice.
 */
export const objectKey = (objectId: string): string =>
  `assets/${objectId.slice(0, 2)}/${objectId}`;

/** Whether the store already holds these bytes. */
export async function objectExists(objectId: string): Promise<boolean> {
  try {
    await objectStore().send(
      new HeadObjectCommand({
        Bucket: appEnv().garage.bucket,
        Key: objectKey(objectId),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Writes bytes under their own hash. Content addressing makes this idempotent:
 * the same bytes written twice are the same object, so a retried ingest costs
 * a write and changes nothing.
 */
export async function putObject(input: {
  readonly objectId: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
}): Promise<void> {
  await objectStore().send(
    new PutObjectCommand({
      Bucket: appEnv().garage.bucket,
      Key: objectKey(input.objectId),
      Body: input.bytes,
      ContentType: input.contentType,
    }),
  );
}

/**
 * Removes one object. Only the sweep calls this, and only for bytes no
 * publication ever sent: an object a publication named is permanent.
 */
export async function deleteObject(objectId: string): Promise<void> {
  await objectStore().send(
    new DeleteObjectCommand({
      Bucket: appEnv().garage.bucket,
      Key: objectKey(objectId),
    }),
  );
}

/** Reads an object's bytes back, which a destination upload needs. */
export async function readObject(objectId: string): Promise<Uint8Array> {
  const answer = await objectStore().send(
    new GetObjectCommand({
      Bucket: appEnv().garage.bucket,
      Key: objectKey(objectId),
    }),
  );
  return new Uint8Array(await (answer.Body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray());
}
