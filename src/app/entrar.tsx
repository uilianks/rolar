import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { authClient } from "@/lib/auth-client";
import { Button, Card, Col, ErrorText, Input, Row, Txt } from "@/ui/kit";
import { BrandMark } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

const GOOGLE_ENABLED = process.env.EXPO_PUBLIC_GOOGLE_LOGIN === "1";

const AUTH_ERRORS: Record<string, string> = {
  INVALID_OTP: "Código inválido. Confira os 6 dígitos.",
  OTP_EXPIRED: "O código expirou. Peça um novo.",
  TOO_MANY_ATTEMPTS: "Muitas tentativas. Peça um novo código.",
  INVALID_EMAIL: "E-mail inválido.",
};

function authMessage(error: { code?: string; message?: string; status?: number }, fallback: string) {
  if (error.status === 429) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  return (error.code && AUTH_ERRORS[error.code]) || fallback;
}

export default function SignIn() {
  const { c } = useTheme();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  // Google sends people back here with ?error=… when the sign-in did not go through.
  const { error: googleError } = useLocalSearchParams<{ error?: string }>();
  const [error, setError] = useState<string | null>(googleError ? "Não foi possível entrar com o Google. Tente de novo ou use o código por e-mail." : null);

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
    if (error) return setError(authMessage(error, "Não foi possível entrar com o Google"));
    await qc.invalidateQueries();
  }

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "sign-in" });
    setBusy(false);
    if (error) return setError(authMessage(error, "Não foi possível enviar o código"));
    setStep("code");
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.emailOtp({ email: email.trim(), otp: code.trim() });
    setBusy(false);
    if (error) return setError(authMessage(error, "Não foi possível entrar"));
    await qc.invalidateQueries();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: space.lg }} keyboardShouldPersistTaps="handled">
        <Col gap={space.xl} style={{ width: "100%", maxWidth: 400, alignSelf: "center" }}>
          <Row style={{ justifyContent: "center" }}>
            <BrandMark />
            <Txt v="h2" style={{ fontWeight: "800" }}>tatame</Txt>
          </Row>

          <Card style={{ gap: space.lg, padding: space.xl }}>
            {step === "email" ? (
              <>
                <Col gap={4} style={{ alignItems: "center" }}>
                  <Txt v="h1" style={{ textAlign: "center" }}>Entrar ou criar conta</Txt>
                  <Txt muted style={{ textAlign: "center" }}>Sem senha: {GOOGLE_ENABLED ? "use o Google ou receba" : "enviamos"} um código no seu e-mail.</Txt>
                </Col>
                {GOOGLE_ENABLED ? (
                  <>
                    <Button
                      size="lg"
                      title="Continuar com Google"
                      loading={busy}
                      onPress={google}
                    />
                    <Txt v="small" muted style={{ textAlign: "center" }}>ou</Txt>
                  </>
                ) : null}
                <Input
                  label="E-mail"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="voce@email.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  inputMode="email"
                  onSubmitEditing={sendCode}
                />
                <ErrorText error={error} />
                <Button kind="primary" size="lg" title="Enviar código" loading={busy} disabled={!email.includes("@")} onPress={sendCode} />
                <Txt v="tiny" muted style={{ textAlign: "center" }}>
                  Ao continuar você aceita a{" "}
                  <Txt v="tiny" style={{ textDecorationLine: "underline" }} onPress={() => router.push("/privacidade")}>
                    Política de Privacidade
                  </Txt>
                  . É preciso ter 13 anos ou mais.
                </Txt>
              </>
            ) : (
              <>
                <Col gap={4} style={{ alignItems: "center" }}>
                  <Txt v="h1" style={{ textAlign: "center" }}>Confira seu e-mail</Txt>
                  <Txt muted style={{ textAlign: "center" }}>
                    Enviamos um código de 6 dígitos para <Txt bold>{email.trim()}</Txt>. Ele vale 10 minutos.
                  </Txt>
                </Col>
                <Input
                  label="Código"
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
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
                <Button kind="primary" size="lg" title="Entrar" loading={busy} disabled={code.length !== 6} onPress={verify} />
                <Row style={{ justifyContent: "center" }}>
                  <Button kind="ghost" size="sm" title="Reenviar código" onPress={sendCode} disabled={busy} />
                  <Button kind="ghost" size="sm" title="Usar outro e-mail" onPress={() => setStep("email")} />
                </Row>
              </>
            )}
          </Card>
          <View />
        </Col>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
