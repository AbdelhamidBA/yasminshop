import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import {z} from 'zod';
import {prisma} from '@/lib/db';
import {verifyPassword} from '@/lib/password';
import {authConfig} from './auth.config';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const {handlers, auth, signIn, signOut} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {email: {}, password: {}},
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: {email: parsed.data.email}
        });
        if (!user || user.archivedAt) return null;
        if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return null;

        return {id: user.id, name: user.name, email: user.email, role: user.role};
      }
    })
  ]
});
