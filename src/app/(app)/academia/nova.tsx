import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import { useState } from "react";

import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useAcademy } from "@/lib/queries";
import type { Academy } from "@/lib/types";
import { academyInput, REQUESTER_ROLES, type RequesterRole } from "@/shared/domain";
import { validationMessage } from "@/shared/i18n";
import { Button, Card, CardHead, Col, ErrorText, Input, Loading, Row, Segmented, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

const EMPTY = {
  name: "",
  affiliation: "",
  address: "",
  postalCode: "",
  city: "",
  country: "PT",
  phone: "",
  email: "",
  website: "",
  instagram: "",
  proof: "",
};
type Fields = typeof EMPTY;

function fieldsFrom(a: Academy | undefined): Fields {
  const r = a?.registration;
  if (!a || !r) return EMPTY;
  return {
    name: a.name,
    affiliation: a.affiliation ?? "",
    address: a.address ?? "",
    postalCode: r.postalCode ?? "",
    city: a.city ?? "",
    country: a.country ?? "PT",
    phone: r.phone ?? "",
    email: r.email ?? "",
    website: a.website ?? "",
    instagram: a.instagram ?? "",
    proof: r.proof ?? "",
  };
}

/** Registers an academy for verification; with `?id=` corrects and resubmits the owner's registration. */
export default function NewAcademy() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useAcademy(id);
  if (id && existing.isPending) return <Loading />;
  return <AcademyForm id={id} existing={existing.data} />;
}

function AcademyForm({ id, existing }: { id?: string; existing?: Academy }) {
  const t = useT();
  const { c } = useTheme();
  const qc = useQueryClient();
  const [f, setF] = useState<Fields>(() => fieldsFrom(existing));
  const [role, setRole] = useState<RequesterRole>(existing?.registration?.requesterRole ?? "owner");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof Fields) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    setError(null);
    const check = academyInput.safeParse({ ...f, requesterRole: role });
    if (!check.success) return setError(validationMessage(t, check.error.issues[0].message));
    setBusy(true);
    try {
      const a = await api<Academy>(id ? `/academies/${id}` : "/academies", { method: id ? "PUT" : "POST", json: { ...f, requesterRole: role } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["me"] }), qc.invalidateQueries({ queryKey: ["academy"] })]);
      // Correcting returns to the academy page it came from; a new registration opens its page.
      if (id && router.canGoBack()) router.back();
      else router.replace(`/academia/${a.id}`);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <>
      <Header
        title={id ? t.newAcademy.fixTitle : t.findAcademy.register}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/academia"))} />}
      />
      <Screen>
        <Card style={{ gap: space.sm }}>
          <Row>
            <ShieldCheck size={18} color={c.fg} />
            <Txt bold>{t.newAcademy.verifiedTitle}</Txt>
          </Row>
          <Txt v="small" muted>
            {t.newAcademy.verifiedText}
          </Txt>
        </Card>
        {existing?.registration?.reviewNote ? (
          <Card style={{ gap: 4 }}>
            <Txt bold color={c.accent}>{t.newAcademy.rejectReason}</Txt>
            <Txt v="small">{existing.registration.reviewNote}</Txt>
          </Card>
        ) : null}

        <Card pad={false}>
          <CardHead title={t.newAcademy.theAcademy} />
          <Col style={{ padding: space.lg }}>
            <Input label={t.newAcademy.name} value={f.name} onChangeText={set("name")} placeholder={t.newAcademy.namePlaceholder} />
            <Input label={t.newAcademy.affiliation} value={f.affiliation} onChangeText={set("affiliation")} placeholder={t.newAcademy.affiliationPlaceholder} />
            <Input label={t.newAcademy.address} value={f.address} onChangeText={set("address")} placeholder={t.newAcademy.addressPlaceholder} />
            <Row gap={space.md} wrap>
              <Col style={{ flex: 1, minWidth: 120 }}>
                <Input label={t.newAcademy.postalCode} value={f.postalCode} onChangeText={set("postalCode")} placeholder="1000-001" />
              </Col>
              <Col style={{ flex: 2, minWidth: 160 }}>
                <Input label={t.newAcademy.city} value={f.city} onChangeText={set("city")} placeholder="Lisboa" />
              </Col>
              <Col style={{ width: 90 }}>
                <Input label={t.newAcademy.country} value={f.country} onChangeText={(v) => set("country")(v.toUpperCase())} maxLength={2} autoCapitalize="characters" placeholder="PT" />
              </Col>
            </Row>
          </Col>
        </Card>

        <Card pad={false}>
          <CardHead title={t.newAcademy.channels} />
          <Col style={{ padding: space.lg }}>
            <Txt v="small" muted>{t.newAcademy.channelsText}</Txt>
            <Input label={t.newAcademy.phone} value={f.phone} onChangeText={set("phone")} placeholder="+351 210 000 000" keyboardType="phone-pad" />
            <Input label={t.newAcademy.email} value={f.email} onChangeText={set("email")} placeholder={t.newAcademy.emailPlaceholder} keyboardType="email-address" autoCapitalize="none" />
            <Input label={t.newAcademy.website} value={f.website} onChangeText={set("website")} placeholder="https://academia.pt" autoCapitalize="none" keyboardType="url" />
            <Input label="Instagram" value={f.instagram} onChangeText={set("instagram")} placeholder="@academia" autoCapitalize="none" hint={t.newAcademy.instagramHint} />
          </Col>
        </Card>

        <Card pad={false}>
          <CardHead title={t.newAcademy.youAndAcademy} />
          <Col style={{ padding: space.lg }}>
            <Segmented label={t.newAcademy.role} value={role} onChange={setRole} options={REQUESTER_ROLES.map((r) => ({ value: r, label: t.requesterRole[r] }))} />
            <Input
              label={t.newAcademy.proof}
              value={f.proof}
              onChangeText={set("proof")}
              multiline
              placeholder={t.newAcademy.proofPlaceholder}
            />
          </Col>
        </Card>

        <ErrorText error={error} />
        <Button kind="primary" size="lg" icon={ShieldCheck} title={id ? t.newAcademy.resubmit : t.newAcademy.submit} loading={busy} onPress={submit} />
      </Screen>
    </>
  );
}
