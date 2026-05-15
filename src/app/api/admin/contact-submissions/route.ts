import { NextResponse } from 'next/server';

import { assertAdminPermission } from '@/features/cms/adminAuth';
import { listContactSubmissions } from '@/features/cms/contactSubmissionsStore';

export async function GET(request: Request) {
  const result = await assertAdminPermission(request, 'content:edit');
  if ('error' in result) return result.error;

  const submissions = await listContactSubmissions();
  return NextResponse.json({ submissions });
}
