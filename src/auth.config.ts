import type {NextAuthConfig} from 'next-auth';

export const authConfig = {
  providers: [],
  session: {strategy: 'jwt'},
  pages: {signIn: '/login'},
  callbacks: {
    // Edge-safe: NO prisma import here (this config is loaded by middleware).
    // The DB re-check that actually enforces revocation lives in the server-only
    // require* helpers (src/server/authz.ts); here we only PERSIST the version
    // claim minted at sign-in so those helpers have something to compare.
    jwt({token, user}) {
      if (user) {
        token.role = (user as {role?: 'ADMIN' | 'SUB_ADMIN' | 'CLIENT'}).role;
        token.tokenVersion = (user as {tokenVersion?: number}).tokenVersion ?? 0;
      }
      return token;
    },
    session({session, token}) {
      if (session.user) {
        session.user.role = (token.role ?? 'CLIENT') as 'ADMIN' | 'SUB_ADMIN' | 'CLIENT';
        session.user.id = token.sub ?? '';
        session.user.tokenVersion = (token.tokenVersion as number | undefined) ?? 0;
      }
      return session;
    }
  }
} satisfies NextAuthConfig;
