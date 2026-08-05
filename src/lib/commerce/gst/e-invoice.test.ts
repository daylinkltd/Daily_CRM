import { describe, it, expect } from 'vitest';

import { recordIrpResponse, NO_IRN, isEInvoicingConfigured } from './e-invoice';

/**
 * The point of these tests is that nothing reaches `irn_number` unless it
 * came from the IRP. The module previously invented IRNs locally, so the
 * regression these guard against is a real one that shipped.
 */

describe('recordIrpResponse', () => {
  it('records a well-formed acknowledgement', () => {
    const irn = 'a'.repeat(64);
    const out = recordIrpResponse({
      irn,
      ackNo: '112010000123',
      ackDate: '2026-08-06 12:00:00',
      signedQrCode: 'eyJhbGciOiJSUzI1NiJ9.payload.sig',
    });
    expect(out.irn_number).toBe(irn);
    expect(out.ack_number).toBe('112010000123');
    expect(out.qr_code_payload).toBeTruthy();
  });

  it('drops an acknowledgement with no signed QR', () => {
    // A real IRP response always carries the government-signed QR. One
    // without it is either a broken integration or something invented
    // locally, and both must not be stored as a registration.
    expect(
      recordIrpResponse({
        irn: 'b'.repeat(64),
        ackNo: '1',
        ackDate: '2026-08-06',
        signedQrCode: '',
      }),
    ).toEqual(NO_IRN);
  });

  it('drops anything that is not a 64-char hex IRN', () => {
    const base = { ackNo: '1', ackDate: '2026-08-06', signedQrCode: 'qr' };
    expect(recordIrpResponse({ ...base, irn: 'too-short' })).toEqual(NO_IRN);
    expect(recordIrpResponse({ ...base, irn: 'z'.repeat(64) })).toEqual(NO_IRN);
    expect(recordIrpResponse({ ...base, irn: 'a'.repeat(63) })).toEqual(NO_IRN);
  });

  it('treats a missing acknowledgement as no IRN', () => {
    expect(recordIrpResponse(null)).toEqual(NO_IRN);
  });
});

describe('isEInvoicingConfigured', () => {
  it('is false without GSP credentials', () => {
    // No environment has them today. If this ever starts returning true by
    // accident, invoices would be marked registered without a round trip.
    expect(isEInvoicingConfigured()).toBe(false);
  });
});
