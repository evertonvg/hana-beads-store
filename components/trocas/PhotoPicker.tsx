"use client";

import { useEffect, useId, useState } from "react";
import { ErrorCode, useDropzone, type FileRejection } from "react-dropzone";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import {
  MAX_RETURN_PHOTO_BYTES,
  MAX_RETURN_PHOTOS,
  RETURN_PHOTO_TYPES,
} from "@/lib/validation/return";

const MAX_MB = MAX_RETURN_PHOTO_BYTES / 1024 / 1024;

/** pt-BR text for what react-dropzone reports; unknown codes get a generic line. */
function rejectionText({ file, errors }: FileRejection): string {
  switch (errors[0]?.code as ErrorCode | undefined) {
    case ErrorCode.FileInvalidType:
      return `${file.name}: use fotos JPG, PNG ou WebP.`;
    case ErrorCode.FileTooLarge:
      return `${file.name}: a foto passa de ${MAX_MB} MB.`;
    case ErrorCode.TooManyFiles:
      return `Envie no máximo ${MAX_RETURN_PHOTOS} fotos.`;
    default:
      return `${file.name}: não foi possível usar essa foto.`;
  }
}

function Thumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    // Object URLs exist only in the browser, so they cannot be created while rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return (
    <li className="flex items-center gap-3 border-[3px] border-border bg-deep-2 p-2">
      {/* Blob preview of a local file: next/image cannot optimize it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="size-12 flex-none object-cover" /> : null}
      <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover foto ${file.name}`}
        className="flex size-11 flex-none cursor-pointer items-center justify-center border-[3px] border-border text-text outline-offset-2 outline-cyan hover:border-danger focus-visible:outline-[3px]"
      >
        <Icon name="close" size={18} />
      </button>
    </li>
  );
}

type Props = {
  value: File[];
  onChange: (files: File[]) => void;
  /** Validation message from the form (e.g. returned by the server). */
  error?: string;
};

/** Photo field on react-dropzone: drop or pick files, preview, remove, errors in an aria-live region. */
export function PhotoPicker({ value, onChange, error }: Props) {
  const inputId = useId();
  const [rejections, setRejections] = useState<string[]>([]);
  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    accept: Object.fromEntries(RETURN_PHOTO_TYPES.map((t) => [t, []])),
    maxSize: MAX_RETURN_PHOTO_BYTES,
    maxFiles: MAX_RETURN_PHOTOS,
    // The button below is the keyboard and pointer trigger; the area only takes drops.
    noClick: true,
    noKeyboard: true,
    onDrop: (accepted, fileRejections) => {
      const messages = fileRejections.map(rejectionText);
      const room = MAX_RETURN_PHOTOS - value.length;
      if (accepted.length > room) {
        messages.push(`Envie no máximo ${MAX_RETURN_PHOTOS} fotos.`);
      }
      setRejections([...new Set(messages)]);
      if (room > 0 && accepted.length > 0) onChange([...value, ...accepted.slice(0, room)]);
    },
  });
  const messages = error ? [...rejections, error] : rejections;
  const full = value.length >= MAX_RETURN_PHOTOS;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="flex flex-col gap-1 text-sm text-text">
        Fotos da peça
        <span className="text-xs text-text-subtle">ajudam a resolver mais rápido</span>
      </label>
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-start gap-3 border-[3px] border-dashed p-4",
          isDragActive ? "border-accent bg-surface-2" : "border-border bg-deep-2",
        )}
      >
        <input {...getInputProps({ id: inputId })} />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={open}
          disabled={full}
          className="min-h-11"
        >
          <Icon name="upload" size={16} />
          ESCOLHER FOTOS
        </Button>
        <p className="m-0 text-xs text-text-subtle">
          Ou arraste aqui. JPG, PNG ou WebP, até {MAX_MB} MB cada, no máximo {MAX_RETURN_PHOTOS}{" "}
          fotos.
        </p>
      </div>
      {value.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Fotos escolhidas">
          {value.map((file, i) => (
            <Thumb
              key={`${file.name}-${file.size}-${file.lastModified}-${i}`}
              file={file}
              onRemove={() => {
                setRejections([]);
                onChange(value.filter((_, j) => j !== i));
              }}
            />
          ))}
        </ul>
      ) : null}
      <div aria-live="polite" className="flex flex-col gap-1">
        {messages.map((m) => (
          <p key={m} className="m-0 text-xs text-danger-text">
            {m}
          </p>
        ))}
      </div>
    </div>
  );
}
