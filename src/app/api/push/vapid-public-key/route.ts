import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {getVapidPublicKey} from '@/server/push';

// GET /api/push/vapid-public-key — the browser needs the VAPID PUBLIC key to
// create a push subscription. Staff-only (same route-boundary authz as the other
// push endpoints). The key is the process-memoized one the send path also uses
// (src/server/push.ts), so subscribe and send always agree within a run. no-store:
// it is runtime config, never cache it.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({error: 'unauthorized'}, {status: 401});
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'SUB_ADMIN') {
    return NextResponse.json({error: 'forbidden'}, {status: 403});
  }

  const publicKey = await getVapidPublicKey();
  return NextResponse.json({publicKey}, {headers: {'Cache-Control': 'no-store'}});
}
