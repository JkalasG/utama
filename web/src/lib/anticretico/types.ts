import type { Contrato, Inmueble, Usuario } from '../types';

/**
 * Contrato entre el frontend y la "cadena".
 * Hay dos implementaciones intercambiables (se elige con NEXT_PUBLIC_MODE):
 *   - mock.ts    → el backend simula el contrato inteligente.
 *   - stellar.ts → se llama al contrato Soroban real en testnet.
 * Las pantallas solo usan esta interfaz, así que pasar de mock a testnet no las toca.
 */
export interface CrearAnticreticoParams {
  inmueble: Inmueble; // incluye folioHash y dueno (con wallet)
  inquilino: Usuario; // incluye wallet
  montoUsdc: number;
  plazoMeses: number;
  garantiaPct: number;
  /** USDC desde la wallet, o Bs convertidos por un anchor (simulado). */
  metodoPago?: 'USDC' | 'BOB';
}

export interface AnticreticoService {
  modo: 'mock' | 'testnet';
  /** Crea el anticrético: cobra, reparte dueño/garantía y bloquea el folio. Debe fallar si el folio ya está ocupado. */
  crearAnticretico(p: CrearAnticreticoParams): Promise<Contrato>;
  aportarDevolucion(contrato: Contrato, montoUsdc: number): Promise<Contrato>;
  iniciarCheckout(contrato: Contrato): Promise<Contrato>;
  reclamarDanos(contrato: Contrato, montoUsdc: number, motivo?: string): Promise<Contrato>;
  aprobarCheckout(contrato: Contrato): Promise<Contrato>;
}
