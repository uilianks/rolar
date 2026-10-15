import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Bell from "lucide-react-native/icons/bell";
import Download from "lucide-react-native/icons/download";
import Plus from "lucide-react-native/icons/plus";
import Trash from "lucide-react-native/icons/trash";
import { useState } from "react";
import { Platform, View } from "react-native";

import { api } from "@/lib/api";
import { API_URL } from "@/lib/auth-client";
import { confirm } from "@/lib/confirm";
import { ymd } from "@/lib/format";
import type { BillingOverview, Payment, Plan } from "@/lib/types";
import {
  addMonths,
  BILLING_STATUS_LABEL,
  type BillingStatus,
  formatEuros,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  paymentInput,
  type PaymentMethod,
  planInput,
} from "@/shared/domain";
import { Avatar, Badge, Button, Card, CardHead, Col, ErrorText, Input, Kpi, ListRow, Loading, Row, Segmented, Stepper, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

type Filter = BillingStatus | "all";
type MemberRow = BillingOverview["members"][number];

const TONE: Record<BillingStatus, "default" | "accent" | "success"> = { paid: "success", due: "default", late: "accent", exempt: "default", no_plan: "default" };

const monthLabel = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString("pt-PT", { month: "short", year: "numeric" });

/** The owner's fee book: plans, who is on which plan, payments received, who is late. */
export default function Fees() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["academy", id, "billing"], queryFn: () => api<BillingOverview>(`/academies/${id}/billing`) });
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["academy", id, "billing"] });

  async function exportCsv() {
    setError(null);
    const month = ymd(new Date()).slice(0, 7);
    try {
      const res = await fetch(`${API_URL}/api/academies/${id}/payments.csv?month=${month}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(await res.blob());
      link.download = `mensalidades-${month}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      setError(e);
    }
  }

  const b = q.data;
  const count = (s: BillingStatus) => (b?.members ?? []).filter((m) => m.status === s).length;
  // The open row stays while you work on it, even after a payment moves it out of the filter.
  const shown = (b?.members ?? []).filter((m) => filter === "all" || m.status === filter || m.id === open);

  return (
    <>
      <Header
        title="Mensalidades"
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/academia/${id}`))} />}
        right={Platform.OS === "web" ? <Button size="sm" icon={Download} title="CSV do mês" onPress={exportCsv} /> : undefined}
      />
      <Screen wide>
        {q.isPending ? <Loading /> : null}
        <ErrorText error={q.error ?? error} />
        {b ? (
          <>
            <Txt v="small" muted>
              Controlo de pagamentos para o responsável. O app não cobra nem movimenta dinheiro; só os alunos veem a própria situação.
            </Txt>
            <Row wrap gap={space.md}>
              <View style={{ flexGrow: 1, flexBasis: 140 }}><Kpi label="Em dia" value={String(count("paid"))} /></View>
              <View style={{ flexGrow: 1, flexBasis: 140 }}><Kpi label="A vencer" value={String(count("due"))} sub={`vence dia ${b.billingDueDay}`} /></View>
              <View style={{ flexGrow: 1, flexBasis: 140 }}><Kpi label="Em atraso" value={String(count("late"))} subTone={count("late") ? "down" : undefined} sub={count("late") ? "precisa de atenção" : undefined} /></View>
              <View style={{ flexGrow: 1, flexBasis: 140 }}><Kpi label="Sem plano" value={String(count("no_plan"))} /></View>
            </Row>

            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: `Todos (${b.members.length})` },
                { value: "late", label: `Em atraso (${count("late")})` },
                { value: "due", label: `A vencer (${count("due")})` },
                { value: "paid", label: "Em dia" },
                { value: "no_plan", label: "Sem plano" },
                { value: "exempt", label: "Isentos" },
              ]}
            />

            <Card pad={false}>
              {shown.map((m) => (
                <View key={m.id}>
                  <ListRow onPress={() => setOpen(open === m.id ? null : m.id)} highlight={open === m.id}>
                    <Avatar uri={m.avatarUrl} name={m.name} size={32} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt bold>{m.name}</Txt>
                      <Txt v="tiny" muted>
                        {[m.plan ? `${m.plan.name} · ${formatEuros(m.plan.priceCents)}` : "Sem plano", m.paidThrough ? `pago até ${monthLabel(m.paidThrough)}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </Txt>
                    </View>
                    <Badge tone={TONE[m.status]}>
                      {BILLING_STATUS_LABEL[m.status]}
                      {m.status === "late" ? ` · ${m.lateMonths} ${m.lateMonths === 1 ? "mês" : "meses"}` : ""}
                    </Badge>
                  </ListRow>
                  {open === m.id ? <MemberBilling key={m.id} academyId={id} member={m} plans={b.plans} onChange={refresh} /> : null}
                </View>
              ))}
              {!shown.length ? (
                <View style={{ padding: space.lg }}>
                  <Txt v="small" muted>Ninguém aqui.</Txt>
                </View>
              ) : null}
            </Card>

            <Plans academyId={id} plans={b.plans} dueDay={b.billingDueDay} onChange={refresh} />
          </>
        ) : null}
      </Screen>
    </>
  );
}

