const fallbackBaseUrl = 'http://localhost:3000';

const clean = (value: string | undefined) => value?.trim().replace(/^['"]|['"]$/g, '') || '';
const parsePositiveInt = (value: string | undefined) => {
  const normalized = clean(value);
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
};
const parseContactWebhookMethod = (value: string | undefined): 'POST' | 'PUT' | 'PATCH' => {
  const normalized = clean(value).toUpperCase();
  return normalized === 'PUT' || normalized === 'PATCH' ? normalized : 'POST';
};

export const env = {
  get siteUrl() {
    return clean(process.env.NEXT_PUBLIC_SITE_URL) || fallbackBaseUrl;
  },
  get adminToken() {
    return clean(process.env.CMS_ADMIN_TOKEN) || '';
  },
  get adminEmail() {
    return clean(process.env.CMS_ADMIN_EMAIL) || 'admin@example.local';
  },
  get adminPassword() {
    return clean(process.env.CMS_ADMIN_PASSWORD) || clean(process.env.CMS_ADMIN_TOKEN);
  },
  get adminName() {
    return clean(process.env.CMS_ADMIN_NAME) || 'Administrator';
  },
  get orgName() {
    return clean(process.env.CMS_ORG_NAME) || 'Acme Marketing';
  },
  get orgLogo() {
    return clean(process.env.CMS_ORG_LOGO) || 'https://placehold.co/240x80/png';
  },
  get databaseUrl() {
    return clean(process.env.DATABASE_URL);
  },
  get redisUrl() {
    return clean(process.env.REDIS_URL);
  },
  get databasePoolMax() {
    return parsePositiveInt(process.env.CMS_DB_POOL_MAX);
  },
  get s3Endpoint() {
    return clean(process.env.S3_ENDPOINT);
  },
  get s3AccessKey() {
    return clean(process.env.S3_ACCESS_KEY);
  },
  get s3SecretKey() {
    return clean(process.env.S3_SECRET_KEY);
  },
  get s3Bucket() {
    return clean(process.env.S3_BUCKET) || 'cms-media';
  },
  get s3PublicUrl() {
    return clean(process.env.S3_PUBLIC_URL);
  },
  get s3Region() {
    return clean(process.env.S3_REGION) || 'us-east-1';
  },
  /** Storage quota in MB. Default 1000 MB. */
  get storageQuotaMb() {
    return parsePositiveInt(process.env.CMS_STORAGE_QUOTA_MB) ?? 1000;
  },
  get databaseMigrationUrl() {
    return clean(process.env.DATABASE_URL_MIGRATION) || clean(process.env.DATABASE_URL);
  },
  get mediaPublicBaseUrl() {
    return clean(process.env.MEDIA_PUBLIC_BASE_URL) || clean(process.env.NEXT_PUBLIC_MEDIA_BASE_URL) || '';
  },
  get contactNotificationWebhookUrl() {
    return clean(process.env.CONTACT_NOTIFICATION_WEBHOOK_URL);
  },
  get contactNotificationWebhookMethod() {
    return parseContactWebhookMethod(process.env.CONTACT_NOTIFICATION_WEBHOOK_METHOD);
  },
  get contactNotificationWebhookToken() {
    return clean(process.env.CONTACT_NOTIFICATION_WEBHOOK_TOKEN);
  },
  /** Set CMS_ENABLE_DEV_AUTH=true to allow x-admin-token header auth in non-production environments. */
  get enableDevAuth() {
    return clean(process.env.CMS_ENABLE_DEV_AUTH).toLowerCase() === 'true';
  },
  /**
   * Number of trusted reverse proxies in front of the app (e.g. 1 for Vercel/Cloudflare).
   * Set to 0 when the app receives connections directly (no proxy).
   * Used to extract the real client IP from X-Forwarded-For without trusting attacker-injected entries.
   */
  get trustedProxyCount() {
    const val = parseInt(clean(process.env.TRUSTED_PROXY_COUNT) || '0', 10);
    return Number.isFinite(val) && val >= 0 ? val : 0;
  },
  /**
   * Optional application-level pepper for password hashing (hex-encoded, 32+ bytes).
   * When set, password hashes are XORed with this secret so a DB-only breach cannot crack passwords offline.
   * If empty, passwords are hashed with scrypt + random salt only (still secure, but no defense-in-depth).
   */
  get passwordPepper() {
    return clean(process.env.PASSWORD_PEPPER);
  }
};
