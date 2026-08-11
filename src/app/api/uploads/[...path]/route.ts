import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {NextResponse} from 'next/server';
import {isSafeUploadPath} from '@/lib/uploads';

const ROOT = path.join(process.cwd(), 'uploads');

export async function GET(
  _request: Request,
  {params}: {params: Promise<{path: string[]}>}
) {
  const {path: segments} = await params;
  if (!isSafeUploadPath(segments)) {
    return NextResponse.json({error: 'badPath'}, {status: 400});
  }
  try {
    const file = await readFile(path.join(ROOT, ...segments));
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch {
    return NextResponse.json({error: 'notFound'}, {status: 404});
  }
}
