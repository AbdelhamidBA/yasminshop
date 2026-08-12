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
  // Only ever serve the .webp we wrote — every stored upload is normalised to
  // webp by the POST handler. Refusing any other extension keeps this route from
  // being coaxed into serving an arbitrary file type.
  const last = segments[segments.length - 1] ?? '';
  if (!isSafeUploadPath(segments) || !last.toLowerCase().endsWith('.webp')) {
    return NextResponse.json({error: 'badPath'}, {status: 400});
  }
  try {
    const file = await readFile(path.join(ROOT, ...segments));
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        // Belt-and-suspenders against content-type sniffing on a user-supplied
        // asset path.
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch {
    return NextResponse.json({error: 'notFound'}, {status: 404});
  }
}
