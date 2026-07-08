Sistema contable web multi-empresa para cumplir con las normativas del SENIAT (Venezuela), con autenticación y control de acceso por perfiles.

## Alcance de la primera versión

**Módulos**
- Libro de Ventas (IVA) — registro cronológico de facturas emitidas, con base imponible, IVA 16%, exento, y totales mensuales.
- Libro de Compras (IVA) — registro de facturas recibidas con crédito fiscal, retenciones aplicadas.
- Retenciones IVA e ISLR — generación de comprobantes numerados y reporte mensual.
- Facturación electrónica — emisión con número de control SENIAT, cálculo automático de IVA y retenciones.

**Multi-empresa**
- Cada usuario puede pertenecer a varias empresas (RIF distintos).
- Selector de empresa activa en la barra superior; todos los datos se filtran por la empresa seleccionada.

**Perfiles de usuario y permisos**
- Administrador: gestión total, usuarios, empresas y configuración.
- Contador: registro y edición de operaciones contables, cierres mensuales.
- Auditor: solo lectura de libros, reportes y comprobantes.
- Operador/Cajero: solo emisión de facturas y consulta de sus propias operaciones.

## Diseño

Dirección "Corporativo azul" — paleta profesional (#0A2540 fondo profundo, #1E40AF acento, #F8FAFC superficies claras, #F59E0B destaques). Tipografía sans-serif institucional (Inter). Layout de dashboard con sidebar navegable, tarjetas KPI arriba (ventas del mes, IVA débito, IVA crédito, retenciones pendientes) y tablas densas tipo libro contable.

## Detalles técnicos

- **Backend:** Lovable Cloud (base de datos Postgres + Auth).
- **Auth:** email/contraseña. Tabla `profiles` con datos del usuario, tabla `user_roles` separada con enum `app_role` (`admin | contador | auditor | operador`) y función `has_role()` security-definer.
- **Tablas principales:**
  - `companies` (RIF, razón social, dirección fiscal, régimen)
  - `company_members` (user_id, company_id, rol por empresa)
  - `customers` y `suppliers` (RIF/cédula, tipo de contribuyente)
  - `sales_invoices` (número de control, fecha, base, IVA, exento, total)
  - `purchase_invoices` (proveedor, número factura, número control, base, IVA)
  - `withholdings` (tipo IVA/ISLR, número comprobante, monto, factura relacionada)
- **RLS:** cada tabla filtra por `company_id` y verifica membresía del usuario mediante función security-definer. Auditores solo SELECT; operadores restringidos a facturación.
- **Rutas protegidas:** `/app/*` bajo `_authenticated`, con guardas por rol en cliente y validación server-side vía `requireSupabaseAuth`.
- **Reportes:** exportación CSV de libros de ventas y compras por período.

## Entrega en esta iteración

1. Activar Lovable Cloud, crear esquema completo + RLS + roles.
2. Auth (login/registro) + selector de empresa.
3. Dashboard con KPIs.
4. CRUD de clientes, proveedores, facturas de venta y compra.
5. Registro de retenciones y vista de libros mensuales con totales SENIAT.
6. Gestión de usuarios y empresas (solo admin).

¿Procedo con esta implementación?
