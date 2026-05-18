import { NextResponse } from 'next/server';

import { assertAdminPermission, assertAdminRequest, logAdminAuditEvent } from '@/features/cms/adminAuth';
import { createCategory, getCategories } from '@/features/cms/contentStore';
import { revalidatePublicCmsCache } from '@/features/cms/publicCache';
import { validateCategory } from '@/features/cms/validators';
import { DEFAULT_TENANT_ID } from '@/db/tenantConstants';

export async function GET(request: Request) {
  const auth = await assertAdminRequest(request);
  if (auth instanceof NextResponse) return auth;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const session = auth;

  const categories = await getCategories(DEFAULT_TENANT_ID);
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const auth = await assertAdminPermission(request, 'taxonomy:edit');
  if ('error' in auth) return auth.error;

  const session = auth.session;

  const payload = validateCategory(await request.json().catch(() => null));
  if (!payload) {
    return NextResponse.json({ error: 'Invalid category payload' }, { status: 400 });
  }

  const category = await createCategory(payload, DEFAULT_TENANT_ID);

  try {
    await logAdminAuditEvent(request, {
      action: 'category.create',
      entityType: 'category',
      entityId: category.id,
      userId: session.user.id,
      metadata: {
        name: category.name,
        slug: category.slug
      }
    });
  } catch {
    // swallow audit log failures
  }

  revalidatePublicCmsCache();
  return NextResponse.json({ category }, { status: 201 });
}
