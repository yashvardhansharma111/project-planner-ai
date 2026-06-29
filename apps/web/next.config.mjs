/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep these Node libraries out of the bundle so route handlers load them at
    // runtime (Mongoose in particular doesn't bundle cleanly).
    serverComponentsExternalPackages: ['mongoose', 'bcryptjs', 'google-auth-library', 'jsonwebtoken'],
  },
};

export default nextConfig;
