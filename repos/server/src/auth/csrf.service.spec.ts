import { CsrfService } from './csrf.service.js';

describe('CsrfService', () => {
  const service = new CsrfService({ generate: () => 'generated-token' });

  it('accepts only equal non-empty cookie and header tokens', () => {
    expect(service.generate()).toBe('generated-token');
    expect(() => service.verify('token', 'token')).not.toThrow();
    expect(() => service.verify('token', 'other')).toThrow(
      'A valid CSRF token is required.',
    );
    expect(() => service.verify(undefined, undefined)).toThrow(
      'A valid CSRF token is required.',
    );
  });
});
