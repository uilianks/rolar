import { expect, it } from "vitest";

import { checkinUrl, parseCheckin } from "../src/lib/checkin-code";

it("reads only Rolar check-in QR codes", () => {
  expect(parseCheckin("https://rolar.app/checkin?a=ac1&t=abc")).toEqual({ a: "ac1", t: "abc" });
  expect(parseCheckin(checkinUrl("http://192.168.1.10:8081", { a: "ac1", t: "a-b_c" }))).toEqual({ a: "ac1", t: "a-b_c" });
  expect(parseCheckin("https://rolar.app/checkin?a=ac1")).toBeNull();
  expect(parseCheckin("https://example.com/promo?a=1&t=3")).toBeNull();
  expect(parseCheckin("WIFI:S:academia;T:WPA;P:oss;;")).toBeNull();
});
