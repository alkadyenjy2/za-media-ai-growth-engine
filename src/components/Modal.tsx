import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
    <div className="w-full max-w-lg animate-slide-up rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4"><h2 className="text-lg">{title}</h2><button onClick={onClose} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"><X size={18} /></button></div>
      <div className="p-6">{children}</div>
    </div>
  </div>
}
