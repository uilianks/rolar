import { loadEnv } from "../server/env";
import { buildApp } from "../server/main";

const ORIGIN = "http://localhost:8081";

/** API backed by an in-memory PGlite; login codes are captured instead of e-mailed. */
export async function testApi(overrides: Record<string, string> = {}) {
  const codes = new Map<string, string>();
  const env = loadEnv({ NODE_ENV: "test", DATABASE_URL: "", ADMIN_EMAILS: "admin@example.com", ...overrides });
  const { app, handle } = await buildApp(env, async (email, code) => {
    codes.set(email, code);
  });
  await handle.migrate();

  async function call(method: string, path: string, opts: { cookie?: string; json?: unknown; ip?: string } = {}) {
    const res = await app.request(`http://localhost:8799/api${path}`, {
      method,
      headers: {
        Origin: ORIGIN,
        ...(opts.ip ? { "X-Forwarded-For": opts.ip } : {}),
        ...(opts.cookie ? { Cookie: opts.cookie } : {}),
        ...(opts.json !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers };
  }

  /** Full e-mail code login; returns the session cookie. */
  async function signIn(email: string) {
    const start = await call("POST", "/auth/email-otp/send-verification-otp", { json: { email, type: "sign-in" } });
    if (start.status !== 200) throw new Error(`send code: ${start.status} ${JSON.stringify(start.data)}`);
    const verify = await call("POST", "/auth/sign-in/email-otp", { json: { email, otp: codes.get(email) } });
    const cookie = verify.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .find((c) => c.startsWith("better-auth.session_token="));
    if (!cookie) throw new Error(`no session cookie (status ${verify.status} ${JSON.stringify(verify.data)})`);
    return cookie;
  }

  /** Signs in and completes onboarding. */
  async function user(username: string, extra: Record<string, unknown> = {}) {
    const cookie = await signIn(`${username}@example.com`);
    const res = await call("POST", "/me/profile", {
      cookie,
      json: { username, name: username, birthYear: 1990, belt: "white", stripes: 0, ...extra },
    });
    if (res.status !== 201) throw new Error(`profile: ${res.status} ${JSON.stringify(res.data)}`);
    const me = await call("GET", "/me", { cookie });
    return { cookie, id: me.data.user.id as string, username };
  }

  let adminCookie: string | null = null;
  /** Registers an academy and has the admin approve it (the usual precondition for academy tests). */
  async function approvedAcademy(cookie: string, extra: Record<string, unknown> = {}) {
    const a = await call("POST", "/academies", { cookie, json: academyBody(extra) });
    if (a.status !== 201) throw new Error(`academy: ${a.status} ${JSON.stringify(a.data)}`);
    adminCookie ??= (await user("admin")).cookie;
    const r = await call("POST", `/admin/academies/${a.data.id}/review`, { cookie: adminCookie, json: { decision: "approve" } });
    if (r.status !== 204) throw new Error(`approve: ${r.status} ${JSON.stringify(r.data)}`);
    return a.data as { id: string; slug: string; country: string };
  }

  /** A request with exactly these headers (call() always adds the web app's Origin). */
  const request = (path: string, init: RequestInit) => app.request(`http://localhost:8799/api${path}`, init);

  return { call, request, signIn, user, approvedAcademy, db: handle.db, close: () => handle.close() };
}

export function sessionBody(extra: Record<string, unknown> = {}) {
  return { kind: "gi", startedAt: new Date().toISOString(), durationMin: 90, rounds: 6, rpe: 7, ...extra };
}

export function academyBody(extra: Record<string, unknown> = {}) {
  return {
    name: "Tatame Centro",
    address: "Rua do Tatame 10",
    city: "Lisboa",
    country: "pt",
    phone: "+351 210 000 000",
    instagram: "@tatamecentro",
    requesterRole: "owner",
    proof: "Sou o dono; o Instagram da academia mostra-me a dar aulas e podem ligar para o número.",
    ...extra,
  };
}
