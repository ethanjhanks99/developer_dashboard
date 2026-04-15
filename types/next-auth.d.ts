import "next-auth";

declare module "next-auth" {
  interface User {
    githubLogin?: string | null;
  }

  interface Session {
    user: {
      id: string;
      githubLogin: string | null;
    } & DefaultSession["user"];
  }
}
