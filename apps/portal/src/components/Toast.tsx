import { useEffect, useRef, useState } from 'react';

export function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error'; onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const h = setTimeout(() => setVisible(false), 3200);
    const r = setTimeout(onDone, 3700);
    return () => { clearTimeout(h); clearTimeout(r); };
  }, [onDone]);
  return (
    <div className={`fixed bottom-5 left-5 z-[100] flex items-start gap-3 bg-white shadow-lg rounded-xl px-4 py-3 max-w-sm border border-[#E5E7EB] transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
      <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${type === 'error' ? 'bg-red-100' : 'bg-emerald-100'}`}>
        {type === 'error'
          ? <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
          : <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
        }
      </div>
      <p className="text-sm text-[#374151] leading-snug">{message}</p>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  function show(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3800);
  }
  return { toast, show, clear: () => setToast(null) };
}
