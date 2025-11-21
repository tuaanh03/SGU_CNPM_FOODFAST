import { z } from "zod";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const signupSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters long."),
  email: z.string().email("Invalid email format."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  phone_number: z
    .string()
    .min(10, "Phone number must be at least 10 characters long.")
    // Allow either international E.164 or local numbers (may start with 0)
    .regex(/^\+?[0-9]{9,15}$/, "Invalid phone number format.")
    .optional(),
});

export const signinSchema = z.object({
  email: z.string().email("Invalid email format."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
});

/**
 * Validate signup input using signupSchema. Returns the safeParse result so callers can act accordingly.
 */
export function validateSignup(input: { name?: string; email?: string; password?: string; phone_number?: string; phone?: string }) {
  // normalize phone field (tests/controllers may pass `phone`)
  const payload = {
    name: input.name,
    email: input.email,
    password: input.password,
    phone_number: input.phone_number ?? input.phone,
  };
  return signupSchema.safeParse(payload);
}

/**
 * Hash a plaintext password using bcrypt.
 * Default saltRounds is 12 to match controller usage.
 */
export async function hashPassword(password: string, saltRounds = 12): Promise<string> {
  return bcrypt.hash(password, saltRounds);
}

/**
 * Generate a JWT token for the given payload.
 * @param payload - object payload to sign (e.g. { userId, email, role })
 * @param jwtid - optional jti to include in token
 * @param expiresIn - token expiry (default '7d')
 */
export function generateToken(payload: Record<string, any>, jwtid?: string, expiresIn = '7d'): string {
  const secret = process.env.JWT_SECRET_KEY || 'secret';
  // jwt SignOptions typing can be strict across different versions; use a loose options object
  const options: any = { expiresIn };
  if (jwtid) options.jwtid = jwtid;
  return jwt.sign(payload, secret, options);
}

/**
 * Generate a JTI (JWT ID) used to identify tokens for revocation/logout.
 */
export function generateJti(): string {
  return crypto.randomUUID();
}
