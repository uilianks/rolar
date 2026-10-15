import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import { useState } from "react";

import { api } from "@/lib/api";
import { useAcademy } from "@/lib/queries";
import type { Academy } from "@/lib/types";
import { academyInput, REQUESTER_ROLE_LABEL, REQUESTER_ROLES, type RequesterRole } from "@/shared/domain";
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
    if (!check.success) return setError(check.error.issues[0].message);
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
        title={id ? "Corrigir cadastro" : "Cadastrar academia"}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/academia"))} />}
      />
      <Screen>
        <Card style={{ gap: space.sm }}>
          <Row>
            <ShieldCheck size={18} color={c.fg} />
            <Txt bold>Toda academia passa por verificação</Txt>
          </Row>
          <Txt v="small" muted>
            Para ninguém se passar pela sua academia, a nossa equipe confere os dados antes de ela aparecer na busca e
            aceitar alunos. Normalmente contactamos a academia pelos canais oficiais (Instagram, site ou telefone) para
            confirmar que você é o responsável. Você recebe uma notificação com a decisão.
          </Txt>
        </Card>
        {existing?.registration?.reviewNote ? (
          <Card style={{ gap: 4 }}>
            <Txt bold color={c.accent}>Motivo da recusa</Txt>
            <Txt v="small">{existing.registration.reviewNote}</Txt>
          </Card>
        ) : null}

        <Card pad={false}>
          <CardHead title="A academia" />
          <Col style={{ padding: space.lg }}>
            <Input label="Nome *" value={f.name} onChangeText={set("name")} placeholder="Equipe Tatame Centro" />
            <Input label="Equipe / filiação" value={f.affiliation} onChangeText={set("affiliation")} placeholder="Ex.: Gracie Barra, Alliance, independente" />
            <Input label="Morada *" value={f.address} onChangeText={set("address")} placeholder="Rua, número" />
            <Row gap={space.md} wrap>
              <Col style={{ flex: 1, minWidth: 120 }}>
                <Input label="Código postal" value={f.postalCode} onChangeText={set("postalCode")} placeholder="1000-001" />
              </Col>
              <Col style={{ flex: 2, minWidth: 160 }}>
                <Input label="Cidade *" value={f.city} onChangeText={set("city")} placeholder="Lisboa" />
              </Col>
              <Col style={{ width: 90 }}>
                <Input label="País *" value={f.country} onChangeText={(v) => set("country")(v.toUpperCase())} maxLength={2} autoCapitalize="characters" placeholder="PT" />
              </Col>
            </Row>
          </Col>
        </Card>

        <Card pad={false}>
          <CardHead title="Canais oficiais" />
          <Col style={{ padding: space.lg }}>
            <Txt v="small" muted>Usamos estes canais para confirmar o cadastro. Site e Instagram ficam visíveis na página da academia; telefone e e-mail não.</Txt>
            <Input label="Telefone da academia *" value={f.phone} onChangeText={set("phone")} placeholder="+351 210 000 000" keyboardType="phone-pad" />
            <Input label="E-mail da academia" value={f.email} onChangeText={set("email")} placeholder="contacto@academia.pt" keyboardType="email-address" autoCapitalize="none" />
            <Input label="Site" value={f.website} onChangeText={set("website")} placeholder="https://academia.pt" autoCapitalize="none" keyboardType="url" />
            <Input label="Instagram" value={f.instagram} onChangeText={set("instagram")} placeholder="@academia" autoCapitalize="none" hint="Informe pelo menos o site ou o Instagram." />
          </Col>
        </Card>

        <Card pad={false}>
          <CardHead title="Você e a academia" />
          <Col style={{ padding: space.lg }}>
            <Segmented label="Qual é o seu papel? *" value={role} onChange={setRole} options={REQUESTER_ROLES.map((r) => ({ value: r, label: REQUESTER_ROLE_LABEL[r] }))} />
            <Input
              label="Como podemos confirmar que é você? *"
              value={f.proof}
              onChangeText={set("proof")}
              multiline
              placeholder="Ex.: apareço nos posts do Instagram da academia como professor; podem mandar mensagem para o Instagram oficial ou ligar para o número acima e perguntar por mim."
            />
          </Col>
        </Card>

        <ErrorText error={error} />
        <Button kind="primary" size="lg" icon={ShieldCheck} title={id ? "Reenviar para verificação" : "Enviar para verificação"} loading={busy} onPress={submit} />
      </Screen>
    </>
  );
}
