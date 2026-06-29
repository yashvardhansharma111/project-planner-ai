import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authResponse } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler, parseBody } from '@/server/http';
import { UserModel } from '@/server/models/User';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const registerSchema = z.object({
  fullName: z.string().min(1).max(150),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
});

export const POST = handler(async (req) => {
  await connectDB();
  const { fullName, email, password } = await parseBody(req, registerSchema);

  if (await UserModel.exists({ email })) {
    throw new ApiError(409, 'An account with this email already exists');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await UserModel.create({ fullName, email, passwordHash, role: 'client', isActive: true });

  return authResponse(user, 201);
});
