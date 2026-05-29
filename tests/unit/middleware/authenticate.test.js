/**
 * Unit tests for src/middleware/authenticate.js
 */
import { jest } from '@jest/globals';

const mockVerifyAccessToken = jest.fn();
jest.unstable_mockModule('../../../src/utils/tokenHelpers.js', () => ({
  verifyAccessToken: mockVerifyAccessToken,
}));

const mockFindById = jest.fn();
jest.unstable_mockModule('../../../src/repositories/UserRepository.js', () => ({
  default: { findById: mockFindById },
}));

const { default: authenticate } = await import('../../../src/middleware/authenticate.js');

describe('authenticate', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = { headers: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  test('no authorization header → 401 TOKEN_INVALID', async () => {
    await authenticate(mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 'TOKEN_INVALID' }) }));
  });

  test('invalid format → 401 TOKEN_INVALID', async () => {
    mockReq.headers.authorization = 'InvalidFormat';
    await authenticate(mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  test('expired token → 401 TOKEN_EXPIRED', async () => {
    mockReq.headers.authorization = 'Bearer expiredToken';
    const err = new Error('jwt expired');
    err.name = 'TokenExpiredError';
    mockVerifyAccessToken.mockImplementation(() => { throw err; });

    await authenticate(mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 'TOKEN_EXPIRED' }) }));
  });

  test('invalid token signature → 401 TOKEN_INVALID', async () => {
    mockReq.headers.authorization = 'Bearer badToken';
    const err = new Error('invalid signature');
    err.name = 'JsonWebTokenError';
    mockVerifyAccessToken.mockImplementation(() => { throw err; });

    await authenticate(mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 'TOKEN_INVALID' }) }));
  });

});
