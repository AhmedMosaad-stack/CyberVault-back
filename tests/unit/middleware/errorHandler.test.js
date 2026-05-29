/**
 * Unit tests for src/middleware/errorHandler.js
 */
import { jest } from '@jest/globals';

const mockLoggerError = jest.fn();
jest.unstable_mockModule('../../../src/utils/logger.js', () => ({
  default: { error: mockLoggerError },
}));

const { default: errorHandler } = await import('../../../src/middleware/errorHandler.js');

describe('errorHandler', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      originalUrl: '/api/test',
      body: {},
      query: {},
      ip: '127.0.0.1',
      user: { id: 1 },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  test('handles generic Error → 500 INTERNAL_ERROR', () => {
    const err = new Error('Database down');
    errorHandler(err, mockReq, mockRes, mockNext);

    expect(mockLoggerError).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
      },
    });
  });

  test('handles explicit status and code from error object', () => {
    const err = new Error('Custom message');
    err.status = 418;
    err.code = 'TEAPOT_ERROR';

    errorHandler(err, mockReq, mockRes, mockNext);

    expect(mockLoggerError).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(418);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'TEAPOT_ERROR',
        message: 'Custom message',
      },
    });
  });
});
