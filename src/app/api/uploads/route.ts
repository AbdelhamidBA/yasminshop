import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import sharp from 'sharp';
import {AuthzError} from '@/lib/authz';
import {requireAdmin} from '@/server/authz';
import {ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES} from '@/lib/uploads';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'products');

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthzError) {
      return NextResponse.json({error: 'forbidden'}, {status: 403});
    }
    throw error;
  }

  // Content-Length precheck: reject an oversized body BEFORE buffering the whole
  // multipart payload into memory via formData(). The per-file size is still
  // re-checked below (Content-Length is client-supplied and covers the whole
  // multipart envelope, not just the file), so this is a cheap early-out, not the
  // authoritative limit.
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({error: 'tooLarge'}, {status: 413});
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({error: 'missingFile'}, {status: 400});
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json({error: 'unsupportedType'}, {status: 400});
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({error: 'tooLarge'}, {status: 400});
  }

  const source = Buffer.from(await file.arrayBuffer());
  let processed: Buffer;
  try {
    // limitInputPixels caps the decoded dimensions (a small compressed file can
    // decode to a huge bitmap — a decompression-bomb DoS). 64MP is well above any
    // legitimate product photo but bounds the worst case.
    processed = await sharp(source, {limitInputPixels: 64_000_000})
      .rotate()
      .resize({width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true})
      .webp({quality: 82})
      .toBuffer();
  } catch {
    return NextResponse.json({error: 'invalidImage'}, {status: 400});
  }

  const name = `${randomUUID()}.webp`;
  await mkdir(UPLOAD_DIR, {recursive: true});
  await writeFile(path.join(UPLOAD_DIR, name), processed);

  return NextResponse.json({url: `/api/uploads/products/${name}`});
}
