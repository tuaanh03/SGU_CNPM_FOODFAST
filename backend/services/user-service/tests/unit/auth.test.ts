import { hashPassword, generateToken, generateJti } from '../../src/validations/auth.validations';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('auth.validations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'Test@123456';
      const hashed = '$2a$10$abcdefghijklmnopqrstuvwxyz';
      (mockedBcrypt.hash as unknown as jest.Mock).mockResolvedValue(hashed as any);

      const result = await hashPassword(password, 10);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(result).toBe(hashed);
    });

    it('should throw error if hashing fails', async () => {
      const password = 'Test@123456';
      (mockedBcrypt.hash as unknown as jest.Mock).mockRejectedValue(new Error('Hashing failed'));

      await expect(hashPassword(password, 10)).rejects.toThrow('Hashing failed');
    });
  });

  describe('generateToken', () => {
    it('should call jwt.sign with correct args and return token', () => {
      const payload = { userId: 'u1', email: 'a@b.com', role: 'CUSTOMER' };
      const jti = 'jti-123';
      const token = 'signed.token.value';

      mockedJwt.sign.mockReturnValue(token as any);

      const result = generateToken(payload, jti, '7d');

      // jwt.sign called with payload, secret, options
      expect(mockedJwt.sign).toHaveBeenCalled();
      const [calledPayload, calledSecret, calledOptions] = mockedJwt.sign.mock.calls[0];
      expect(calledPayload).toEqual(payload);
      // secret should be read from env or default 'secret'
      expect(typeof calledSecret).toBe('string');
      expect(calledOptions).toMatchObject({ expiresIn: '7d', jwtid: jti });
      expect(result).toBe(token);
    });
  });

  describe('generateJti', () => {
    it('should return value from crypto.randomUUID', () => {
      const uuid = 'uuid-12345-abc';
      const spy = jest.spyOn(crypto, 'randomUUID').mockReturnValue(uuid as any);

      const result = generateJti();

      expect(spy).toHaveBeenCalled();
      expect(result).toBe(uuid);

      spy.mockRestore();
    });
  });
});
