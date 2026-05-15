import { NextResponse } from 'next/server';

import { assertAdminRequest, logAdminAuditEvent, logoutAllSessions } from '@/features/cms/adminAuth';

export async function POST(request: Request) {
  const auth = await assertAdminRequest(request);
  if (auth instanceof NextResponse) return auth;
  const session = auth;

  await logoutAllSessions(session.user.id);

  await logAdminAuditEvent(request, {
    action: 'logout_all_sessions',
    entityType: 'admin_user',
    entityId: session.user.id,
    userId: session.user.id,
    metadata: {}
  });

  return NextResponse.json({ ok: true });
}
