import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface ToastProps {
  message: string | null;
  type?: 'success' | 'error';
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'success', onDismiss }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  const isError = type === 'error';

  return (
    <AnimatePresence>
      {message && (
        <div
          dir="rtl"
          className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full max-w-sm px-4 flex justify-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-full bg-[#101216] text-[#F2F5F9] shadow-[0_8px_32px_rgba(0,0,0,0.6)] border text-[14px] font-semibold select-none ${
              isError
                ? 'border-[#FF6B7A]/40 shadow-[0_8px_24px_rgba(255,107,122,0.25)]'
                : 'border-[rgba(255,255,255,0.08)]'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                isError ? 'bg-[#FF6B7A]/15 text-[#FF6B7A]' : 'bg-[#3DDC97]/15 text-[#3DDC97]'
              }`}
            >
              {isError ? (
                <AlertCircle className="w-4 h-4 text-[#FF6B7A]" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[#3DDC97]" aria-hidden="true" />
              )}
            </div>
            <span>{message}</span>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
