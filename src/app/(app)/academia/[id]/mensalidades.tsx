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
import { dateFmt, euros, ymd } from "@/lib/format";
import { currentLocale, useT } from "@/lib/i18n";
import type { BillingOverview, Payment, Plan } from "@/lib/types";
import {
  addMonths,
  type BillingStatus,
  PAYMENT_METHODS,
  paymentInput,
  type PaymentMethod,
  planInput,
} from "@/shared/domain";
import { validationMessage } from "@/shared/i18n";
import { DateField } from "@/ui/date-field";
import { Avatar, Badge, Button, Card, CardHead, Col, ErrorText, Input, Kpi, ListRow, Loading, Row, Segmented, Stepper, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

type Filter = BillingStatus | "all";
type MemberRow = BillingOverview["members"][number];

const TONE: Record<BillingStatus, "default" | "accent" | "success"> = { paid: "success", due: "default", late: "accent", exempt: "default", no_plan: "default" };

const monthLabel = (m: string) => dateFmt({ month: "short", year: "numeric" }).format(new Date(`${m}-15T12:00:00`));

/** The owner's fee book: plans, who is on which plan, payments received, who is late. */
export default function Fees() {
  const t = useT();
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
      const res = await fetch(`${API_URL}/api/academies/${id}/payments.csv?month=${month}`, { credentials: "include", headers: { "Accept-Language": currentLocale() } });
      if (!res.ok) throw new Error(t.common.error(res.status));
      const link = document.createElement("a");
      link.href = URL.createObjectURL(await res.blob());
      link.download = t.paymentsCsv.filename(month);
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
        title={t.academy.fees}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace(`/academia/${id}`))} />}
        right={Platform.OS === "web" ? <Button size="sm" icon={Download} title={t.fees.csv} onPress={exportCsv} /> : undefined}
      />
      <Screen wide>
        {q.isPending ? <Loading /> : null}
        <ErrorText error={q.error ?? error} />
        {b ? (
          <>
            <Txt v="small" muted>
              {t.fees.intro}
            </Txt>
            <Row wrap gap={space.md}>
              <View style={{ flexGrow: 1, flexBasis: 140 }}><Kpi label={t.billingStatus.paid} value={String(count("paid"))} /></View>
              <View style={{ flexGrow: 1, flexBasis: 140 }}><Kpi label={t.billingStatus.due} value={String(count("due"))} sub={t.academyCards.dueDay(b.billingDueDay)} /></View>
              <View style={{ flexGrow: 1, flexBasis: 140 }}><Kpi label={t.billingStatus.late} value={String(count("late"))} subTone={count("late") ? "down" : undefined} sub={count("late") ? t.fees.needsAttention : undefined} /></View>
              <View style={{ flexGrow: 1, flexBasis: 140 }}><Kpi label={t.billingStatus.no_plan} value={String(count("no_plan"))} /></View>
            </Row>

            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: t.fees.filterAll(b.members.length) },
                { value: "late", label: `${t.billingStatus.late} (${count("late")})` },
                { value: "due", label: `${t.billingStatus.due} (${count("due")})` },
                { value: "paid", label: t.billingStatus.paid },
                { value: "no_plan", label: t.billingStatus.no_plan },
                { value: "exempt", label: t.fees.exemptPlural },
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
                        {[m.plan ? `${m.plan.name} · ${euros(m.plan.priceCents)}` : t.billingStatus.no_plan, m.paidThrough ? t.academyCards.paidThrough(monthLabel(m.paidThrough)) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </Txt>
                    </View>
                    <Badge tone={TONE[m.status]}>
                      {t.billingStatus[m.status]}
                      {m.status === "late" ? ` · ${t.academyCards.months(m.lateMonths)}` : ""}
                    </Badge>
                  </ListRow>
                  {open === m.id ? <MemberBilling key={m.id} academyId={id} member={m} plans={b.plans} onChange={refresh} /> : null}
                </View>
              ))}
              {!shown.length ? (
                <View style={{ padding: space.lg }}>
                  <Txt v="small" muted>{t.fees.nobody}</Txt>
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
  const t = useT();
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
    if (!check.success || Number.isNaN(cents)) return setError(check.success ? t.fees.invalidAmount : validationMessage(t, check.error.issues[0].message));
    void run(() => api(`/academies/${academyId}/payments`, { method: "POST", json: check.data }), t.fees.recorded);
  }

  return (
    <View style={{ padding: space.lg, gap: space.md, backgroundColor: c.muted }}>
      <Segmented
        label={t.fees.plan}
        value={m.planId ?? ""}
        onChange={(planId) => run(() => api(`/academies/${academyId}/members/${m.id}/plan`, { method: "PATCH", json: { planId: planId || null } }))}
        options={[{ value: "", label: t.billingStatus.no_plan }, ...plans.map((p) => ({ value: p.id, label: `${p.name} · ${euros(p.priceCents)}` }))]}
      />
      {m.plan && m.plan.priceCents > 0 ? (
        <Card style={{ gap: space.md }}>
          <Txt v="h3">{t.fees.record}</Txt>
          <Row gap={space.md} wrap>
            <Col style={{ flex: 1, minWidth: 110 }}>
              <Input label={t.fees.amount} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            </Col>
            <Col style={{ flex: 1, minWidth: 140 }}>
              <DateField label={t.fees.paidOn} value={paidOn} onChange={setPaidOn} />
            </Col>
            <Col style={{ flex: 1, minWidth: 120 }}>
              <Input label={t.fees.covers} value={coversFrom} onChangeText={setCoversFrom} maxLength={7} />
            </Col>
          </Row>
          <Stepper label={t.fees.months} value={months} onChange={setMonths} min={1} max={12} />
          <Segmented label={t.fees.method} value={method} onChange={setMethod} options={PAYMENT_METHODS.map((p) => ({ value: p, label: t.paymentMethod[p] }))} />
          <Input label={t.fees.note} value={note} onChangeText={setNote} placeholder={t.fees.optional} />
          <Row gap={space.sm} wrap>
            <Button kind="primary" icon={Plus} title={t.fees.record} onPress={record} />
            {m.status === "late" || m.status === "due" ? (
              <Button icon={Bell} title={t.fees.remind} onPress={() => run(() => api(`/academies/${academyId}/members/${m.id}/remind`, { method: "POST" }), t.fees.reminded)} />
            ) : null}
          </Row>
        </Card>
      ) : null}
      {info ? <Txt v="small" color={c.success}>{info}</Txt> : null}
      <ErrorText error={error} />
      <Col gap={4}>
        <Txt v="small" bold>{t.fees.history}</Txt>
        {history.data?.length ? (
          history.data.map((p) => (
            <Row key={p.id} gap={space.sm}>
              <Txt v="small" style={{ flex: 1 }}>
                {dateFmt({ day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${p.paidOn}T12:00:00`))} · {euros(p.amountCents)} · {t.paymentMethod[p.method]} · {monthLabel(p.coversFrom)}
                {p.months > 1 ? ` (+${p.months - 1})` : ""}
                {p.note ? ` · ${p.note}` : ""}
              </Txt>
              <Button
                size="sm"
                kind="ghost"
                icon={Trash}
                accessibilityLabel={t.fees.deletePayment}
                onPress={async () => {
                  if (await confirm(t.fees.deletePaymentTitle, t.fees.deletePaymentText, t.academyCards.deleteAction)) {
                    void run(() => api(`/academies/${academyId}/payments/${p.id}`, { method: "DELETE" }));
                  }
                }}
              />
            </Row>
          ))
        ) : (
          <Txt v="small" muted>{history.isPending ? "…" : t.fees.noPayments}</Txt>
        )}
      </Col>
    </View>
  );
}

function Plans({ academyId, plans, dueDay, onChange }: { academyId: string; plans: Plan[]; dueDay: number; onChange: () => void }) {
  const t = useT();
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
    if (!check.success) return setError(validationMessage(t, check.error.issues[0].message));
    void run(async () => {
      await api(`/academies/${academyId}/plans`, { method: "POST", json: check.data });
      setName("");
      setPrice("");
    });
  }

  return (
    <Card pad={false}>
      <CardHead title={t.fees.plans} />
      {plans.map((p) => (
        <ListRow key={p.id}>
          <View style={{ flex: 1 }}>
            <Txt bold>{p.name}</Txt>
            <Txt v="tiny" muted>
              {p.priceCents ? euros(p.priceCents) : t.billingStatus.exempt} · {t.fees.period(p.periodMonths)}
            </Txt>
          </View>
          <Button
            size="sm"
            kind="ghost"
            icon={Trash}
            accessibilityLabel={t.scheduleEdit.removeA11y(p.name)}
            onPress={async () => {
              if (await confirm(t.fees.removePlanTitle(p.name), t.fees.removePlanText, t.common.remove)) {
                void run(() => api(`/academies/${academyId}/plans/${p.id}`, { method: "DELETE" }));
              }
            }}
          />
        </ListRow>
      ))}
      <Col style={{ padding: space.lg }}>
        <Row gap={space.md} wrap>
          <Col style={{ flex: 2, minWidth: 160 }}>
            <Input label={t.fees.newPlan} value={name} onChangeText={setName} placeholder={t.fees.newPlanPlaceholder} />
          </Col>
          <Col style={{ flex: 1, minWidth: 100 }}>
            <Input label={t.fees.amount} value={price} onChangeText={setPrice} placeholder="45" keyboardType="decimal-pad" hint={t.fees.zeroExempt} />
          </Col>
        </Row>
        <Stepper label={t.fees.periodMonths} value={period} onChange={setPeriod} min={1} max={12} />
        <Button icon={Plus} title={t.fees.addPlan} onPress={add} style={{ alignSelf: "flex-start" }} />
        <Stepper label={t.fees.dueDay} value={day} onChange={setDay} min={1} max={28} />
        {day !== dueDay ? (
          <Button size="sm" title={t.fees.saveDueDay} onPress={() => run(() => api(`/academies/${academyId}/billing/settings`, { method: "PATCH", json: { billingDueDay: day } }))} style={{ alignSelf: "flex-start" }} />
        ) : null}
        <ErrorText error={error} />
      </Col>
    </Card>
  );
}
