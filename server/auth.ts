import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";

import type { Db } from "./db/client";
import * as schema from "./db/schema";
import type { Env } from "./env";

/**
 * Login is a 6-digit code sent by e-mail: the same flow works on web and Android without deep links
 * (a magic link would have to reopen the app and hand it the session cookie).
 */
export type LoginCodeSender = (email: string, code: string) => Promise<void>;

/** Resend in production; in development the code is printed so login works without an e-mail domain. */
export function defaultLoginCodeSender(env: Env): LoginCodeSender {
  if (!env.RESEND_API_KEY) {
    return async (email, code) => console.info(`[login-code] ${email}: ${code}`);
  }
  return async (email, code) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: email,
        subject: `${code} é o seu código do rolar`,
        text: `Oss! O seu código para entrar é ${code}. Ele vale 10 minutos.\n\nSe não foi você, ignore este e-mail.`,
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  };
}

export function createAuth(db: Db, env: Env, sendLoginCode: LoginCodeSender = defaultLoginCodeSender(env)) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    basePath: "/api/auth",
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        rateLimit: schema.rateLimit,
      },
    }),
    // Kept in the database: in-memory counters would be per serverless instance. Login codes are
    // the expensive path (each one is an e-mail), so they get a tighter budget, counted per IP. A whole
    // class on the gym's Wi-Fi shares one IP, so the budget fits a full class signing in at once.
    rateLimit: {
      enabled: env.NODE_ENV === "production",
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/email-otp/send-verification-otp": { window: 600, max: 30 },
        "/sign-in/email-otp": { window: 600, max: 60 },
      },
    },
    trustedOrigins: env.TRUSTED_ORIGINS,
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : {},
    plugins: [
      expo(),
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 5,
        sendVerificationOTP: ({ email, otp }) => sendLoginCode(email, otp),
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
