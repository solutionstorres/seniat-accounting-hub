export const COLORS = {
  bg: "#07182E",
  bgAlt: "#0E2A4D",
  primary: "#1D6FE0",
  accent: "#F2B12B",
  text: "#F3F7FF",
  muted: "#9FB6D4",
};

export type Section = {
  shot: string;
  chapter: string;
  title: string;
  desc: string;
};

export const SECTIONS: Section[] = [
  { shot: "Panel", chapter: "01", title: "Panel de control", desc: "Indicadores de ventas, compras, IVA y saldos del ejercicio en curso." },
  { shot: "Empresas", chapter: "02", title: "Empresas", desc: "Alta de empresas con RIF, ejercicio fiscal, nivel de plan de cuentas y condición de agente de retención." },
  { shot: "Equipo", chapter: "03", title: "Usuarios y perfiles", desc: "Acceso por roles: administrador, contador, auditor y operador." },
  { shot: "Clientes", chapter: "04", title: "Clientes", desc: "Maestro de clientes con RIF, contribuyente especial y datos fiscales." },
  { shot: "Proveedores", chapter: "05", title: "Proveedores", desc: "Expediente completo del tercero con cuentas contables asociadas." },
  { shot: "Facturacion", chapter: "06", title: "Facturación", desc: "Facturas, notas de crédito y débito con número de control SENIAT." },
  { shot: "Compras", chapter: "07", title: "Compras", desc: "Registro de compras con alícuotas 16%, 8%, 31% y montos exentos." },
  { shot: "Retenciones", chapter: "08", title: "Retenciones", desc: "Comprobantes de retención de IVA e ISLR con correlativo automático." },
  { shot: "CxP", chapter: "09", title: "Cuentas por pagar", desc: "Abonos multimoneda, IGTF 3% en divisas y retenciones al pagar." },
  { shot: "CxC", chapter: "10", title: "Cuentas por cobrar", desc: "Cobros parciales o totales con tasa editable y cuenta contable por abono." },
  { shot: "LibroVentas", chapter: "11", title: "Libro de ventas", desc: "Libro conforme a la Providencia SNAT, exportable a TXT y CSV." },
  { shot: "LibroCompras", chapter: "12", title: "Libro de compras", desc: "Crédito fiscal detallado por proveedor y período impositivo." },
  { shot: "PlanCuentas", chapter: "13", title: "Plan de cuentas", desc: "Árbol jerárquico validado por nivel; doble clic muestra los movimientos." },
  { shot: "CentrosCosto", chapter: "14", title: "Centros de costo", desc: "Estructura de centros enlazada a asientos, facturas e informes." },
  { shot: "Asientos", chapter: "15", title: "Asientos contables", desc: "Registro manual con máscara de montos, validación de cuadre y reverso." },
  { shot: "Informes", chapter: "16", title: "Informes contables", desc: "Centro de reportes exigidos por la normativa fiscal venezolana." },
  { shot: "Diario", chapter: "17", title: "Libro diario", desc: "Todos los comprobantes en orden cronológico con filtro por fechas." },
  { shot: "Mayor", chapter: "18", title: "Libro mayor", desc: "Movimientos y saldo acumulado cuenta por cuenta." },
  { shot: "Comprobacion", chapter: "19", title: "Balance de comprobación", desc: "Sumas y saldos con verificación automática del cuadre." },
  { shot: "BalanceGeneral", chapter: "20", title: "Balance general", desc: "Activo, pasivo y patrimonio a la fecha de corte." },
  { shot: "EstadoResultados", chapter: "21", title: "Estado de resultados", desc: "Ingresos, costos, gastos y utilidad del ejercicio." },
  { shot: "DeclaracionIVA", chapter: "22", title: "Declaración de IVA", desc: "Débito, crédito fiscal y retenciones del período impositivo." },
  { shot: "Cierres", chapter: "23", title: "Cierres y aperturas", desc: "Cierre de mes, cierre de ejercicio y apertura con asiento automático." },
  { shot: "Ayuda", chapter: "24", title: "Ayuda", desc: "Manual del sistema en PDF y este video tutorial siempre a la mano." },
];
