'use client'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import Link from 'next/link'
import { Plus, ListTodo } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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
        return <div className={css({ w: '100%', py: '80px', textAlign: 'center', color: '#888' })}>템플릿 불러오는 중...</div>
    }

    return (
        <div className={css({ w: '100%', py: '40px' })}>
            <header className={css({ mb: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                <div>
                    <h1 className={css({ fontSize: '28px', fontWeight: 'bold', color: '#022C22' })}>
                        내 체크리스트 템플릿
                    </h1>
                    <p className={css({ color: '#666', mt: '8px', fontSize: '16px' })}>
                        자주 쓰는 준비물 목록을 템플릿으로 저장하고 관리하세요.
                    </p>
                </div>
                <Link
                    href="/templates/new"
                    className={css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        bg: '#111',
                        color: 'white',
                        px: '20px',
                        py: '12px',
                        borderRadius: '12px',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        _hover: { bg: '#333', transform: 'translateY(-2px)', boxShadow: '0 6px 16px rgba(0,0,0,0.15)' },
                    })}
                >
                    <Plus size={20} /> 새 템플릿 만들기
                </Link>
            </header>

            <section>
                {templates.length === 0 ? (
                    <div
                        className={css({
                            bg: 'white',
                            borderRadius: '16px',
                            p: '80px 20px',
                            textAlign: 'center',
                            border: '2px dashed #ddd',
                            color: '#888',
                        })}
                    >
                        <ListTodo size={48} className={css({ mx: 'auto', mb: '16px', color: '#ccc' })} />
                        <p className={css({ fontSize: '18px', fontWeight: '500', mb: '8px', color: '#555' })}>
                            등록된 템플릿이 없습니다.
                        </p>
                        <p className={css({ fontSize: '15px' })}>나만의 준비물 목록을 템플릿으로 만들어 보세요!</p>
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
                                        borderRadius: '16px',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                                        border: '1px solid #f0f0f0',
                                        transition: 'all 0.3s ease',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        _hover: {
                                            transform: 'translateY(-4px)',
                                            boxShadow: '0 12px 24px rgba(0,0,0,0.08)',
                                            borderColor: '#10B981',
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
                                            borderRadius: '12px',
                                            bg: '#ECFDF5',
                                            color: '#059669',
                                            mb: '16px'
                                        })}
                                    >
                                        <ListTodo size={24} />
                                    </div>
                                    <h3
                                        className={css({
                                            fontSize: '18px',
                                            fontWeight: '700',
                                            mb: '8px',
                                            color: '#222',
                                        })}
                                    >
                                        {template.title}
                                    </h3>
                                    <p className={css({ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#666', mb: '16px' })}>
                                        저장된 항목: {itemCount}개
                                    </p>
                                    <div className={css({ mt: 'auto', pt: '16px', borderTop: '1px solid #f0f0f0', color: '#10B981', fontSize: '14px', fontWeight: 'bold' })}>
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
