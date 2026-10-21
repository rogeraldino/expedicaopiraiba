"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Check, Upload, X } from "lucide-react";

type Asset = { id: string; name: string; url: string; thumbnail_url: string };
type Photo = { url: string; label: string };
const api = process.env.NEXT_PUBLIC_API_URL ?? "/api";

function message(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object") return Object.values(value).flat().join(" ");
  return "Não foi possível carregar as imagens.";
}

export function MediaPicker({ token, legacyPhotos, currentUrl, selectedUrls = [], multiple = false, onSelect, close }: {
  token: string; legacyPhotos: Photo[]; currentUrl?: string; selectedUrls?: string[];
  multiple?: boolean; onSelect: (url: string) => void; close: () => void;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); inFlight.current?.abort(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const task = window.setTimeout(async () => {
      setLoading(true);
      setFailure("");
      try {
        const response = await fetch(`${api}/operations/media/?page=${page}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw data;
        if (controller.signal.aborted) return;
        setAssets(current => [...current, ...data.results].filter((asset, index, all) => all.findIndex(item => item.id === asset.id) === index));
        setHasMore(Boolean(data.next));
      } catch (error) {
        if (!controller.signal.aborted) setFailure(message(error));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 0);
    return () => { window.clearTimeout(task); controller.abort(); };
  }, [token, page, retry]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploading) return;
    if (file.size > 10 * 1024 * 1024) { setFailure("A imagem deve ter no máximo 10 MB."); return; }
    setUploading(true);
    setFailure("");
    setNotice("");
    const controller = new AbortController();
    inFlight.current = controller;
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`${api}/operations/media/`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body, signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw data;
      setAssets(current => [data, ...current]);
      setNotice("Foto enviada. Selecione-a abaixo para usar no cadastro.");
    } catch (error) {
      if (!controller.signal.aborted) setFailure(message(error));
    } finally {
      if (!controller.signal.aborted) setUploading(false);
    }
  }

  const photos = [
    ...assets.map(asset => ({ url: asset.url, thumbnail: asset.thumbnail_url, label: asset.name })),
    ...legacyPhotos.map(photo => ({ ...photo, thumbnail: photo.url })),
  ];

  return (
    <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!uploading) close(); }} aria-labelledby="media-picker-title" className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-black/60">
      <div className="flex items-center justify-between border-b p-5">
        <h3 id="media-picker-title" className="text-lg font-black">{multiple ? "Fotos da expedição" : "Escolha uma imagem"}</h3>
        <button type="button" onClick={close} disabled={uploading} aria-label="Fechar biblioteca" className="rounded-lg p-2 disabled:opacity-50"><X className="size-5" /></button>
      </div>
      <div className="border-b bg-sand-50 p-5">
        <p className="text-sm text-ink-700">Envie fotos de divulgação para usar nas capas e galerias. As imagens enviadas terão um endereço público. Não envie documentos pessoais.</p>
        <p className="mt-1 text-xs text-ink-500">JPEG, PNG ou WebP estático, até 10 MB e 24 milhões de pixels.</p>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void upload(event)} disabled={uploading} className="sr-only" aria-label="Selecionar foto para enviar" />
        <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 font-bold text-white disabled:opacity-50"><Upload className="size-4" />{uploading ? "Enviando foto..." : "Enviar nova foto"}</button>
        {notice && <p role="status" className="mt-2 text-sm text-brand-800">{notice}</p>}
        {failure && <div role="alert" className="mt-2 text-sm text-red-700">{failure}<button type="button" onClick={() => setRetry(value => value + 1)} className="ml-3 underline">Tentar carregar novamente</button></div>}
      </div>
      <div className="max-h-[50dvh] overflow-y-auto p-5" aria-busy={loading || uploading}>
        <p className="mb-3 text-xs text-ink-500">{multiple ? "Selecione as fotos que deseja incluir na galeria." : "Selecione uma foto para usar como capa."}</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {photos.map(photo => {
            const selected = multiple ? selectedUrls.includes(photo.url) : currentUrl === photo.url;
            return <button type="button" key={photo.url} aria-pressed={selected} onClick={() => { onSelect(photo.url); if (!multiple) close(); }} disabled={uploading} className={`relative overflow-hidden rounded-xl border-2 text-left ${selected ? "border-brand-600 ring-2 ring-brand-500" : "border-gray-200 hover:border-brand-400"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- uploaded WebP already has a server thumbnail */}
              <img src={photo.thumbnail} alt={photo.label} loading="lazy" className="aspect-video w-full object-cover" />
              {selected && <span className="absolute right-2 top-2 rounded-full bg-brand-600 p-1 text-white"><Check className="size-4" /></span>}
              <span className="block truncate p-2 text-xs font-bold">{photo.label}</span>
            </button>;
          })}
        </div>
        {loading && <p role="status" className="mt-4 text-sm">Carregando biblioteca...</p>}
        {hasMore && !loading && <button type="button" onClick={() => setPage(value => value + 1)} className="mt-4 rounded-lg border px-4 py-2 text-sm font-bold">Carregar mais fotos</button>}
      </div>
      <div className="flex justify-end border-t p-4"><button type="button" onClick={close} disabled={uploading} className="rounded-lg border px-4 py-2 font-bold">{multiple ? "Concluir seleção" : "Fechar"}</button></div>
    </dialog>
  );
}
