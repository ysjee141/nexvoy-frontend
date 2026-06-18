'use client'

import { useToastStore, ToastType } from '@/stores/useToastStore'
import { motion, AnimatePresence } from 'framer-motion'
import { css } from 'styled-system/css'
import { CheckCircle2, AlertCircle, Info, Loader2, X } from 'lucide-react'

const getToastIcon = (type: ToastType) => {
    switch (type) {
        case 'success': return <CheckCircle2 size={18} className={css({ color: 'green.500' })} />
        case 'error': return <AlertCircle size={18} className={css({ color: 'red.500' })} />
        case 'loading': return <Loader2 size={18} className={css({ color: 'brand.primary', animation: 'spin 1s linear infinite' })} />
        default: return <Info size={18} className={css({ color: 'blue.500' })} />
    }
}

const getToastStyles = (type: ToastType) => {
    return css({
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        bg: 'white',
        color: 'brand.ink',
        px: '16px',
        py: '12px',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        border: '1px solid',
        borderColor: 'brand.hairline',
        minW: '280px',
        maxW: '90vw',
        pointerEvents: 'auto',
    })
}

export default function ToastContainer() {
    const { toasts, removeToast } = useToastStore()

    return (
        <div className={css({
            position: 'fixed',
            bottom: 'max(24px, env(safe-area-inset-bottom) + 16px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            pointerEvents: 'none',
        })}>
            <AnimatePresence>
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        className={getToastStyles(toast.type)}
                    >
                        {getToastIcon(toast.type)}
                        <span className={css({ 
                            fontSize: '14px', 
                            fontWeight: '500',
                            flex: 1,
                            lineHeight: '1.4'
                        })}>
                            {toast.message}
                        </span>
                        {toast.type !== 'loading' && (
                            <button 
                                onClick={() => removeToast(toast.id)}
                                className={css({ 
                                    p: '4px',
                                    borderRadius: '50%',
                                    _hover: { bg: 'bg.surfaceSoft' },
                                    color: 'brand.muted',
                                    cursor: 'pointer'
                                })}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </motion.div>
                ))}
            </AnimatePresence>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
