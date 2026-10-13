import { expect, test } from "bun:test";
import { parseBCVRates } from "./bcv-parser";

test("extrae USD, EUR y fecha valor oficial sin confundir otros indicadores", () => {
  expect(parseBCVRates('<div id="euro"><strong class="strong-tb">982,00454402</strong></div><div id="dolar"><strong>876,79760000</strong></div>Fecha Valor: <span content="2026-10-13T00:00:00-04:00">')).toEqual({ usd: 876.7976, eur: 982.00454402, date: "2026-10-13", source: "https://www.bcv.org.ve/" });
});
test("no inventa tasas si el BCV responde con una página inesperada", () => expect(() => parseBCVRates("no disponible")).toThrow());