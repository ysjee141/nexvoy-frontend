import { test, expect } from '@playwright/test';
import {
  createObservabilityEvent,
  sanitizeObservabilityEvent,
} from '@nexvoy/core';

test.describe('Product observability safety', () => {
  test('allows only product-safe metadata for Web and Mobile events', () => {
    const event = createObservabilityEvent('local_notification_scheduled', {
      platform: 'web',
      document_type: 'trip',
      entity_type: 'document',
      role: 'editor',
      provider: 'local',
      status: 'completed',
    });

    expect(event).toEqual({
      name: 'local_notification_scheduled',
      params: {
        platform: 'web',
        document_type: 'trip',
        entity_type: 'document',
        role: 'editor',
        provider: 'local',
        status: 'completed',
      },
    });
  });

  test('rejects raw document, identity, and secret-bearing payload keys', () => {
    const sanitized = sanitizeObservabilityEvent('local_notification_schedule_failed', {
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
      createObservabilityEvent('local_notification_schedule_failed', {
        platform: 'android',
        document_key_id: 'raw-key-id',
      }),
    ).toThrow(/Unsafe observability event params: document_key_id/);
  });
});
