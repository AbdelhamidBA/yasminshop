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
    processed = await sharp(source)
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
