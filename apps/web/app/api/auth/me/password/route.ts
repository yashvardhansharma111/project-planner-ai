import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler, parseBody } from '@/server/http';
import { UserModel } from '@/server/models/User';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const PATCH = handler(async (req) => {
  await connectDB();
  const { sub } = requireAuth(req);
  const { currentPassword, newPassword } = await parseBody(req, changePasswordSchema);

  const user = await UserModel.findById(sub);
  if (!user) throw new ApiError(404, 'User not found');
  const hash = user.passwordHash;
  if (!hash || !(await bcrypt.compare(currentPassword, hash))) {
    throw new ApiError(
      401,
      user.googleId ? 'This account uses Google sign-in' : 'Current password is incorrect',
    );
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  return NextResponse.json({ message: 'Password updated' });
});
