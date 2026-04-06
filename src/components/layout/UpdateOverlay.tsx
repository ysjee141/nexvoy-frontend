'use client';

import React from 'react';
import { useOTAUpdate, UpdateStatus } from '@/hooks/useOTAUpdate';
import { css } from 'styled-system/css';

const UpdateOverlay: React.FC = () => {
  const { status, progress, error } = useOTAUpdate();

  if (status === 'idle') return null;

  return (
    <div className={css({
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      // Premium Sunset Gradient matching the ultra-premium concept image
      background: 'linear-gradient(180deg, #1e293b 0%, #334155 30%, #475569 50%, #f97316 85%, #fb923c 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      p: 10,
      color: 'white',
      textAlign: 'center'
    })}>
      {/* Background Decorative Layer (Semi-transparent cloud-like glow) */}
      <div className={css({
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%',
        height: '100%',
        background: 'radial-gradient(circle at center, rgba(251, 146, 60, 0.2) 0%, transparent 70%)',
        pointerEvents: 'none'
      })} />

      {/* Top half: The REAL Logo & Branding */}
      <div className={css({ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: 6,
        zIndex: 1 
      })}>
        {/* Real Logo Component */}
        <div className={css({
          bg: 'white',
          p: 6,
          borderRadius: '40px',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.3)',
        })}>
          <img 
            src="/assets/logo.png" 
            alt="온여정 로고" 
            className={css({ w: '80px', h: '80px', objectFit: 'contain' })} 
          />
        </div>

        {/* Branded Text */}
        <div className={css({ mt: 4 })}>
           <h1 className={css({ 
             fontSize: '3xl', 
             fontWeight: '900', 
             letterSpacing: '-0.02em',
             textShadow: '0 2px 4px rgba(0,0,0,0.2)' 
           })}>온여정</h1>
           <p className={css({ 
             fontSize: 'sm', 
             fontWeight: '500', 
             opacity: 0.8,
             mt: 1,
             letterSpacing: '0.1em'
           })}>OnVoy: Your Journey, Optimized.</p>
        </div>
      </div>

      {/* Bottom half: Loading/Update status */}
      <div className={css({ 
        flex: 1, 
        w: '100%', 
        maxW: '280px', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center',
        zIndex: 1
      })}>
        {status === 'checking' && (
          <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 })}>
            <div className={css({
              w: '32px',
              h: '32px',
              border: '2.5px solid rgba(255,255,255,0.3)',
              borderTopColor: 'white',
              borderRadius: 'full',
              animation: 'spin 1s linear infinite'
            })} />
            <p className={css({ fontSize: 'sm', fontWeight: '500', opacity: 0.9 })}>여정의 시작을 준비하고 있습니다...</p>
          </div>
        )}

        {status === 'downloading' && (
          <div className={css({ w: '100%' })}>
            <p className={css({ fontWeight: '700', fontSize: 'md', mb: 6 })}>더 나은 여행을 위해 업데이트 중</p>
            <div className={css({
              w: '100%',
              h: '4px',
              bg: 'rgba(255, 255, 255, 0.2)',
              borderRadius: 'full',
              overflow: 'hidden',
              mb: 3
            })}>
              <div 
                className={css({ h: '100%', bg: 'white', transition: 'width 0.4s ease-out' })} 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <p className={css({ fontSize: 'xs', opacity: 0.8 })}>{progress}% 완료</p>
          </div>
        )}

        {status === 'applying' && (
          <div className={css({ 
            bg: 'rgba(255,255,255,0.1)', 
            backdropFilter: 'blur(10px)',
            py: 4, 
            px: 6, 
            borderRadius: '16px' 
          })}>
            <p className={css({ fontSize: 'sm', fontWeight: '600' })}>
              곧 새로운 여정이 시작됩니다.
            </p>
          </div>
        )}

        {status === 'mandatory_update' && (
          <div className={css({ 
            bg: 'white', 
            p: 8, 
            borderRadius: '24px', 
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            color: '#1e293b'
          })}>
            <h2 className={css({ fontSize: 'xl', fontWeight: 'bold', mb: 3, color: '#ef4444' })}>업데이트가 필요합니다</h2>
            <p className={css({ mb: 6, color: '#64748b', fontSize: 'sm', lineHeight: 'relaxed' })}>
              최신 버전의 '온여정'과 함께 즐거운 여행을 이어가세요.
            </p>
            <button 
              onClick={() => window.open('https://nexvoy.app', '_blank')}
              className={css({
                w: '100%',
                py: 3.5,
                bg: '#3b82f6',
                color: 'white',
                borderRadius: '16px',
                fontWeight: 'bold'
              })}
            >
              지금 업데이트 하기
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className={css({ 
            bg: 'rgba(255,255,255,1)', 
            p: 8, 
            borderRadius: '24px',
            color: '#1e293b'
          })}>
             <p className={css({ mb: 6, color: '#64748b', fontSize: 'sm' })}>{error || '네트워크 연결이 고르지 않습니다.'}</p>
             <button 
              onClick={() => window.location.reload()}
              className={css({
                w: '100%',
                py: 2.5,
                bg: '#f1f5f9',
                borderRadius: '12px',
                color: '#475569',
                fontSize: 'sm',
                fontWeight: 'bold'
              })}
            >
              다시 시도하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdateOverlay;
