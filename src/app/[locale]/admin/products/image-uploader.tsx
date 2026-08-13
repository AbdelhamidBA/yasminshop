'use client';

import {useId, useRef, useState} from 'react';
import {ArrowDown, ArrowUp, ImageUp, LoaderCircle, Star, TriangleAlert, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
import {ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES} from '@/lib/uploads';
import {cn} from '@/lib/utils';

export type FormImage = {url: string; sortOrder: number};

// Per-file failure codes. Each one is a message key under
// `admin.productForm`, so a failure is always named in the operator's
// language next to the file it belongs to — never one global "upload failed".
type UploadErrorCode = 'fileUnsupported' | 'fileTooLarge' | 'uploadFailed';

type Task = {
  id: string;
  name: string;
  progress: number;
  status: 'queued' | 'uploading' | 'error';
  error?: UploadErrorCode;
};

// The accept list and the size cap are READ FROM the same module the API route
// validates against (lib/uploads.ts), so the picker, the client precheck and
// the server can never drift apart. The client check is a courtesy — it names
// the bad file instantly instead of after an 8 MB round trip — and the route
// re-validates everything regardless.
const ACCEPT = Array.from(ALLOWED_IMAGE_TYPES).join(',');

class UploadFailure extends Error {
  readonly code: UploadErrorCode;
  constructor(code: UploadErrorCode) {
    super(code);
    this.code = code;
  }
}

function validateFile(file: File): UploadErrorCode | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return 'fileUnsupported';
  if (file.size > MAX_UPLOAD_BYTES) return 'fileTooLarge';
  return null;
}

/**
 * One POST to /api/uploads. XHR rather than fetch purely for
 * `upload.progress`: with several files in flight the operator needs to see
 * WHICH file is moving, and fetch exposes no upload progress. Capped at 99%
 * until the response lands — the server still has to transcode with sharp
 * after the last byte arrives, and claiming 100% while it does would be a lie.
 */
function uploadOne(file: File, onProgress: (percent: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', '/api/uploads');
    request.responseType = 'json';
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    });
    request.addEventListener('load', () => {
      const url = (request.response as {url?: string} | null)?.url;
      if (request.status >= 200 && request.status < 300 && typeof url === 'string' && url) {
        resolve(url);
        return;
      }
      // 413 is the route's Content-Length early-out; everything else is a
      // generic failure the operator can retry.
      reject(new UploadFailure(request.status === 413 ? 'fileTooLarge' : 'uploadFailed'));
    });
    request.addEventListener('error', () => reject(new UploadFailure('uploadFailed')));
    request.addEventListener('abort', () => reject(new UploadFailure('uploadFailed')));
    const body = new FormData();
    body.set('file', file);
    request.send(body);
  });
}

