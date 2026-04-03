'use client'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import Link from 'next/link'
import { Plus, ListTodo } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Skeleton from '@/components/ui/Skeleton'
import CommonListSkeleton from '@/components/common/CommonListSkeleton'

export default function TemplatesPage() {
    const supabase = createClient()
    const router = useRouter()

    const [templates, setTemplates] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchTemplates() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            const { data } = await supabase
                .from('checklist_templates')
                .select(`
                    id,
                    title,
                    checklist_template_items (id)
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
                <CommonListSkeleton count={3} height="120px" gap="16px" />
            </div>
        )
    }

    return (
        <div className={css({ w: '100%', py: '40px' })}>
            <header className={css({ mb: { base: '24px', sm: '40px' }, display: 'flex', flexDirection: { base: 'column', sm: 'row' }, gap: '16px', justifyContent: 'space-between', alignItems: { base: 'stretch', sm: 'center' } })}>
                <div>
                        <h1 className={css({ fontSize: { base: '24px', sm: '28px' }, fontWeight: '800', color: '#2C3A47' })}>
                            내 체크리스트 템플릿
                        </h1>
                        <p className={css({ color: '#666', mt: { base: '4px', sm: '8px' }, fontSize: { base: '14px', sm: '16px' }, wordBreak: 'keep-all', fontWeight: '500' })}>
                            자주 쓰는 준비물 목록을 템플릿으로 저장하고 관리하세요.
                        </p>
                </div>
                <Link
                    href="/templates/new"
                    className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        bg: '#2EC4B6',
                        color: 'white',
                        px: { base: '16px', sm: '20px' },
                        py: '12px',
                        borderRadius: '16px',
                        fontWeight: '700',
                        fontSize: { base: '15px', sm: '16px' },
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        w: { base: '100%', sm: 'auto' },
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(46,196,182,0.2)',
                        _hover: { bg: '#249E93', transform: 'translateY(-2px)', boxShadow: '0 6px 16px rgba(46,196,182,0.3)' },
                    })}
                >
                    <Plus size={18} /> 새 템플릿 만들기
                </Link>
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
                        <p className={css({ fontSize: '18px', fontWeight: '800', mb: '8px', color: '#2C3A47' })}>
                            등록된 템플릿이 없습니다.
                        </p>
                        <p className={css({ fontSize: '15px', color: '#717171', fontWeight: '500' })}>나만의 준비물 목록을 템플릿으로 만들어 보세요!</p>
                    </div>
                ) : (
                    <div
                        className={css({
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                            gap: '24px',
                        })}
                    >
                        {templates.map((template: any) => {
                            const itemCount = template.checklist_template_items?.length || 0;

                            return (
                                <Link
                                    key={template.id}
                                    href={`/templates/detail?id=${template.id}`}
                                    className={css({
                                        display: 'flex',
                                        flexDirection: 'column',
                                        bg: 'white',
                                        p: '24px',
                                        borderRadius: '24px',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                                        border: '1px solid #EEEEEE',
                                        transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        _hover: {
                                            transform: 'translateY(-6px)',
                                            boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
                                            borderColor: '#2EC4B6',
                                        },
                                    })}
                                >
                                    <div
                                        className={css({
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            w: '48px',
                                            h: '48px',
                                            borderRadius: '14px',
                                            bg: '#EAF9F7',
                                            color: '#2EC4B6',
                                            mb: '16px'
                                        })}
                                    >
                                        <ListTodo size={24} />
                                    </div>
                                    <h3
                                        className={css({
                                            fontSize: '18px',
                                            fontWeight: '800',
                                            mb: '8px',
                                            color: '#2C3A47',
                                        })}
                                    >
                                        {template.title}
                                    </h3>
                                    <p className={css({ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#717171', fontWeight: '600', mb: '16px' })}>
                                        저장된 항목: {itemCount}개
                                    </p>
                                    <div className={css({ mt: 'auto', pt: '16px', borderTop: '1px solid #EEEEEE', color: '#2EC4B6', fontSize: '13px', fontWeight: '800' })}>
                                        템플릿 관리하기 →
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </section>
        </div>
    )
}
