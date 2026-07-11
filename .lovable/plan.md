# Ampliación contable ContaVE

Trabajo agrupado en 6 bloques. Al final queda todo integrado.

## 1. Fixes rápidos (van primero, mismo turno)

- **Agregar miembro por email existente**: hoy se busca en `profiles` con el email exacto y falla cuando el usuario existe en `auth.users` pero aún no tiene fila en `profiles` (o el email cambió de caja). Solución:
  - Ampliar el trigger `handle_new_user` para reprocesar cuando ya existe (idempotente).
  - Server function `add_company_member_by_email` con `requireSupabaseAuth` que consulta `auth.users` vía `supabaseAdmin` (búsqueda case-insensitive), inserta en `profiles` si falta y luego en `company_members`. El cliente deja de consultar `profiles` directamente.
- **Máscara de montos en compras/ventas**: reemplazar los `Input type=number` de base/exento/IVA en `invoices-view.tsx` por `MoneyInput` (formato 1.234.567,89) con recálculo del total.
- **Histórico de compras/ventas no muestra exento**: agregar columna "Exento" a la tabla de facturas en `invoices-view.tsx` y al detalle.

## 2. Centros de costo

Módulo transversal para clasificar movimientos.

- Tabla `cost_centers` (jerárquica: `code`, `name`, `parent_id`, `is_active`, `company_id`) con GRANTs y RLS por empresa.
- Columna `cost_center_id` en `journal_lines`, `sales_invoices`, `purchase_invoices` (opcional).
- Vista `/centros-costo` — árbol CRUD (mismo patrón que plan de cuentas).
- Selector de centro de costo en:
  - Líneas de asiento manual (`asientos.tsx`).
  - Cabecera de factura de venta/compra (aplicado a la línea de ingreso/gasto en el asiento automático).
- Informe **Mayor por Centro de Costo** con filtro por centro y rango de fechas.
- Filtro por centro de costo en Libro Mayor, Estado de Resultados y Diario.

## 3. Reverso y cierres

- **Reverso de asiento**: botón "Reversar" en `/asientos` → función `reverse_journal_entry(_entry_id)` que crea nuevo asiento con débitos/créditos invertidos, marca origen y enlaza ambos con `reversed_by_entry_id`. No modifica el original (queda con estado `reversado`).
- **Cierre de mes**: función `close_period(company_id, year, month)` que:
  - Valida que no haya asientos borrador en el rango.
  - Marca el período como cerrado en nueva tabla `accounting_periods` (year, month, status, closed_by).
  - Bloquea (vía trigger) nuevas inserciones/updates en `journal_entries` con fecha dentro del período cerrado.
  - Avanza `current_period_month` de la empresa.
- **Cierre de ejercicio**: función `close_fiscal_year(company_id)` que:
  - Genera asiento de cierre: saldan cuentas de ingreso/costo/gasto contra "Resultado del ejercicio".
  - Traslada utilidad/pérdida a "Resultados acumulados".
  - Marca `fiscal_year_start/end` como cerrado.
- **Apertura de mes/ejercicio**: reabre período (solo admin) o genera asiento de apertura con saldos iniciales de balance.
- Vista `/cierres` con acciones y estado por período.

## 4. Exportaciones SENIAT

Formatos oficiales generados client-side (TXT/XML).

- **TXT Libro de Ventas** (Providencia SNAT/2003/1677): registro por línea con RIF, número factura, control, base, exento, IVA, retenido, ancho fijo.
- **TXT Libro de Compras**: mismo esquema para compras.
- **TXT Retenciones IVA** (formato XML de la Providencia 0049).
- **XML Retenciones ISLR** (formato AR-CV).
- **TXT Declaración IVA** resumen.
- Cada informe existente (`libro-ventas`, `libro-compras`, `retenciones`, `declaracion-iva`) recibe botón "Exportar SENIAT" además del CSV actual.
- Helpers en `src/lib/seniat/` (`fixed-width.ts`, `libro-ventas.ts`, `libro-compras.ts`, `ret-iva.ts`, `ret-islr.ts`).

## 5. Libros según normativa SENIAT

Refinar los libros existentes para cumplir con las columnas exigidas:

- **Libro de Ventas**: N° operación, fecha, RIF/CI cliente, nombre, N° factura, N° control, N° nota débito/crédito, N° comprobante retención, tipo transacción (F/NC/ND), total ventas incluyendo IVA, ventas exentas, base imponible, alícuota, IVA débito, IVA retenido por terceros.
- **Libro de Compras**: mismos campos ajustados a proveedor + crédito fiscal.
- **Libro de Retenciones IVA**: comprobante, fecha, RIF proveedor, factura, base, IVA, % retención, monto retenido.
- **Libro de Retenciones ISLR**: comprobante, RIF, concepto, código concepto, base, %, retenido, sustraendo.
- Cierre mensual del libro (numeración correlativa por período).

## 6. Reportes adicionales

- **Libro Mayor Analítico** por centro de costo.
- **Auxiliares** de cuentas por cobrar / cuentas por pagar (saldo por cliente/proveedor).
- **Estado de Situación Comparativo** (dos períodos).
- **Flujo de caja indirecto** básico.

## Detalles técnicos

- Migraciones separadas por bloque (centros de costo, cierres, reverso, períodos).
- Todas las funciones DB con `SECURITY DEFINER` + `search_path = public` + verificación de rol vía `company_has_role`.
- Nuevas rutas TanStack en `src/routes/_authenticated/`.
- Sidebar (`route.tsx`) recibe subsección "Cierres" y "Exportaciones SENIAT".
- Los TXT/XML se descargan con `Blob` (helper existente `downloadCsv` generalizado a `downloadText`).

## Alcance del turno

Es mucho trabajo. Propongo ejecutar en este orden dentro de este mismo turno:

1. Bloque 1 completo (fixes: bug de miembros + máscara + exento en histórico).
2. Bloque 2 completo (centros de costo end-to-end).
3. Bloque 3 (reverso + cierre de mes; cierre de ejercicio y apertura si alcanza).
4. Bloque 5 (columnas SENIAT en libros existentes).
5. Bloque 4 (exportaciones TXT/XML — al menos libro ventas, compras y retenciones).
6. Bloque 6 solo si queda margen.

¿Confirmas este alcance y orden, o prefieres que empiece por otro bloque?