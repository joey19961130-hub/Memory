import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { ImagePlus, Star, Trash2, ChevronLeft, ChevronRight, Film, Upload } from 'lucide-react';
import { uploadImage, uploadVideo, isDemoMode, type UploadFolder } from '@/lib/content';

export const errorText = (e: unknown) =>
  e instanceof Error
    ? e.message
    : typeof e === 'object' && e && 'message' in e
      ? String((e as { message: unknown }).message)
      : String(e);

export const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white';

/** Drag-and-drop (or click) file target. */
export function DropZone({
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  children,
  className = '',
  label,
}: {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  children?: ReactNode;
  className?: string;
  label: string;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);

  const take = (list: FileList | null) => {
    if (!list || disabled || list.length === 0) return;
    const files = Array.from(list);
    onFiles(multiple ? files : files.slice(0, 1));
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    take(e.dataTransfer.files);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-disabled={disabled}
      data-dropzone
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), inputRef.current?.click())}
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current++;
        setOver(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setOver(false);
      }}
      onDrop={onDrop}
      className={`relative flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-center cursor-pointer transition-all duration-200 ${
        over ? 'border-slate-700 bg-slate-100 scale-[1.01]' : 'border-slate-300 hover:border-slate-500 hover:bg-slate-50'
      } ${disabled ? 'opacity-50 cursor-wait' : ''} ${className}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
      {children}
    </div>
  );
}

/** Single image (logo, about photo) with drag-drop, URL fallback and preview. */
export function ImageInput({
  value,
  folder,
  onChange,
  checker = false,
}: {
  value: string;
  folder: UploadFolder;
  onChange: (url: string) => void;
  /** checkerboard behind the preview, to judge transparent logos */
  checker?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onFiles = async ([file]: File[]) => {
    setBusy(true);
    setErr('');
    try {
      onChange(await uploadImage(file, folder));
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <DropZone accept="image/*" onFiles={onFiles} disabled={busy} label="上傳圖片" className="p-3 min-h-[120px]">
        {value ? (
          <div
            className="w-full h-32 rounded-lg overflow-hidden flex items-center justify-center"
            style={
              checker
                ? { backgroundImage: 'repeating-conic-gradient(#e2e8f0 0% 25%, #fff 0% 50%)', backgroundSize: '16px 16px' }
                : { backgroundColor: '#f1f5f9' }
            }
          >
            <img src={value} alt="" className={checker ? 'max-h-24 max-w-[80%] object-contain' : 'w-full h-full object-cover'} />
          </div>
        ) : (
          <ImagePlus className="text-slate-400" size={28} />
        )}
        <span className="text-xs text-slate-500">{busy ? '上傳中…' : value ? '拖曳或點擊以更換' : '拖曳圖片到這裡，或點擊選擇'}</span>
      </DropZone>
      <div className="flex gap-2 items-center">
        <input
          className={inputCls}
          placeholder="或貼上圖片網址"
          value={value.startsWith('data:') ? '（已上傳圖片）' : value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={value.startsWith('data:')}
        />
        {value && (
          <button type="button" className="shrink-0 text-xs text-red-600 hover:underline" onClick={() => onChange('')}>
            移除
          </button>
        )}
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}

/** Multi-photo manager: drop many files, drag thumbnails to reorder, first = cover. */
export function GalleryInput({ value, onChange }: { value: string[]; onChange: (urls: string[]) => void }) {
  const [pending, setPending] = useState(0);
  const [err, setErr] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const latest = useRef(value);
  latest.current = value;

  const onFiles = async (files: File[]) => {
    setErr('');
    setPending((n) => n + files.length);
    const results = await Promise.allSettled(files.map((f) => uploadImage(f, 'products')));
    setPending((n) => n - files.length);
    const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (ok.length) onChange([...latest.current, ...ok]);
    if (failed.length) setErr(`${failed.length} 張上傳失敗：${errorText(failed[0].reason)}`);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2" aria-label="商品照片（拖曳排序）">
          {value.map((url, i) => (
            <li
              key={url + i}
              draggable
              onDragStart={(e) => {
                setDragIdx(i);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(i));
              }}
              onDragOver={(e) => {
                if (dragIdx === null) return;
                e.preventDefault();
                setOverIdx(i);
              }}
              onDrop={(e) => {
                if (dragIdx === null) return;
                e.preventDefault();
                e.stopPropagation();
                move(dragIdx, i);
                setDragIdx(null);
                setOverIdx(null);
              }}
              onDragEnd={() => {
                setDragIdx(null);
                setOverIdx(null);
              }}
              className={`group relative aspect-square rounded-lg overflow-hidden bg-slate-100 cursor-grab active:cursor-grabbing transition-all duration-200 ${
                dragIdx === i ? 'opacity-40 scale-95' : ''
              } ${overIdx === i && dragIdx !== i ? 'ring-2 ring-slate-700 ring-offset-2' : ''}`}
            >
              <img src={url} alt={`照片 ${i + 1}`} className="w-full h-full object-cover pointer-events-none" />
              {i === 0 && (
                <span className="absolute top-1 left-1 rounded bg-slate-900/80 text-white text-[10px] px-1.5 py-0.5">封面</span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-between p-1 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button type="button" aria-label="往前" className="p-1 text-white disabled:opacity-30" disabled={i === 0} onClick={() => move(i, i - 1)}>
                  <ChevronLeft size={14} />
                </button>
                {i !== 0 && (
                  <button type="button" aria-label="設為封面" title="設為封面" className="p-1 text-white" onClick={() => move(i, 0)}>
                    <Star size={14} />
                  </button>
                )}
                <button type="button" aria-label="刪除照片" className="p-1 text-white" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  <Trash2 size={14} />
                </button>
                <button type="button" aria-label="往後" className="p-1 text-white disabled:opacity-30" disabled={i === value.length - 1} onClick={() => move(i, i + 1)}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </li>
          ))}
          {Array.from({ length: pending }, (_, i) => (
            <li key={`p${i}`} className="aspect-square rounded-lg bg-slate-200 animate-pulse" aria-label="上傳中" />
          ))}
        </ul>
      )}
      <DropZone accept="image/*" multiple onFiles={onFiles} label="上傳商品照片" className="p-5">
        <Upload className="text-slate-400" size={24} />
        <span className="text-sm text-slate-600">拖曳多張照片到這裡，或點擊選擇</span>
        <span className="text-xs text-slate-400">第一張是封面 · 可拖曳縮圖調整順序 · 點 ★ 設為封面</span>
        {pending > 0 && value.length === 0 && <span className="text-xs text-slate-500">上傳中（{pending}）…</span>}
      </DropZone>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}

/** Hero video: upload (Supabase) or paste URL, with an inline preview. */
export function VideoInput({ value, onChange, defaultUrl }: { value: string; onChange: (url: string) => void; defaultUrl: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const onFiles = async ([file]: File[]) => {
    setBusy(true);
    setErr('');
    try {
      onChange(await uploadVideo(file));
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <DropZone accept="video/mp4" onFiles={onFiles} disabled={busy || isDemoMode} label="上傳背景影片" className="p-3 min-h-[120px]">
        {value ? (
          <video key={value} src={value} muted playsInline preload="metadata" className="w-full h-32 rounded-lg object-cover bg-slate-100" />
        ) : (
          <Film className="text-slate-400" size={28} />
        )}
        <span className="text-xs text-slate-500">
          {isDemoMode ? '示範模式不能上傳影片，可貼網址' : busy ? '影片上傳中，請稍候…' : '拖曳 MP4 影片到這裡，或點擊選擇（50MB 內）'}
        </span>
      </DropZone>
      <div className="flex gap-2 items-center">
        <input className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} placeholder="或貼上 mp4 網址" />
        {value !== defaultUrl && (
          <button type="button" className="shrink-0 text-xs text-slate-600 hover:underline" onClick={() => onChange(defaultUrl)}>
            還原預設
          </button>
        )}
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
