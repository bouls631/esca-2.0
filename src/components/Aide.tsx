import { useState } from 'react';

/** Aide contextuelle repliable, à placer sous un libellé ou une consigne. */
export function Aide({ text, label = '? aide' }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-zinc-700 px-2 py-0.5 font-mono text-[10px] text-zinc-400"
      >
        {open ? '✕ masquer' : label}
      </button>
      {open && (
        <p className="mt-1 rounded-lg border border-zinc-800 bg-zinc-950 p-2 font-mono text-[11px] leading-relaxed text-zinc-300">
          {text}
        </p>
      )}
    </div>
  );
}
