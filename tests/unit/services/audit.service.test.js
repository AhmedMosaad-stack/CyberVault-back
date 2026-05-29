/**
 * Unit tests for src/services/audit.service.js
 */
import { jest } from '@jest/globals';

const mockCreate = jest.fn();
jest.unstable_mockModule('../../../src/repositories/AuditEventRepository.js', () => ({
  default: { create: mockCreate },
}));

const { default: auditService } = await import('../../../src/services/audit.service.js');

describe('AuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('create calls AuditEventRepository.create', async () => {
    mockCreate.mockResolvedValue({ id: 1 });
    await auditService.create({ action: 'TEST' });
    expect(mockCreate).toHaveBeenCalledWith({ action: 'TEST' });
  });
});
