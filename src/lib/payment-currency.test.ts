import { describe, expect, test } from "bun:test";
import { amountInBs, equivalentUSD, appliedBalance } from "./payment-currency";

describe("Cobros y pagos con moneda base Bs", () => {
  test("bolívares no se dividen por la tasa", () => expect(amountInBs(1000, "VES", 50)).toBe(1000));
  test("dólares se convierten a Bs", () => expect(amountInBs(20, "USD", 50)).toBe(1000));
  test("euros se convierten con la tasa EUR en Bs", () => expect(amountInBs(20, "EUR", 60)).toBe(1200));
  test("Equiv. $ divide el pendiente Bs entre la tasa USD", () => expect(equivalentUSD(1000, 50)).toBe(20));
  test("sin tasa no inventa equivalencias", () => expect(equivalentUSD(1000, 0)).toBeNull());
  test("aplicado y resta suman abonos y retenciones en Bs", () => expect(appliedBalance(2000, 1000, 120, 30)).toEqual({ applied: 1150, remaining: 850 }));
});