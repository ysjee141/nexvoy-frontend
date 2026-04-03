'use client'

import { useState, useRef } from 'react'
import { css } from 'styled-system/css'
import { X, Send, Image as ImageIcon, Video, Loader2, AlertCircle, Plus, MessageSquare } from 'lucide-react'
import { sendBugReportToDiscord } from '@/utils/discord'

interface BugReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: { id: string; email: string };
}

export default function BugReportModal({ isOpen, onClose, user }: BugReportModalProps) {
    const [content, setContent] = useState('')
    const [files, setFiles] = useState<File[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const handleClose = () => {
        const isDirty = content.trim() !== '' || files.length > 0
        if (isDirty && !success) {
            const confirmClose = window.confirm('작성 중인 내용이 있어요! 정말 나가시겠어요?')
            if (!confirmClose) return
        }
        
        // 상태 초기화 후 닫기
        setContent('')
        setFiles([])
        setError('')
        setSuccess(false)
        onClose()
    }

    if (!isOpen) return null

    // 전체 파일 용량계산 (bytes)
    const totalSize = files.reduce((acc, f) => acc + f.size, 0)
    const MAX_SIZE = 25 * 1024 * 1024 // 25MB
    const isOverSize = totalSize > MAX_SIZE

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files)
            setFiles(prev => [...prev, ...newFiles])
        }
    }

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0MB'
        const mb = bytes / (1024 * 1024)
        return `${mb.toFixed(1)}MB`
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!content.trim()) {
            setError('피드백 내용을 입력해 주세요!')
            return
        }

        if (isOverSize) {
            setError('전체 용량이 25MB를 초과했습니다. 파일을 정리해 주세요.')
            return
        }

        setIsSubmitting(true)
        setError('')

        const result = await sendBugReportToDiscord({
            userId: user.id,
            userEmail: user.email,
            content: content.trim(),
            currentUrl: window.location.href,
            browserInfo: navigator.userAgent,
            files
        })

        if (result.success) {
            setSuccess(true)
            setTimeout(() => {
                setSuccess(false)
                onClose()
                setContent('')
                setFiles([])
            }, 2000)
        } else {
            setError(result.error || '피드백 발송 중 오류가 발생했습니다.')
        }
        setIsSubmitting(false)
    }

    return (
        <div className={css({
            position: 'fixed', inset: 0, bg: 'rgba(0,0,0,0.5)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', p: '20px',
            backdropFilter: 'blur(10px)',
            animation: 'fadeIn 0.3s ease-out'
        })}>
            <div className={css({
                bg: 'white', w: '100%', maxW: '500px', borderRadius: '24px', overflow: 'hidden',
                boxShadow: '0 30px 80px rgba(0,0,0,0.2)',
                animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)'
            })}>
                {/* 헤더 */}
                <div className={css({
                    p: '20px 24px', borderBottom: '1px solid #F5F5F5', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between', bg: 'white'
                })}>
                    <h2 className={css({ fontSize: '18px', fontWeight: '700', color: '#2C3A47', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.02em' })}>
                        <MessageSquare size={20} color="#2EC4B6" strokeWidth={2.5} /> 테스터 피드백 보내기
                    </h2>
                    <button onClick={handleClose} className={css({ 
                        p: '6px', bg: '#F8F9FA', border: 'none', cursor: 'pointer', color: '#9CA3AF', 
                        borderRadius: '50%', transition: 'all 0.2s',
                        _hover: { bg: '#F1F3F5', color: '#2C3A47', transform: 'rotate(90deg)' }
                    })}>
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                {/* 테스터 감사 인사 및 가이드 */}
                <div className={css({
                    p: '18px 24px', bg: 'rgba(46, 196, 182, 0.05)', borderBottom: '1.5px solid rgba(46, 196, 182, 0.1)',
                    display: 'flex', gap: '14px', alignItems: 'flex-start'
                })}>
                    <div className={css({ fontSize: '20px', mt: '2px' })}>✨</div>
                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4px' })}>
                        <h3 className={css({ fontSize: '14px', fontWeight: '700', color: '#2EC4B6' })}>테스트에 참여해주셔서 고맙습니다!</h3>
                        <p className={css({ fontSize: '13px', color: '#6B7280', fontWeight: '600', lineHeight: '1.55', wordBreak: 'keep-all' })}>
                            테스터님의 소중한 의견과 발견된 결함들이 모여 더 완벽한 온여정이 만들어집니다. 어떤 의견이라도 편하게 들려주세요!
                        </p>
                    </div>
                </div>

                {success ? (
                    <div className={css({ p: '70px 40px', textAlign: 'center', animation: 'fadeIn 0.5s ease-out' })}>
                        <div className={css({ 
                            w: '80px', h: '80px', bg: 'rgba(46, 196, 182, 0.1)', borderRadius: '50%', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', m: '0 auto 24px',
                            fontSize: '40px'
                        })}>✨</div>
                        <h3 className={css({ fontSize: '22px', fontWeight: '700', mb: '12px', color: '#2C3A47', letterSpacing: '-0.02em' })}>소중한 피드백 감사합니다!</h3>
                        <p className={css({ color: '#6B7280', fontSize: '16px', fontWeight: '500' })}>보내주신 의견을 바탕으로 더 멋진 온여정을 만들게요.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className={css({ p: '24px', display: 'flex', flexDirection: 'column', gap: '20px' })}>
                        <div>
                            <label className={css({ display: 'block', fontSize: '14px', fontWeight: '700', mb: '10px', color: '#2C3A47' })}>어떤 의견이나 결함이 있나요?</label>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="불편했던 점, 수정이 필요한 결함, 혹은 제안하고 싶은 아이디어를 자유롭게 적어주세요!"
                                className={css({
                                    w: '100%', h: '130px', p: '18px', border: '1.5px solid #F1F3F5', borderRadius: '20px',
                                    outline: 'none', fontSize: '15px', resize: 'none', fontWeight: '500', bg: '#F8F9FA',
                                    transition: 'all 0.2s',
                                    _focus: { borderColor: '#2EC4B6', bg: 'white', boxShadow: '0 0 0 4px rgba(46, 196, 182, 0.1)' }
                                })}
                            />
                        </div>

                        <div>
                            <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '10px' })}>
                                <label className={css({ display: 'block', fontSize: '14px', fontWeight: '700', color: '#2C3A47' })}>이미지/영상 첨부 (선택)</label>
                                <span className={css({ 
                                    fontSize: '12px', 
                                    fontWeight: '700',
                                    color: isOverSize ? '#FF5A5F' : '#9CA3AF' 
                                })}>
                                    {formatSize(totalSize)} / 25MB
                                </span>
                            </div>
                            
                            <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '10px' })}>
                                {files.map((file, i) => (
                                    <div key={i} className={css({
                                        position: 'relative', w: '68px', h: '68px', borderRadius: '16px', bg: '#F8F9FA',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #F1F3F5'
                                    })}>
                                        {file.type.startsWith('image/') ? <ImageIcon size={22} color="#2EC4B6" /> : <Video size={22} color="#2EC4B6" />}
                                        <button
                                            type="button"
                                            onClick={() => removeFile(i)}
                                            className={css({
                                                position: 'absolute', top: '-6px', right: '-6px', w: '22px', h: '22px',
                                                bg: '#FF5A5F', color: 'white', borderRadius: '50%', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center', border: '2px solid white', cursor: 'pointer',
                                                boxShadow: '0 2px 8px rgba(255, 90, 95, 0.3)'
                                            })}
                                        >
                                            <X size={12} strokeWidth={3} />
                                        </button>
                                    </div>
                                ))}
                                
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    className={css({
                                        w: '68px', h: '68px', borderRadius: '16px', border: '1.5px dashed #D1D5DB',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', bg: 'transparent',
                                        cursor: 'pointer', transition: 'all 0.2s',
                                        _hover: { bg: '#F1F3F5', borderColor: '#2EC4B6', color: '#2EC4B6' }
                                    })}
                                >
                                    <Plus size={28} color="currentColor" strokeWidth={1.5} />
                                </button>
                                <input
                                    type="file"
                                    ref={fileRef}
                                    onChange={handleFileChange}
                                    multiple
                                    accept="image/*,video/*"
                                    className={css({ display: 'none' })}
                                />
                            </div>
                            {isOverSize && (
                                <p className={css({ color: '#FF5A5F', fontSize: '11px', mt: '8px', fontWeight: '700' })}>
                                    ⚠️ 파일 합계 용량이 25MB를 넘으면 전송할 수 없어요!
                                </p>
                            )}
                        </div>

                        {error && (
                            <div className={css({
                                p: '14px 18px', bg: '#FFF5F5', borderRadius: '16px', border: '1.5px solid #FFEBEB',
                                display: 'flex', alignItems: 'center', gap: '10px', color: '#FF5A5F', fontSize: '14px', fontWeight: '600'
                            })}>
                                <AlertCircle size={18} />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting || !content.trim() || isOverSize}
                            className={css({
                                w: '100%', py: '18px', bg: '#2EC4B6', color: 'white', borderRadius: '20px',
                                fontWeight: '700', fontSize: '17px', border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                boxShadow: '0 8px 25px rgba(46, 196, 182, 0.25)',
                                transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
                                _disabled: { opacity: 0.5, cursor: 'not-allowed', boxShadow: 'none', transform: 'none' }, 
                                _hover: { bg: '#249E93', transform: 'translateY(-2px)', boxShadow: '0 12px 30px rgba(46, 196, 182, 0.35)' },
                                _active: { transform: 'scale(0.97)' }
                            })}
                        >
                            {isSubmitting ? <Loader2 className={css({ animation: 'spin 1.5s linear infinite' })} size={22} strokeWidth={2.5} /> : <Send size={22} strokeWidth={2.5} />}
                            {isSubmitting ? '보내는 중...' : '피드백 보내기'}
                        </button>
                    </form>
                )}
            </div>
            
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
