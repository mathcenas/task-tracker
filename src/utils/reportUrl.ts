import type { Client } from '../types';

/** Link del reporte mensual público. Lleva el token del cliente: el slug solo no alcanza. */
export function clientReportUrl(client: Pick<Client, 'slug' | 'reportToken'>, year: number, month: number): string {
  const base = `${window.location.origin}/report/${client.slug}/${year}/${month}`;
  return client.reportToken ? `${base}?k=${encodeURIComponent(client.reportToken)}` : base;
}
