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
      bg: '#EFEBE7', // Match native splash background
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      p: 10,
      color: '#172554',
      textAlign: 'center'
    })}>
      {/* Top half: Brand/Icon placeholder (Matches native splash icon area) */}
      <div className={css({ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
        <div className={css({
          w: '120px',
          h: '120px',
          bg: '#172554',
          borderRadius: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
          mb: 8
        })}>
          <span className={css({ color: 'white', fontSize: '4xl', fontWeight: 'bold' })}>OV</span>
        </div>
      </div>

      {/* Bottom half: Loading/Update status */}
      <div className={css({ 
        flex: 1, 
        w: '100%', 
        maxW: '320px', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center' 
      })}>
        {status === 'checking' && (
          <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 })}>
            <div className={css({
              w: '40px',
              h: '40px',
              border: '3px solid #172554',
              borderTopColor: 'transparent',
              borderRadius: 'full',
              animation: 'spin 1s linear infinite'
            })} />
            <p className={css({ fontWeight: '500', color: '#1e3a8a', letterSpacing: '-0.02em' })}>최신 정보를 가져오고 있습니다...</p>
          </div>
        )}

        {status === 'downloading' && (
          <div className={css({ w: '100%' })}>
            <p className={css({ fontWeight: 'bold', fontSize: 'lg', mb: 6, color: '#1e3a8a' })}>더 나은 여행을 위해 업데이트 중</p>
            <div className={css({
              w: '100%',
              h: '4px',
              bg: 'rgba(23, 37, 84, 0.1)',
              borderRadius: 'full',
              overflow: 'hidden',
              mb: 3
            })}>
              <div 
                className={css({ h: '100%', bg: '#172554', transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' })} 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <p className={css({ fontSize: 'xs', color: '#64748b', fontWeight: '500' })}>{progress}% 완료</p>
          </div>
        )}

        {status === 'applying' && (
          <p className={css({ fontWeight: '500', color: '#1e3a8a' })}>거의 다 되었습니다. 곧 새로운 여정이 시작됩니다.</p>
        )}

        {status === 'mandatory_update' && (
          <div className={css({ 
            bg: 'white', 
            p: 8, 
            borderRadius: '24px', 
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)' 
          })}>
            <h2 className={css({ fontSize: 'xl', fontWeight: 'bold', mb: 3, color: '#ef4444' })}>업데이트 알림</h2>
            <p className={css({ mb: 6, color: '#64748b', fontSize: 'sm', lineHeight: 'relaxed' })}>
              원활한 서비스 이용을 위해 스토어에서 최신 버전으로 업데이트가 필요합니다.
            </p>
            <button 
              onClick={() => window.open('https://nexvoy.app', '_blank')}
              className={css({
                w: '100%',
                py: 3.5,
                bg: '#172554',
                color: 'white',
                borderRadius: '16px',
                fontWeight: 'bold',
                _hover: { bg: '#1e3a8a' }
              })}
            >
              스토어로 가기
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className={css({ 
            bg: 'white', 
            p: 8, 
            borderRadius: '24px', 
            border: '1px solid #fee2e2' 
          })}>
             <h2 className={css({ fontSize: 'lg', fontWeight: 'bold', mb: 2, color: '#ef4444' })}>잠시 문제가 발생했습니다</h2>
             <p className={css({ mb: 6, color: '#64748b', fontSize: 'sm' })}>{error || '네트워크 연결을 확인해 주세요.'}</p>
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