/** Expanded row: plan, record a payment, remind, history. */
function MemberBilling({ academyId, member: m, plans, onChange }: { academyId: string; member: MemberRow; plans: Plan[]; onChange: () => void }) {
  const { c } = useTheme();
  const qc = useQueryClient();
  const history = useQuery({ queryKey: ["payments", academyId, m.id], queryFn: () => api<Payment[]>(`/academies/${academyId}/members/${m.id}/payments`) });
  const current = ymd(new Date()).slice(0, 7);
  const [amount, setAmount] = useState(m.plan ? (m.plan.priceCents / 100).toFixed(2).replace(".", ",") : "");
  const [method, setMethod] = useState<PaymentMethod>("mbway");
  const [paidOn, setPaidOn] = useState(ymd(new Date()));
  const [coversFrom, setCoversFrom] = useState(m.paidThrough && m.paidThrough >= addMonths(current, -12) ? addMonths(m.paidThrough, 1) : current);
  const [months, setMonths] = useState(m.plan?.periodMonths ?? 1);
  const [note, setNote] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, done?: string) {
    setError(null);
    setInfo(null);
    try {
      await fn();
      await Promise.all([onChange(), qc.invalidateQueries({ queryKey: ["payments", academyId, m.id] })]);
      if (done) setInfo(done);
    } catch (e) {
      setError(e);
    }
  }

  function record() {
    const cents = Math.round(Number(amount.replace(",", ".")) * 100);
    const check = paymentInput.safeParse({ userId: m.id, amountCents: cents, method, paidOn, coversFrom, months, note });
    if (!check.success || Number.isNaN(cents)) return setError(check.success ? "Valor inválido" : check.error.issues[0].message);
    void run(() => api(`/academies/${academyId}/payments`, { method: "POST", json: check.data }), "Pagamento registrado.");
  }

  return (
    <View style={{ padding: space.lg, gap: space.md, backgroundColor: c.muted }}>
      <Segmented
        label="Plano"
        value={m.planId ?? ""}
        onChange={(planId) => run(() => api(`/academies/${academyId}/members/${m.id}/plan`, { method: "PATCH", json: { planId: planId || null } }))}
        options={[{ value: "", label: "Sem plano" }, ...plans.map((p) => ({ value: p.id, label: `${p.name} · ${formatEuros(p.priceCents)}` }))]}
      />
      {m.plan && m.plan.priceCents > 0 ? (
        <Card style={{ gap: space.md }}>
          <Txt v="h3">Registrar pagamento</Txt>
          <Row gap={space.md} wrap>
            <Col style={{ flex: 1, minWidth: 110 }}>
              <Input label="Valor (€)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            </Col>
            <Col style={{ flex: 1, minWidth: 140 }}>
              <Input label="Pago em" value={paidOn} onChangeText={setPaidOn} maxLength={10} />
            </Col>
            <Col style={{ flex: 1, minWidth: 120 }}>
              <Input label="Referente a (AAAA-MM)" value={coversFrom} onChangeText={setCoversFrom} maxLength={7} />
            </Col>
          </Row>
          <Stepper label="Meses" value={months} onChange={setMonths} min={1} max={12} />
          <Segmented label="Forma" value={method} onChange={setMethod} options={PAYMENT_METHODS.map((p) => ({ value: p, label: PAYMENT_METHOD_LABEL[p] }))} />
          <Input label="Nota" value={note} onChangeText={setNote} placeholder="Opcional" />
          <Row gap={space.sm} wrap>
            <Button kind="primary" icon={Plus} title="Registrar pagamento" onPress={record} />
            {m.status === "late" || m.status === "due" ? (
              <Button icon={Bell} title="Lembrar o aluno" onPress={() => run(() => api(`/academies/${academyId}/members/${m.id}/remind`, { method: "POST" }), "Lembrete enviado no app.")} />
            ) : null}
          </Row>
        </Card>
      ) : null}
      {info ? <Txt v="small" color={c.success}>{info}</Txt> : null}
      <ErrorText error={error} />
      <Col gap={4}>
        <Txt v="small" bold>Histórico</Txt>
        {history.data?.length ? (
          history.data.map((p) => (
            <Row key={p.id} gap={space.sm}>
              <Txt v="small" style={{ flex: 1 }}>
                {new Date(`${p.paidOn}T12:00:00`).toLocaleDateString("pt-PT")} · {formatEuros(p.amountCents)} · {PAYMENT_METHOD_LABEL[p.method]} · {monthLabel(p.coversFrom)}
                {p.months > 1 ? ` (+${p.months - 1})` : ""}
                {p.note ? ` · ${p.note}` : ""}
              </Txt>
              <Button
                size="sm"
                kind="ghost"
                icon={Trash}
                accessibilityLabel="Apagar pagamento"
                onPress={async () => {
                  if (await confirm("Apagar este pagamento?", "Use só para corrigir um registro feito por engano.", "Apagar")) {
                    void run(() => api(`/academies/${academyId}/payments/${p.id}`, { method: "DELETE" }));
                  }
                }}
              />
            </Row>
          ))
        ) : (
          <Txt v="small" muted>{history.isPending ? "…" : "Nenhum pagamento registrado."}</Txt>
        )}
      </Col>
    </View>
  );
}

