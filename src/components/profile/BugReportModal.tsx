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
            position: 'fixed', inset: 0, bg: 'rgba(0,0,0,0.6)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', p: '20px',
            backdropFilter: 'blur(4px)'
        })}>
            <div className={css({
                bg: 'white', w: '100%', maxW: '500px', borderRadius: '24px', overflow: 'hidden',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            })}>
                {/* 헤더 */}
                <div className={css({
                    p: '20px 24px', borderBottom: '1px solid #EEEEEE', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between', bg: '#F7F7F7'
                })}>
                    <h2 className={css({ fontSize: '18px', fontWeight: '800', color: '#222', display: 'flex', alignItems: 'center', gap: '8px' })}>
                        <MessageSquare size={20} /> 테스터 피드백 보내기
                    </h2>
                    <button onClick={onClose} className={css({ p: '4px', bg: 'transparent', border: 'none', cursor: 'pointer', color: '#717171' })}>
                        <X size={24} />
                    </button>
                </div>

                {/* 테스터 감사 인사 및 가이드 */}
                <div className={css({
                    p: '16px 24px', bg: '#EFF6FF', borderBottom: '1px solid #DBEAFE',
                    display: 'flex', gap: '12px', alignItems: 'flex-start'
                })}>
                    <div className={css({ fontSize: '20px', mt: '2px' })}>✨</div>
                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4px' })}>
                        <h3 className={css({ fontSize: '14px', fontWeight: '800', color: '#1E40AF' })}>테스트에 참여해주셔서 고맙습니다!</h3>
                        <p className={css({ fontSize: '13px', color: '#3B82F6', fontWeight: '600', lineHeight: '1.5' })}>
                            테스터님의 소중한 의견과 발견된 결함들이 모여 더 완벽한 온여정이 만들어집니다. 어떤 의견이라도 편하게 들려주세요!
                        </p>
                    </div>
                </div>

                {success ? (
                    <div className={css({ p: '60px 40px', textAlign: 'center' })}>
                        <div className={css({ fontSize: '48px', mb: '20px' })}>✨</div>
                        <h3 className={css({ fontSize: '20px', fontWeight: '800', mb: '12px' })}>소중한 피드백 감사합니다!</h3>
                        <p className={css({ color: '#717171', fontSize: '15px' })}>보내주신 의견을 바탕으로 더 멋진 온여정을 만들게요.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className={css({ p: '24px', display: 'flex', flexDirection: 'column', gap: '20px' })}>
                        <div>
                            <label className={css({ display: 'block', fontSize: '14px', fontWeight: '700', mb: '8px', color: '#222' })}>어떤 의견이나 결함이 있나요?</label>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="불편했던 점, 수정이 필요한 결함, 혹은 제안하고 싶은 아이디어를 자유롭게 적어주세요!"
                                className={css({
                                    w: '100%', h: '120px', p: '16px', border: '1.5px solid #EEEEEE', borderRadius: '16px',
                                    outline: 'none', fontSize: '15px', resize: 'none', _focus: { borderColor: '#222' }
                                })}
                            />
                        </div>

                        <div>
                            <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '8px' })}>
                                <label className={css({ display: 'block', fontSize: '14px', fontWeight: '700', color: '#222' })}>이미지/영상 첨부 (선택)</label>
                                <span className={css({ 
                                    fontSize: '12px', 
                                    fontWeight: '600',
                                    color: isOverSize ? '#FF4D4F' : '#717171' 
                                })}>
                                    {formatSize(totalSize)} / 25MB
                                </span>
                            </div>
                            
                            <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '8px' })}>
                                {files.map((file, i) => (
                                    <div key={i} className={css({
                                        position: 'relative', w: '64px', h: '64px', borderRadius: '12px', bg: '#F7F7F7',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #EEEEEE'
                                    })}>
                                        {file.type.startsWith('image/') ? <ImageIcon size={20} color="#717171" /> : <Video size={20} color="#717171" />}
                                        <button
                                            type="button"
                                            onClick={() => removeFile(i)}
                                            className={css({
                                                position: 'absolute', top: '-4px', right: '-4px', w: '20px', h: '20px',
                                                bg: '#FF4D4F', color: 'white', borderRadius: '50%', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer'
                                            })}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                                
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    className={css({
                                        w: '64px', h: '64px', borderRadius: '12px', border: '1.5px dashed #B0B0B0',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', bg: 'transparent',
                                        cursor: 'pointer', _hover: { bg: '#F7F7F7', borderColor: '#222' }
                                    })}
                                >
                                    <Plus size={24} color="#B0B0B0" />
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
                                <p className={css({ color: '#FF4D4F', fontSize: '11px', mt: '6px', fontWeight: '600' })}>
                                    ⚠️ 파일 합계 용량이 25MB를 넘으면 전송할 수 없어요!
                                </p>
                            )}
                        </div>

                        {error && (
                            <div className={css({
                                p: '12px 16px', bg: '#FFF1F0', borderRadius: '12px', border: '1px solid #FFCCC7',
                                display: 'flex', alignItems: 'center', gap: '8px', color: '#FF4D4F', fontSize: '13px'
                            })}>
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting || !content.trim() || isOverSize}
                            className={css({
                                w: '100%', py: '14px', bg: '#222', color: 'white', borderRadius: '16px',
                                fontWeight: '800', fontSize: '16px', border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                _disabled: { opacity: 0.5, cursor: 'not-allowed' }, _active: { transform: 'scale(0.98)' }
                            })}
                        >
                            {isSubmitting ? <Loader2 className={css({ animation: 'spin 1.5s linear infinite' })} size={20} /> : <Send size={20} />}
                            {isSubmitting ? '보내는 중...' : '피드백 보내기'}
                        </button>
                    </form>
                )}
            </div>
            
            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
