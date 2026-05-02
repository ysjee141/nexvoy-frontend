'use client'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import Link from 'next/link'
import { Plus, ListTodo } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Skeleton from '@/components/ui/Skeleton'
import CommonListSkeleton from '@/components/common/CommonListSkeleton'
import { formatDate } from '@/utils/date'

import { useUIStore } from '@/stores/useUIStore'
import { CacheUtil } from '@/utils/cache'

export default function TemplatesPage() {
    const supabase = createClient()
    const router = useRouter()
    const { 
        setIsNewTemplateModalOpen, 
        setIsEditTemplateModalOpen, 
        setEditingTemplateId 
    } = useUIStore()

    const [templates, setTemplates] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchTemplates() {
            const { data: { user: networkUser } } = await supabase.auth.getUser()
            const user = networkUser || await CacheUtil.getAuthUser()
            
            if (!user) {
                router.push('/login')
                return
            }

            const { data } = await supabase
                .from('checklist_templates')
                .select(`
                    id,
                    title,
                    created_at,
                    checklist_template_items (id, item_name)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            setTemplates(data || [])
            setLoading(false)
        }

        fetchTemplates()
    }, [supabase, router])

    if (loading) {
        return (
            <div className={css({ w: '100%', py: '40px' })}>
                <Skeleton width="250px" height="32px" className={css({ mb: '12px' })} />
                <Skeleton width="350px" height="18px" className={css({ mb: '48px' })} />
                <CommonListSkeleton count={3} height="240px" gap="24px" />
            </div>
        )
    }

    return (
        <div className={css({ w: '100%', py: '40px' })}>
            <header className={css({ mb: { base: '24px', sm: '40px' }, display: 'flex', flexDirection: { base: 'column', sm: 'row' }, gap: '16px', justifyContent: 'space-between', alignItems: { base: 'stretch', sm: 'center' } })}>
                <div>
                        <h1 className={css({ fontSize: { base: '24px', sm: '28px' }, fontWeight: '700', color: '#2C3A47' })}>
                            내 체크리스트 템플릿
                        </h1>
                        <p className={css({ color: '#666', mt: { base: '4px', sm: '8px' }, fontSize: { base: '14px', sm: '16px' }, wordBreak: 'keep-all', fontWeight: '500' })}>
                            자주 쓰는 준비물 목록을 템플릿으로 저장하고 관리하세요.
                        </p>
                </div>
                <button
                    onClick={() => setIsNewTemplateModalOpen(true)}
                    className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        bg: 'brand.primary',
                        color: 'white',
                        px: { base: '16px', sm: '20px' },
                        py: '12px',
                        borderRadius: '16px',
                        fontWeight: '700',
                        fontSize: { base: '15px', sm: '16px' },
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        border: 'none',
                        cursor: 'pointer',
                        w: { base: '100%', sm: 'auto' },
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                        _hover: { bg: '#1D4ED8', transform: 'translateY(-2px)', boxShadow: '0 6px 16px rgba(37, 99, 235, 0.3)' },
                    })}
                >
                    <Plus size={18} strokeWidth={3} /> 새 템플릿 만들기
                </button>
            </header>

            <section>
                {templates.length === 0 ? (
                    <div
                        className={css({
                            bg: 'white',
                            borderRadius: '24px',
                            p: '80px 20px',
                            textAlign: 'center',
                            border: '2px dashed #EEEEEE',
                            color: '#CCC',
                        })}
                    >
                        <ListTodo size={48} className={css({ mx: 'auto', mb: '16px', color: '#ccc' })} />
                        <p className={css({ fontSize: '18px', fontWeight: '700', mb: '8px', color: '#2C3A47' })}>
                            등록된 템플릿이 없습니다.
                        </p>
                        <p className={css({ fontSize: '15px', color: '#717171', fontWeight: '500' })}>나만의 준비물 목록을 템플릿으로 만들어 보세요!</p>
                    </div>
                ) : (
                    <div
                        className={css({
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                            gap: '20px',
                        })}
                    >
                        {templates.map((template: any) => {
                            const items = template.checklist_template_items || [];
                            const itemCount = items.length;
                            const previewItems = items.slice(0, 4);

                            return (
                                <button
                                    key={template.id}
                                    onClick={() => {
                                        setEditingTemplateId(template.id)
                                        setIsEditTemplateModalOpen(true)
                                    }}
                                    className={css({
                                        display: 'flex',
                                        flexDirection: 'column',
                                        textAlign: 'left',
                                        bg: 'white',
                                        p: '24px',
                                        borderRadius: '24px',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                                        border: '1px solid #EEEEEE',
                                        transition: 'all 0.4s cubic-bezier(0.2, 0, 0, 1)',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        _hover: {
                                            transform: 'translateY(-6px)',
                                            boxShadow: '0 16px 32px rgba(37, 99, 235, 0.1)',
                                            borderColor: 'brand.primary/40',
                                            '& [data-icon-bg]': {
                                                transform: 'scale(1.05) rotate(3deg)',
                                                bg: 'brand.primary',
                                                color: 'white'
                                            },
                                            '& [data-item-count]': {
                                                color: 'brand.primary'
                                            }
                                        },
                                        _active: {
                                            transform: 'scale(0.97)',
                                            bg: 'bg.softCotton',
                                            transition: 'all 0.1s'
                                        }
                                    })}
                                >
                                    {/* 우측 상단 배지 */}
                                    <div className={css({
                                        position: 'absolute',
                                        top: '20px',
                                        right: '20px',
                                        bg: { base: 'brand.primary/10', sm: 'bg.softCotton' },
                                        color: { base: 'brand.primary', sm: 'brand.muted' },
                                        fontSize: '10px',
                                        fontWeight: '800',
                                        px: '8px',
                                        py: '3px',
                                        borderRadius: '10px',
                                        letterSpacing: '0.02em',
                                        transition: 'all 0.3s'
                                    })}>
                                        MY
                                    </div>
                                    {/* 상단: 아이콘 & 제목 세트 (가로형) */}
                                    <div className={css({ display: 'flex', alignItems: 'center', gap: '12px', mb: '16px' })}>
                                        <div
                                            data-icon-bg
                                            className={css({
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                w: '44px',
                                                h: '44px',
                                                borderRadius: '16px',
                                                bg: { base: 'brand.primary/10', sm: 'bg.softCotton' },
                                                color: { base: 'brand.primary', sm: 'brand.secondary' },
                                                transition: 'all 0.3s ease',
                                                flexShrink: 0
                                            })}
                                        >
                                            <ListTodo size={20} strokeWidth={2.5} />
                                        </div>
                                        <div className={css({ flex: 1, minWidth: 0 })}>
                                            <h3 className={css({ fontSize: '17px', fontWeight: '700', color: '#2C3A47', mb: '2px', letterSpacing: '-0.02em', lineClamp: 1 })}>
                                                {template.title}
                                            </h3>
                                            <div className={css({ display: 'flex', alignItems: 'center', gap: '6px' })}>
                                                <span 
                                                    data-item-count
                                                    className={css({ color: { base: 'brand.primary', sm: 'brand.muted' }, fontSize: '12px', fontWeight: '700', transition: 'color 0.3s' })}
                                                >
                                                    항목 {itemCount}개
                                                </span>
                                                <span className={css({ w: '2px', h: '2px', bg: { base: 'brand.primary/40', sm: '#DDD' }, borderRadius: '50%' })} />
                                                <span className={css({ fontSize: '11px', color: '#AAA', fontWeight: '500' })}>
                                                    {formatDate(template.created_at)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 준비물 미리보기 */}
                                    <div className={css({ display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', alignItems: 'flex-start', gap: '6px', mb: '0', flex: 1, overflow: 'hidden', maxH: '64px' })}>
                                        {previewItems.length > 0 ? (
                                            <>
                                                {previewItems.slice(0, 3).map((item: any, idx: number) => (
                                                    <span 
                                                        key={`${template.id}-${idx}`}
                                                        className={css({
                                                            fontSize: '12px',
                                                            color: '#666',
                                                            bg: '#F8F9FA',
                                                            px: '8px',
                                                            py: '4px',
                                                            borderRadius: '8px',
                                                            fontWeight: '500',
                                                            border: '1px solid #F0F0F0',
                                                            whiteSpace: 'nowrap'
                                                        })}
                                                    >
                                                        {item.item_name}
                                                    </span>
                                                ))}
                                                {itemCount > 3 && (
                                                    <span className={css({ fontSize: '11px', color: '#BBB', fontWeight: '600', alignSelf: 'center', ml: '2px' })}>
                                                        +{itemCount - 3}
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <div className={css({ color: '#CCC', fontSize: '12px', fontStyle: 'italic', display: 'flex', alignItems: 'center', py: '6px' })}>
                                                등록된 준비물이 없습니다.
                                            </div>
                                        )}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </section>
        </div>
    )
}