function Plans({ academyId, plans, dueDay, onChange }: { academyId: string; plans: Plan[]; dueDay: number; onChange: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [period, setPeriod] = useState(1);
  const [day, setDay] = useState(dueDay);
  const [error, setError] = useState<unknown>(null);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      onChange();
    } catch (e) {
      setError(e);
    }
  }

  function add() {
    const check = planInput.safeParse({ name, priceCents: Math.round(Number(price.replace(",", ".") || "0") * 100), periodMonths: period });
    if (!check.success) return setError(check.error.issues[0].message);
    void run(async () => {
      await api(`/academies/${academyId}/plans`, { method: "POST", json: check.data });
      setName("");
      setPrice("");
    });
  }

  return (
    <Card pad={false}>
      <CardHead title="Planos" />
      {plans.map((p) => (
        <ListRow key={p.id}>
          <View style={{ flex: 1 }}>
            <Txt bold>{p.name}</Txt>
            <Txt v="tiny" muted>
              {p.priceCents ? formatEuros(p.priceCents) : "Isento"} · {p.periodMonths === 1 ? "mensal" : `a cada ${p.periodMonths} meses`}
            </Txt>
          </View>
          <Button
            size="sm"
            kind="ghost"
            icon={Trash}
            accessibilityLabel={`Remover ${p.name}`}
            onPress={async () => {
              if (await confirm(`Remover o plano "${p.name}"?`, "Quem está nele fica sem plano. Os pagamentos antigos continuam.", "Remover")) {
                void run(() => api(`/academies/${academyId}/plans/${p.id}`, { method: "DELETE" }));
              }
            }}
          />
        </ListRow>
      ))}
      <Col style={{ padding: space.lg }}>
        <Row gap={space.md} wrap>
          <Col style={{ flex: 2, minWidth: 160 }}>
            <Input label="Novo plano" value={name} onChangeText={setName} placeholder="Mensal adulto" />
          </Col>
          <Col style={{ flex: 1, minWidth: 100 }}>
            <Input label="Valor (€)" value={price} onChangeText={setPrice} placeholder="45" keyboardType="decimal-pad" hint="0 = isento (bolsa)" />
          </Col>
        </Row>
        <Stepper label="Período (meses)" value={period} onChange={setPeriod} min={1} max={12} />
        <Button icon={Plus} title="Adicionar plano" onPress={add} style={{ alignSelf: "flex-start" }} />
        <Stepper label="Dia de vencimento" value={day} onChange={setDay} min={1} max={28} />
        {day !== dueDay ? (
          <Button size="sm" title="Salvar dia de vencimento" onPress={() => run(() => api(`/academies/${academyId}/billing/settings`, { method: "PATCH", json: { billingDueDay: day } }))} style={{ alignSelf: "flex-start" }} />
        ) : null}
        <ErrorText error={error} />
      </Col>
    </Card>
  );
}