export function ImageUploader({
  images,
  onChange,
  disabled
}: {
  images: FormImage[];
  onChange: (images: FormImage[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('admin.productForm');
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave also fire crossing the zone's own children, so the
  // highlight is driven by a depth counter rather than by the last event.
  const dragDepth = useRef(0);
  const queue = useRef<Array<{id: string; file: File}>>([]);
  const running = useRef(false);

  // The committed list, readable from the async upload loop. `images` is a
  // prop: a closure captured when the batch started would append onto a stale
  // array and every file after the first would clobber the previous one.
  const imagesRef = useRef(images);
  imagesRef.current = images;

  const renumber = (list: FormImage[]) => list.map((image, index) => ({...image, sortOrder: index}));

  function commit(next: FormImage[]) {
    const numbered = renumber(next);
    imagesRef.current = numbered;
    onChange(numbered);
  }

  function patchTask(id: string, patch: Partial<Task>) {
    setTasks((prev) => prev.map((task) => (task.id === id ? {...task, ...patch} : task)));
  }

  async function drain() {
    if (running.current) return;
    running.current = true;
    try {
      for (let item = queue.current.shift(); item; item = queue.current.shift()) {
        const {id, file} = item;
        patchTask(id, {status: 'uploading'});
        try {
          const url = await uploadOne(file, (percent) => patchTask(id, {progress: percent}));
          commit([...imagesRef.current, {url, sortOrder: imagesRef.current.length}]);
          // The thumbnail IS the success state — the row would be noise.
          setTasks((prev) => prev.filter((task) => task.id !== id));
        } catch (error) {
          patchTask(id, {
            status: 'error',
            error: error instanceof UploadFailure ? error.code : 'uploadFailed'
          });
        }
      }
    } finally {
      running.current = false;
    }
  }

  /** Accepts a whole multi-select pick (or a drop) and queues every file. */
  function enqueue(picked: FileList | null) {
    const files = Array.from(picked ?? []);
    if (files.length === 0) return;
    const accepted: Array<{id: string; file: File}> = [];
    const queued: Task[] = [];
    files.forEach((file, index) => {
      const id = `${Date.now()}-${index}-${file.name}-${file.size}`;
      const problem = validateFile(file);
      if (problem) {
        queued.push({id, name: file.name, progress: 0, status: 'error', error: problem});
        return;
      }
      queued.push({id, name: file.name, progress: 0, status: 'queued'});
      accepted.push({id, file});
    });
    setTasks((prev) => [...prev, ...queued]);
    queue.current.push(...accepted);
    // Uploads run one at a time: it keeps sharp off a thundering herd AND makes
    // the resulting sortOrder match the order the operator picked the files in.
    void drain();
  }

  const busy = tasks.some((task) => task.status !== 'error');
  const failed = tasks.filter((task) => task.status === 'error');
  const active = tasks.filter((task) => task.status !== 'error');

  return (
    <div className="flex flex-col gap-4">
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li
              key={image.url}
              className="flex h-full flex-col overflow-hidden rounded-xl bg-(--admin-neutral-soft)"
            >
              {/* Square, and capped: on a wide screen a 4-column grid makes an
                  uncapped square tile tall enough to push the controls off the
                  fold, and any tile whose media reports a different intrinsic
                  size drags its grid row taller than its neighbours. */}
              <div className="relative aspect-square max-h-56">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" className="size-full object-cover" />
                {index === 0 && (
                  // sortOrder 0 is the image the storefront shows everywhere —
                  // grid card, cart line, order slip. Say so on the thumbnail.
                  <span className="absolute start-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-card px-1.5 py-1 text-[11px] leading-none font-bold text-(--admin-primary-dark) shadow-card">
                    <Star aria-hidden="true" className="size-3" />
                    {t('primaryImage')}
                  </span>
                )}
                {!disabled && (
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={t('removeImage')}
                    className="absolute end-1.5 top-1.5 rounded-full bg-card text-muted-foreground shadow-card hover:bg-card hover:text-destructive"
                    onClick={() => commit(imagesRef.current.filter((_, i) => i !== index))}
                  >
                    <X />
                  </Button>
                )}
              </div>
              {!disabled && (
                // Always rendered (never hover-only) so every control stays
                // keyboard reachable and visibly focusable.
                <div className="flex items-center gap-0.5 bg-card px-1.5 py-1">
                  <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="ms-auto flex items-center gap-0.5">
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label={t('makePrimary')}
                      disabled={index === 0}
                      onClick={() => {
                        const list = imagesRef.current;
                        commit([list[index], ...list.filter((_, i) => i !== index)]);
                      }}
                    >
                      <Star />
                    </Button>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label={t('moveUp')}
                      disabled={index === 0}
                      onClick={() => {
                        const list = [...imagesRef.current];
                        [list[index - 1], list[index]] = [list[index], list[index - 1]];
                        commit(list);
                      }}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label={t('moveDown')}
                      disabled={index === images.length - 1}
                      onClick={() => {
                        const list = [...imagesRef.current];
                        [list[index], list[index + 1]] = [list[index + 1], list[index]];
                        commit(list);
                      }}
                    >
                      <ArrowDown />
                    </Button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {disabled ? (
        images.length === 0 && (
          <p className="rounded-xl bg-(--admin-neutral-soft) px-4 py-3 text-sm text-muted-foreground">
            {t('noImages')}
          </p>
        )
      ) : (
        <>
          {/* ONE file input, `multiple`, and still the only input[type=file] on
              the page — setInputFiles with a single path keeps working. */}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(event) => {
              enqueue(event.target.files);
              // Reset so re-picking the SAME file still fires a change event.
              event.target.value = '';
            }}
          />
          <button
            type="button"
            aria-describedby={hintId}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              dragDepth.current += 1;
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault();
              dragDepth.current = Math.max(0, dragDepth.current - 1);
              if (dragDepth.current === 0) setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              dragDepth.current = 0;
              setDragging(false);
              enqueue(event.dataTransfer.files);
            }}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 text-center transition-colors',
              'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              images.length === 0 ? 'py-10' : 'py-6',
              dragging
                ? 'border-(--admin-primary-dark) bg-(--admin-primary-soft)'
                : 'border-input bg-(--admin-neutral-soft) hover:border-(--admin-primary-dark) hover:bg-(--admin-primary-soft)'
            )}
          >
            <ImageUp aria-hidden="true" className="size-7 text-(--admin-primary-dark)" />
            <span className="text-sm font-semibold text-foreground">{t('dropTitle')}</span>
            <span className="text-sm font-semibold text-(--admin-primary-dark) underline underline-offset-4">
              {t('dropAction')}
            </span>
            {/* aria-hidden keeps the button's NAME short; aria-describedby still
                pulls the formats/size line in as its description. */}
            <span id={hintId} aria-hidden="true" className="text-xs text-muted-foreground">
              {t('uploadHint')}
            </span>
          </button>

          {/* Per-file progress, then per-file failures — each one names its own
              file, so a bad file in a batch of ten is identifiable. */}
          {(active.length > 0 || failed.length > 0) && (
            <ul aria-live="polite" className="flex flex-col gap-2">
              {active.map((task) => (
                <li key={task.id} className="rounded-xl bg-(--admin-neutral-soft) px-3 py-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-3.5 shrink-0 animate-spin text-(--admin-primary-dark)"
                    />
                    <span dir="auto" className="min-w-0 flex-1 truncate">
                      {task.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {/* A percentage only once there IS one: a small file can
                          finish sending before the first progress event, and
                          "0%" next to a spinner reads as stuck. */}
                      {task.status === 'queued'
                        ? t('queued')
                        : task.progress === 0
                          ? t('uploading')
                          : `${task.progress}%`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-card">
                    <div
                      className="h-full rounded-full bg-(--admin-primary-main) transition-[width] duration-200"
                      style={{width: `${task.status === 'queued' ? 0 : task.progress}%`}}
                    />
                  </div>
                </li>
              ))}
              {failed.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-2 rounded-xl bg-(--admin-error-soft) px-3 py-2.5 text-xs font-semibold text-(--admin-error)"
                >
                  <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
                  <span dir="auto" className="min-w-0 shrink truncate">
                    {task.name}
                  </span>
                  <span className="min-w-0 flex-1 font-medium">
                    {t(task.error ?? 'uploadFailed')}
                  </span>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={t('dismissError')}
                    className="-me-1 shrink-0 text-(--admin-error) hover:bg-(--admin-error-soft)"
                    onClick={() => setTasks((prev) => prev.filter((item) => item.id !== task.id))}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {/* Quiet running total; the batch state lives in the rows above. */}
          {images.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('imageCount', {count: images.length})}
              {busy ? ` · ${t('uploading')}` : ''}
            </p>
          )}
        </>
      )}
    </div>
  );
}
