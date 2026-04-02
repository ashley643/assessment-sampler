import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: 'Password',
      credentials: { password: { label: 'Password', type: 'password' } },
      async authorize(credentials) {
        if (credentials?.password === process.env.ADMIN_SECRET) {
          return { id: 'admin', name: 'Admin', email: 'admin@impacterpathway.com' };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      // Allow credentials login always (checked above)
      if (account?.provider === 'credentials') return true;
      // Google: restrict to @impacterpathway.com
      if (account?.provider === 'google') {
        return profile?.email?.endsWith('@impacterpathway.com') ?? false;
      }
      return false;
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: '/admin',
    error: '/admin',
  },
  secret: process.env.NEXTAUTH_SECRET,
});
