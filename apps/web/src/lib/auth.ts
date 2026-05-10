import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { credentialsVerifyBodySchema } from '@expense/shared';

import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken } from './access-token';

const apiBaseUrl = (): string => {
  const url = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error('API_BASE_URL or NEXT_PUBLIC_API_URL must be set');
  return url.replace(/\/$/, '');
};

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/sign-in', error: '/sign-in' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(rawCreds) {
        const parsed = credentialsVerifyBodySchema.safeParse(rawCreds);
        if (!parsed.success) return null;

        const res = await fetch(`${apiBaseUrl()}/auth/credentials-verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(parsed.data),
        });
        if (!res.ok) return null;
        const user = (await res.json()) as { id: string; email: string; name: string };
        return user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // First sign-in — populate identity claims
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      // Mint or refresh accessToken
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = token.accessTokenExpiresAt ?? 0;
      if (!token.accessToken || expiresAt - now < 60) {
        token.accessToken = signAccessToken({
          userId: token.sub,
          email: token.email,
        });
        token.accessTokenExpiresAt = now + ACCESS_TOKEN_TTL_SECONDS;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.user = {
        id: token.sub,
        email: token.email,
        name: token.name,
      };
      return session;
    },
  },
};
