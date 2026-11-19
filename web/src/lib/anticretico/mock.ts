import { api } from '../api';
import type { Contrato } from '../types';
import type { AnticreticoService } from './types';

/** Modo mock: el backend aplica las reglas del contrato (reparto, bloqueo del folio, liberación) y genera un txHash falso. */
export const mockService: AnticreticoService = {
  modo: 'mock',

  crearAnticretico: (p) =>
    api.post<Contrato>('/contratos', {
      inmuebleId: p.inmueble.id,
      inquilinoId: p.inquilino.id,
      montoUsdc: p.montoUsdc,
      plazoMeses: p.plazoMeses,
      garantiaPct: p.garantiaPct,
      metodoPago: p.metodoPago ?? 'USDC',
      modo: 'mock',
    }),

  aportarDevolucion: (c, montoUsdc) => api.post<Contrato>(`/contratos/${c.id}/aportes`, { montoUsdc }),
  iniciarCheckout: (c) => api.post<Contrato>(`/contratos/${c.id}/checkout/iniciar`, {}),
  reclamarDanos: (c, montoUsdc, motivo) => api.post<Contrato>(`/contratos/${c.id}/checkout/reclamar`, { montoUsdc, motivo }),
  aprobarCheckout: (c) => api.post<Contrato>(`/contratos/${c.id}/checkout/aprobar`, {}),
};
