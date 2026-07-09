# Módulo contable completo (SENIAT Venezuela)

Amplía el sistema actual con contabilidad de partida doble, integrada con los módulos de facturación y retenciones ya existentes.

## 1. Plan de cuentas jerárquico

**Tabla `chart_accounts`** por empresa:
- `code` (ej. `1.1.01.001`), `name`, `parent_id` (autoreferencia), `level`, `account_type` (activo, pasivo, patrimonio, ingreso, egreso, orden), `nature` (deudora/acreedora), `is_postable` (si acepta asientos), `active`.
- Índices en `(company_id, code)` único y `(company_id, parent_id)`.
- RLS por membresía de empresa; escritura solo admin/contador.

**Vista `/plan-cuentas`:**
- Árbol jerárquico expandible (usando componente recursivo). Botón "Nueva cuenta" en cada nodo para crear hija con código auto-sugerido.
- Al crear empresa por primera vez, botón "Cargar plan estándar SENIAT" que siembra un plan base venezolano (1 Activo, 2 Pasivo, 3 Patrimonio, 4 Ingresos, 5 Costos, 6 Gastos, con sub-cuentas típicas: bancos, IVA débito/crédito fiscal, retenciones IVA/ISLR por pagar y por cobrar, ventas gravadas/exentas, compras, etc.).
- Solo cuentas `is_postable = true` (hojas) pueden recibir asientos.

## 2. Asientos contables (partida doble)

**Tablas:**
- `journal_entries`: `company_id`, `entry_number` (correlativo por empresa/año), `entry_date`, `description`, `source` (`manual | sales_invoice | purchase_invoice | withholding`), `source_id`, `status` (borrador/contabilizado/anulado), `created_by`.
- `journal_lines`: `entry_id`, `account_id`, `debit`, `credit`, `description`, `line_order`. Trigger valida que suma débito = suma crédito antes de contabilizar.

**Configuración contable por empresa** (`company_accounting_config`):
Mapeo de cuentas por defecto: cuenta de ventas gravadas, ventas exentas, IVA débito fiscal, cuentas por cobrar, compras/inventario, IVA crédito fiscal, cuentas por pagar, retención IVA por pagar/cobrar, retención ISLR por pagar/cobrar, caja/banco por defecto. Configurable en un formulario cuando la empresa se crea o desde ajustes.

## 3. Automatización desde facturación y retenciones

Al insertar una factura de **venta**, un trigger genera el asiento:
- Débito: Cuentas por cobrar (total)
- Crédito: Ventas gravadas (base), Ventas exentas (exento), IVA débito fiscal (IVA)

Al insertar una factura de **compra**:
- Débito: Compras/gastos (base), IVA crédito fiscal (IVA)
- Crédito: Cuentas por pagar (total)

Al registrar una **retención** (IVA o ISLR):
- Emitida (nosotros retenemos a proveedor): Débito CxP / Crédito Retención IVA/ISLR por pagar.
- Recibida (nos retienen): Débito Retención IVA/ISLR por cobrar / Crédito CxC.

Se implementa vía función Postgres `post_invoice_entry(invoice_id, kind)` y triggers `AFTER INSERT`. Si falta configuración, la factura se registra pero el asiento queda en estado `borrador` con mensaje.

## 4. Asientos manuales

Vista `/asientos`:
- Lista de asientos con filtros por fecha, origen y estado. Búsqueda por número y descripción.
- Botón "Nuevo asiento" → diálogo con cabecera (fecha, descripción) y grid dinámico de líneas (cuenta con autocomplete jerárquico, débito, crédito, descripción). Valida balance en vivo. Guarda como borrador o contabiliza.
- Ver detalle: líneas, origen enlazado a factura si aplica, botón anular (reversa creando contra-asiento).

## 5. Informes SENIAT

Nuevas rutas bajo `/informes`:

- **Libro Diario** — todos los asientos del período en orden cronológico.
- **Libro Mayor** — por cuenta, saldo inicial, movimientos débito/crédito, saldo final; filtro por rango de cuentas.
- **Balance de Comprobación** — todas las cuentas con saldos iniciales, movimientos y saldos finales; verifica sumas iguales.
- **Balance General** — activo, pasivo y patrimonio agrupado por rubros al corte de fecha.
- **Estado de Resultados** — ingresos, costos, gastos y utilidad del período.
- **Declaración IVA** — resumen mensual: débito fiscal, crédito fiscal, retenciones soportadas, IVA a pagar/excedente (los libros existentes ya cubren el detalle).
- **Comprobantes de Retención** — listado imprimible con formato SENIAT.

Todos exportables a CSV; el balance general y estado de resultados también imprimibles (vista tipo hoja).

## Detalles técnicos

- Migraciones nuevas: `chart_accounts`, `journal_entries`, `journal_lines`, `company_accounting_config`, función `seed_chart_of_accounts(company_id)`, `post_invoice_entry`, triggers en `sales_invoices`, `purchase_invoices`, `withholdings`. Toda tabla con GRANTs + RLS por membresía.
- Server functions para: sembrar plan estándar, calcular reportes agregados (mayor, balance de comprobación, balance general, estado de resultados) usando `requireSupabaseAuth`.
- Componente `AccountTreePicker` reutilizado en asientos manuales y configuración.
- Enlace en el sidebar: **Contabilidad** → Plan de cuentas, Asientos, Informes (submenú).
- Idioma: español, formato Bs con dos decimales.
- Rol Auditor: solo lectura en todo lo nuevo. Operador: sin acceso a contabilidad.

## Fuera de alcance de esta iteración

- Cierre y apertura de ejercicio automático (se hace manual vía asiento).
- Ajustes por inflación (INPC) — se deja preparado el campo pero sin cálculo.
- Formato XML para envío electrónico al portal SENIAT.

¿Procedo con esta implementación?
