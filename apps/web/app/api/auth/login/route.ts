import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authResponse } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler, parseBody } from '@/server/http';
import { UserModel } from '@/server/models/User';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const POST = handler(async (req) => {
  await connectDB();
  const { email, password } = await parseBody(req, loginSchema);

  const user = await UserModel.findOne({ email });
  const hash = user?.passwordHash;
  if (!user || !hash || !(await bcrypt.compare(password, hash))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isActive) throw new ApiError(403, 'Account is suspended');

  return authResponse(user);
});
