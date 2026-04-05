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
      bg: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: 6,
      color: 'white',
      textAlign: 'center'
    })}>
      <div className={css({
        bg: 'white',
        color: '#172554',
        p: 8,
        borderRadius: '24px',
        maxW: '400px',
        w: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      })}>
        {status === 'checking' && (
          <p className={css({ fontWeight: 'bold' })}>업데이트 확인 중...</p>
        )}

        {status === 'downloading' && (
          <>
            <h2 className={css({ fontSize: 'xl', fontWeight: 'bold', mb: 4 })}>신규 업데이트 다운로드</h2>
            <p className={css({ mb: 6, color: '#64748b' })}>최신 버전으로 앱을 업데이트하고 있습니다.</p>
            <div className={css({
              w: '100%',
              h: '8px',
              bg: '#e2e8f0',
              borderRadius: 'full',
              overflow: 'hidden',
              mb: 2
            })}>
              <div 
                className={css({ h: '100%', bg: '#3b82f6', transition: 'width 0.3s ease' })} 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <p className={css({ fontSize: 'sm', color: '#64748b' })}>{progress}% 완료</p>
          </>
        )}

        {status === 'applying' && (
          <p className={css({ fontWeight: 'bold' })}>업데이트 적용 중... 잠시만 기다려주세요.</p>
        )}

        {status === 'mandatory_update' && (
          <>
            <h2 className={css({ fontSize: 'xl', fontWeight: 'bold', mb: 4, color: '#ef4444' })}>업데이트 안내</h2>
            <p className={css({ mb: 6, color: '#64748b' })}>
              안정적인 서비스 이용을 위해 새 버전으로 업데이트가 필요합니다. 스토어에서 최신 앱을 확인해 주세요.
            </p>
            <button 
              onClick={() => window.open('https://nexvoy.app', '_blank')} // Replace with actual store link
              className={css({
                w: '100%',
                py: 3,
                bg: '#172554',
                color: 'white',
                borderRadius: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                _hover: { bg: '#1e3a8a' }
              })}
            >
              스토어로 이동하기
            </button>
          </>
        )}

        {status === 'error' && (
          <>
             <h2 className={css({ fontSize: 'xl', fontWeight: 'bold', mb: 2, color: '#ef4444' })}>오류 발생</h2>
             <p className={css({ mb: 4, color: '#64748b' })}>{error || '업데이트 중 오류가 발생했습니다.'}</p>
             <button 
              onClick={() => window.location.reload()}
              className={css({
                w: '100%',
                py: 2,
                bg: '#f1f5f9',
                borderRadius: '8px',
                color: '#475569'
              })}
            >
              닫기
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default UpdateOverlay;
