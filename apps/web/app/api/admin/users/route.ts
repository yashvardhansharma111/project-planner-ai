import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth';
import { connectDB } from '@/server/db';
import { handler } from '@/server/http';
import { UserModel } from '@/server/models/User';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  await connectDB();
  requireRole(req, 'admin');
  const users = await UserModel.find().select('-passwordHash').sort({ createdAt: -1 });
  return NextResponse.json({ users });
});
