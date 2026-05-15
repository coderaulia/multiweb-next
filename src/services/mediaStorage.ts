import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { env } from '@/services/env';

type StoredMedia = {
  storageProvider: 'local' | 's3';
  storageKey: string;
  url: string;
  sizeBytes: number;
};

type SaveUploadedMediaOptions = {
  storageKey?: string | null;
  upsert?: boolean;
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_SAFE_FILE_NAME_LENGTH = 64;
const FALLBACK_EXTENSION = '.png';

// SVG intentionally excluded - SVG files can contain inline <script> tags (stored XSS).
type MagicSignature = { offset: number; bytes: readonly number[] };

const MIME_MAGIC: Record<string, MagicSignature[]> = {
  'image/jpeg': [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  'image/jpg': [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  'image/png': [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  'image/gif': [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }],
  'image/webp': [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }],
  'image/heic': [], // HEIC/HEIF uses a variable-length box format; skip magic check
  'video/mp4': [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }], // 'ftyp' box at byte 4
  'video/webm': [{ offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }]
};

const ALLOWED_MIME_TYPES = new Set(Object.keys(MIME_MAGIC));
let s3Client: S3Client | null = null;

function sanitizeFilename(value: string) {
  const safe = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, MAX_SAFE_FILE_NAME_LENGTH) || 'media-asset';

  return safe || randomUUID();
}

function getExtFromMimeType(mimeType: string, fallbackName: string) {
  const fromName = extname(fallbackName || '').toLowerCase();
  if (fromName.length > 1) {
    return fromName;
  }

  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/heic': '.heic',
    'video/mp4': '.mp4',
    'video/webm': '.webm'
  };

  return map[mimeType] ?? FALLBACK_EXTENSION;
}

function isAllowedMimeType(file: File) {
  return ALLOWED_MIME_TYPES.has((file.type || '').toLowerCase());
}

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const sigs = MIME_MAGIC[mimeType.toLowerCase()];
  if (sigs === undefined) return false;
  if (sigs.length === 0) return true; // no magic signature defined (e.g. HEIC)
  return sigs.some(({ offset, bytes }) => {
    if (buffer.length < offset + bytes.length) return false;
    return bytes.every((b, i) => buffer[offset + i] === b);
  });
}

function normalizeStorageKey(value: string) {
  const safe = value.replace(/^\/+/, '');
  if (!safe) return '';
  return safe
    .split('/')
    .map((segment) => sanitizeFilename(segment))
    .join('/');
}

function safeJoin(root: string, storageKey: string) {
  const normalized = normalize(storageKey).replace(/^\.{2}[\\/]+/, '');
  const next = resolve(root, normalized);
  const relativePath = relative(root, next);

  if (!relativePath || relativePath.startsWith('..') || relativePath.includes('..')) {
    throw new Error('Invalid storage key');
  }

  return next;
}

function publicUrlPrefix() {
  const configured = env.mediaPublicBaseUrl.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return env.siteUrl.replace(/\/+$/, '');
}

function isS3Enabled() {
  return Boolean(env.s3Endpoint && env.s3AccessKey && env.s3SecretKey && env.s3Bucket);
}

function getS3Client() {
  if (!isS3Enabled()) {
    throw new Error('S3 storage is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, and S3_BUCKET.');
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: env.s3Region || 'us-east-1',
      endpoint: env.s3Endpoint,
      credentials: {
        accessKeyId: env.s3AccessKey,
        secretAccessKey: env.s3SecretKey
      },
      forcePathStyle: true // Required for MinIO and most S3-compatible services
    });
  }

  return s3Client;
}

function generateStorageKey(file: File) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const base = sanitizeFilename(file.name || randomUUID());
  const extension = getExtFromMimeType(file.type || '', file.name || '');
  const id = randomUUID();
  const filename = `${base}-${id.slice(0, 6)}${extension}`;
  return `media/${year}/${month}/${filename}`;
}

function getS3PublicUrl(storageKey: string) {
  const publicUrl = env.s3PublicUrl;
  if (publicUrl) {
    return `${publicUrl.replace(/\/+$/, '')}/${storageKey}`;
  }
  // Fallback: construct from endpoint + bucket
  return `${env.s3Endpoint.replace(/\/+$/, '')}/${env.s3Bucket}/${storageKey}`;
}

export async function saveUploadedMedia(file: File, options: SaveUploadedMediaOptions = {}) {
  if (!file || file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Invalid file size');
  }

  if (!isAllowedMimeType(file)) {
    throw new Error('Unsupported file type');
  }

  const storageKey = normalizeStorageKey(options.storageKey || generateStorageKey(file));
  const buffer = Buffer.from(await file.arrayBuffer());

  if (!validateMagicBytes(buffer, file.type)) {
    throw new Error('File content does not match declared type');
  }

  // S3-compatible storage (MinIO, R2, AWS S3)
  if (isS3Enabled()) {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: env.s3Bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: file.type || undefined,
        CacheControl: 'public, max-age=31536000'
      })
    );

    return {
      storageProvider: 's3',
      storageKey,
      url: getS3PublicUrl(storageKey),
      sizeBytes: buffer.length
    } as StoredMedia;
  }

  // Local filesystem storage (fallback for dev or forked single-tenant)
  const publicRoot = join(process.cwd(), 'public');
  const fullPath = safeJoin(publicRoot, storageKey);

  const directory = dirname(fullPath);
  await mkdir(directory, { recursive: true });

  await writeFile(fullPath, buffer);

  return {
    storageProvider: 'local',
    storageKey,
    url: `${publicUrlPrefix()}/${storageKey}`,
    sizeBytes: buffer.length
  } as StoredMedia;
}

export async function deleteUploadedMedia(storageKey: string, storageProvider: string) {
  if (!storageKey) return;

  const normalized = normalizeStorageKey(storageKey);

  // S3-compatible storage (handles 's3', 'r2', 'supabase' provider values for backward compat)
  if (storageProvider === 's3' || storageProvider === 'r2' || storageProvider === 'supabase') {
    if (!isS3Enabled()) return;
    const client = getS3Client();
    try {
      await client.send(new DeleteObjectCommand({ Bucket: env.s3Bucket, Key: normalized }));
    } catch (error) {
      if (error instanceof Error && error.name === 'NoSuchKey') return;
      throw error;
    }
    return;
  }

  // Local filesystem
  const publicRoot = join(process.cwd(), 'public');
  const fullPath = safeJoin(publicRoot, normalized);

  try {
    await readFile(fullPath);
    await unlink(fullPath);
  } catch (error) {
    if (isNotFoundError(error)) {
      return;
    }
    throw error;
  }
}

function isNotFoundError(error: unknown) {
  return typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === 'ENOENT';
}
