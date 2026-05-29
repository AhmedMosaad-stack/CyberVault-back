/**
 * Unit tests for src/services/notification.service.js
 */
import { jest } from '@jest/globals';

const mockCreate = jest.fn();
const mockFindByUserId = jest.fn();

jest.unstable_mockModule('../../../src/repositories/NotificationRepository.js', () => ({
  default: {
    create: mockCreate,
    findByUserId: mockFindByUserId,
  },
}));

const { default: notificationService } = await import('../../../src/services/notification.service.js');

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('create calls NotificationRepository.create', async () => {
    mockCreate.mockResolvedValue({ id: 1 });
    await notificationService.create({ userId: 1, message: 'Test' });
    expect(mockCreate).toHaveBeenCalledWith({ userId: 1, message: 'Test' });
  });

  test('getByUserId calls NotificationRepository.findByUserId', async () => {
    mockFindByUserId.mockResolvedValue([]);
    await notificationService.getByUserId(1);
    expect(mockFindByUserId).toHaveBeenCalledWith(1);
  });
});
