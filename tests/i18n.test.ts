import { afterAll, beforeAll, expect, it } from "vitest";

import { en } from "../src/shared/i18n/en";
import { pt } from "../src/shared/i18n/pt";
import { requestLocale } from "../src/shared/i18n";
import { testApi } from "./helpers";

let api: Awaited<ReturnType<typeof testApi>>;
beforeAll(async () => {
  api = await testApi();
});
afterAll(() => api.close());

it("picks the first supported language of Accept-Language, English otherwise", () => {
  expect(requestLocale("pt-PT,pt;q=0.9,en;q=0.8")).toBe("pt");
  expect(requestLocale("pt-BR")).toBe("pt");
  expect(requestLocale("es-ES,en-GB;q=0.8")).toBe("en");
  expect(requestLocale("de")).toBe("en");
  expect(requestLocale(undefined)).toBe("en");
});

it("answers API errors, validation included, in the request's language", async () => {
  const { cookie } = await api.user("idioma");
  const missing = (lang: string) => api.request("/sessions/nope", { method: "GET", headers: { Cookie: cookie, "Accept-Language": lang } });
  expect(await (await missing("pt-PT")).json()).toEqual({ error: pt.errors.sessionNotFound });
  expect(await (await missing("en")).json()).toEqual({ error: en.errors.sessionNotFound });

  const badAcademy = (lang: string) =>
    api.request("/academies", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json", "Accept-Language": lang }, body: JSON.stringify({ name: "X" }) });
  expect((await (await badAcademy("pt")).json()).error).toContain(pt.validation.academyName);
  expect((await (await badAcademy("en")).json()).error).toContain(en.validation.academyName);
});
