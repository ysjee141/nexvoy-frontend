import { test, expect } from '@playwright/test';
import {
  createLocalFirstObservabilityEvent,
  sanitizeLocalFirstObservabilityEvent,
} from '@nexvoy/core';

test.describe('Local-first observability safety', () => {
  test('allows only product-safe metadata for Web/Mobile/P2P events', () => {
    const event = createLocalFirstObservabilityEvent('p2p_connected', {
      platform: 'web',
      document_type: 'trip',
      entity_type: 'document',
      role: 'editor',
      connection_type: 'direct',
      provider: 'cloudflare',
      has_turn: true,
      setup_ms: 127,
    });

    expect(event).toEqual({
      name: 'p2p_connected',
      params: {
        platform: 'web',
        document_type: 'trip',
        entity_type: 'document',
        role: 'editor',
        connection_type: 'direct',
        provider: 'cloudflare',
        has_turn: true,
        setup_ms: 127,
      },
    });
  });

  test('rejects raw document, identity, and secret-bearing payload keys', () => {
    const sanitized = sanitizeLocalFirstObservabilityEvent('local_first_backup_failed', {
      platform: 'ios',
      status: 'failed',
      reason: 'restore failed because user email leaked',
      documentId: 'trip-document-id',
      trip_id: 'trip-row-id',
      email: 'member@example.com',
      secret: 'room-secret',
      snapshot: { yjsUpdate: 'opaque-document-content' },
    });

    expect(sanitized.event.params).toEqual({
      platform: 'ios',
      status: 'failed',
      reason: 'restore_failed_because_user_email_leaked',
    });
    expect(sanitized.rejectedKeys).toEqual([
      'documentId',
      'trip_id',
      'email',
      'secret',
      'snapshot',
    ]);

    expect(() =>
      createLocalFirstObservabilityEvent('local_first_backup_failed', {
        platform: 'android',
        document_key_id: 'raw-key-id',
      }),
    ).toThrow(/Unsafe observability event params: document_key_id/);
  });
});
