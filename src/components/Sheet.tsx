import type { ReactNode } from 'react';

/** Feuille modale basse (thumb-friendly, une main). */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="safe-bottom relative w-full max-w-md overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 px-4 pb-6 pt-4 shadow-2xl shadow-black"
        style={{ maxHeight: '92vh' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-base font-bold uppercase tracking-widest text-emerald-400">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="rounded-lg border border-zinc-700 px-3 py-1.5 font-mono text-sm text-zinc-300">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
