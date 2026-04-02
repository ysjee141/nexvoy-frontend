'use client'

import { css } from 'styled-system/css'
import { Skeleton } from '@/components/ui/Skeleton'

export function TemplateFormSkeleton() {
    return (
        <div className={css({ w: '100%', maxW: '800px', mx: 'auto', py: { base: '20px', sm: '40px' } })}>
            {/* Header Skeleton */}
            <div className={css({ 
                mb: '32px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                gap: '12px'
            })}>
                <div className={css({ textAlign: 'left', flex: '1' })}>
                    <div className={css({ mb: '16px', display: { base: 'none', sm: 'block' } })}>
                        <Skeleton width="120px" height="20px" />
                    </div>
                    <Skeleton width="240px" height="32px" />
                </div>
                <div className={css({ borderRadius: '50%', overflow: 'hidden' })}>
                    <Skeleton width="40px" height="40px" />
                </div>
            </div>

            {/* Form Card Skeleton */}
            <div className={css({ 
                bg: 'white', 
                p: '32px', 
                borderRadius: '16px', 
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)' 
            })}>
                {/* Title Input Section */}
                <div className={css({ mb: '32px' })}>
                    <div className={css({ mb: '8px' })}>
                        <Skeleton width="80px" height="18px" />
                    </div>
                    <Skeleton width="100%" height="45px" borderRadius="8px" />
                </div>

                <hr className={css({ border: 'none', borderTop: '1px solid #eee', mb: '32px' })} />

                {/* Items List Section */}
                <div className={css({ mb: '32px' })}>
                    <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '16px' })}>
                        <Skeleton width="180px" height="20px" />
                        <Skeleton width="40px" height="18px" />
                    </div>

                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className={css({
                                display: 'flex',
                                flexDirection: { base: 'column', sm: 'row' },
                                alignItems: { base: 'stretch', sm: 'center' },
                                border: '1px solid #eaeaea',
                                borderRadius: '12px',
                                overflow: 'hidden'
                            })}>
                                <div className={css({ w: { base: '100%', sm: '140px' }, p: '14px', borderRight: { sm: '1px solid #eaeaea' }, borderBottom: { base: '1px solid #eaeaea', sm: 'none' } })}>
                                    <Skeleton width="80%" height="20px" />
                                </div>
                                <div className={css({ flex: 1, p: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                                    <Skeleton width="60%" height="20px" />
                                    <Skeleton width="24px" height="24px" borderRadius="4px" />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className={css({ mt: '16px' })}>
                        <Skeleton width="100%" height="48px" borderRadius="8px" />
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className={css({ 
                    display: 'flex', 
                    justifyContent: 'flex-end', 
                    gap: '12px', 
                    pt: '24px', 
                    borderTop: '1px solid #eee' 
                })}>
                    <Skeleton width="60px" height="40px" borderRadius="6px" />
                    <Skeleton width="160px" height="45px" borderRadius="8px" />
                </div>
            </div>
        </div>
    )
}
