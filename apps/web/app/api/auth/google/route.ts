import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { authResponse } from '@/server/auth';
import { connectDB } from '@/server/db';
import { env } from '@/server/env';
import { ApiError, handler, parseBody } from '@/server/http';
import { UserModel } from '@/server/models/User';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
const googleAuthSchema = z.object({ idToken: z.string().min(1) });

export const POST = handler(async (req) => {
  if (!env.GOOGLE_CLIENT_ID) throw new ApiError(503, 'Google sign-in is not configured');
  await connectDB();
  const { idToken } = await parseBody(req, googleAuthSchema);

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(401, 'Invalid Google token');
  }
  if (!payload?.email || payload.email_verified === false) {
    throw new ApiError(401, 'Google account email is not verified');
  }

  const email = payload.email.toLowerCase();
  const fullName = payload.name?.trim() || email.split('@')[0];

  let user = await UserModel.findOne({ email });
  if (!user) {
    user = await UserModel.create({
      fullName,
      email,
      googleId: payload.sub,
      avatarUrl: payload.picture ?? null,
      role: 'client',
      isActive: true,
    });
  } else {
    if (!user.isActive) throw new ApiError(403, 'Account is suspended');
    if (!user.googleId) {
      user.googleId = payload.sub;
      if (!user.avatarUrl && payload.picture) user.avatarUrl = payload.picture;
      await user.save();
    }
  }

  return authResponse(user);
});
