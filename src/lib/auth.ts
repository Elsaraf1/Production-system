import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role, Department } from "@/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      displayName: string;
      role: Role;
      department: Department | null;
    };
  }
  interface User {
    id: string;
    username: string;
    displayName: string;
    role: Role;
    department: Department | null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
        });

        if (!user || !user.isActive) return null;

        const passwordMatch = await compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!passwordMatch) return null;

        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          department: user.department,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.displayName = user.displayName;
        token.role = user.role;
        token.department = user.department;
      }
      return token;
    },
    session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.id as string,
        username: token.username as string,
        displayName: token.displayName as string,
        role: token.role as Role,
        department: token.department as Department | null,
      };
      return session;
    },
  },
  pages: { signIn: "/login" },
});
