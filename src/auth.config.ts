import type {NextAuthConfig} from 'next-auth';

export const authConfig = {
  providers: [],
  session: {strategy: 'jwt'},
  pages: {signIn: '/login'},
  callbacks: {
    jwt({token, user}) {
      if (user) token.role = (user as {role?: 'ADMIN' | 'SUB_ADMIN' | 'CLIENT'}).role;
      return token;
    },
    session({session, token}) {
      if (session.user) {
        session.user.role = (token.role ?? 'CLIENT') as 'ADMIN' | 'SUB_ADMIN' | 'CLIENT';
        session.user.id = token.sub ?? '';
      }
      return session;
    }
  }
} satisfies NextAuthConfig;
