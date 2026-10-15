import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { authClient } from "@/lib/auth-client";
import { msg, useLocale } from "@/lib/i18n";
import { LOCALES } from "@/shared/i18n";
import { Button, Card, Col, ErrorText, Input, Row, Txt } from "@/ui/kit";
import { InstallHint } from "@/ui/install-hint";
import { BrandMark } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

// The e-mail waiting for its code outlives this screen: when the person switches to their e-mail app,
// the session is re-checked on return and the screen is mounted again, and phones may even reload a
// backgrounded browser tab. Kept in memory, and on the web in this tab's sessionStorage, until the code
// expires.
const PENDING_KEY = "rolar_login_pending";
const CODE_TTL_MS = 10 * 60 * 1000;
type Pending = { email: string; at: number };
let memoryPending: Pending | null = null;

function loadPending(): string | null {
  let saved = memoryPending;
  if (!saved && Platform.OS === "web") {
    try {
      saved = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null") as Pending | null;
    } catch {
      saved = null;
    }
  }
  return saved && Date.now() - saved.at < CODE_TTL_MS ? saved.email : null;
}

function savePending(email: string | null) {
  memoryPending = email ? { email, at: Date.now() } : null;
  if (Platform.OS !== "web") return;
  try {
    if (memoryPending) sessionStorage.setItem(PENDING_KEY, JSON.stringify(memoryPending));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Storage can be unavailable (private mode); memory still covers the remount.
  }
}

const GOOGLE_ENABLED = process.env.EXPO_PUBLIC_GOOGLE_LOGIN === "1";

function authMessage(error: { code?: string; message?: string; status?: number }, fallback: string) {
  const t = msg().signIn;
  if (error.status === 429) return t.rateLimited;
  // The server's message is the moderator's reason (server/auth.ts).
  if (error.code === "ACCOUNT_SUSPENDED") return t.suspended(error.message ?? "");
  return (error.code && (t.errors as Record<string, string>)[error.code]) || fallback;
}

export default function SignIn() {
  const { c } = useTheme();
  const { t, locale, setPref } = useLocale();
  const qc = useQueryClient();
  const [pending] = useState(loadPending);
  const [email, setEmail] = useState(pending ?? "");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">(pending ? "code" : "email");
  const [busy, setBusy] = useState(false);
  // Google sends people back here with ?error=… when the sign-in did not go through.
  const { error: googleError } = useLocalSearchParams<{ error?: string }>();
  const [error, setError] = useState<string | null>(googleError ? t.signIn.googleFailedRetry : null);

  /**
   * Web: come back to this site (in development the API is on another port, and a relative path would
   * land there). Android: a path, which the Better Auth Expo plugin turns into the app's deep link and
   * uses to bring the session cookie back.
   */
  const returnTo = (path: string) => (Platform.OS === "web" ? `${window.location.origin}${path}` : path);

  async function google() {
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: returnTo("/"), errorCallbackURL: returnTo("/entrar") });
    setBusy(false);
    if (error) return setError(authMessage(error, t.signIn.googleFailed));
    await qc.invalidateQueries();
  }

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "sign-in" });
    setBusy(false);
    if (error) return setError(authMessage(error, t.signIn.sendFailed));
    savePending(email.trim());
    setStep("code");
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.emailOtp({ email: email.trim(), otp: code.trim() });
    setBusy(false);
    if (error) return setError(authMessage(error, t.signIn.failed));
    savePending(null);
    await qc.invalidateQueries();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: space.lg }} keyboardShouldPersistTaps="handled">
        <Col gap={space.xl} style={{ width: "100%", maxWidth: 400, alignSelf: "center" }}>
          <Row style={{ justifyContent: "center" }}>
            <BrandMark />
            <Txt v="h2" style={{ fontWeight: "800" }}>rolar</Txt>
          </Row>

          <Card style={{ gap: space.lg, padding: space.xl }}>
            {step === "email" ? (
              <>
                <Col gap={4} style={{ alignItems: "center" }}>
                  <Txt v="h1" style={{ textAlign: "center" }}>{t.signIn.title}</Txt>
                  <Txt muted style={{ textAlign: "center" }}>{GOOGLE_ENABLED ? t.signIn.subtitleGoogle : t.signIn.subtitle}</Txt>
                </Col>
                {GOOGLE_ENABLED ? (
                  <>
                    <Button
                      size="lg"
                      title={t.signIn.google}
                      loading={busy}
                      onPress={google}
                    />
                    <Txt v="small" muted style={{ textAlign: "center" }}>{t.signIn.or}</Txt>
                  </>
                ) : null}
                <Input
                  label={t.signIn.email}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t.signIn.emailPlaceholder}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  inputMode="email"
                  onSubmitEditing={sendCode}
                />
                <ErrorText error={error} />
                <Button kind="primary" size="lg" title={t.signIn.sendCode} loading={busy} disabled={!email.includes("@")} onPress={sendCode} />
                <Txt v="tiny" muted style={{ textAlign: "center" }}>
                  {t.signIn.consentBefore}
                    <Txt v="tiny" style={{ textDecorationLine: "underline" }} onPress={() => router.push("/termos")}>
                      {t.legal.termsTitle}
                    </Txt>
                    {t.signIn.consentAnd}
                    <Txt v="tiny" style={{ textDecorationLine: "underline" }} onPress={() => router.push("/privacidade")}>
                      {t.legal.privacyTitle}
                    </Txt>
                    {t.signIn.consentAfter}
                </Txt>
              </>
            ) : (
              <>
                <Col gap={4} style={{ alignItems: "center" }}>
                  <Txt v="h1" style={{ textAlign: "center" }}>{t.signIn.checkEmail}</Txt>
                  <Txt muted style={{ textAlign: "center" }}>
                    {t.signIn.codeSentBefore}<Txt bold>{email.trim()}</Txt>{t.signIn.codeSentAfter}
                  </Txt>
                </Col>
                <Input
                  label={t.signIn.code}
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  keyboardType="number-pad"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  autoFocus
                  style={{ fontSize: 22, letterSpacing: 8, textAlign: "center", height: 52 }}
                  onSubmitEditing={verify}
                />
                <ErrorText error={error} />
                <Button kind="primary" size="lg" title={t.signIn.enter} loading={busy} disabled={code.length !== 6} onPress={verify} />
                <Row style={{ justifyContent: "center" }}>
                  <Button kind="ghost" size="sm" title={t.signIn.resend} onPress={sendCode} disabled={busy} />
                  <Button kind="ghost" size="sm" title={t.signIn.otherEmail} onPress={() => { savePending(null); setStep("email"); }} />
                </Row>
              </>
            )}
          </Card>
          {step === "email" ? <InstallHint /> : null}
          <Row style={{ justifyContent: "center" }}>
            {LOCALES.map((l) => (
              <Button key={l} kind="ghost" size="sm" title={t.languageName[l]} disabled={l === locale} onPress={() => setPref(l)} />
            ))}
          </Row>
          <View />
        </Col>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
