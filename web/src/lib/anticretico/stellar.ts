import type { AnticreticoService } from './types';

/**
 * Implementación REAL contra el contrato Soroban en testnet.   ← LA COMPLETAS TÚ
 *
 * Guía: PASOS-BLOCKCHAIN.md, pasos 6, 7 y 8.
 *
 * Cada método debe hacer DOS cosas, en este orden:
 *   1. Llamar al contrato con los bindings (src/contract-client), firmando con la wallet del usuario (Pollar / Freighter).
 *   2. Registrar el resultado en el backend para que las pantallas lo muestren, mandando "modo: 'testnet'",
 *      "onchainId" y "txHash". Ejemplo para crearAnticretico:
 *
 *        const { id, txHash } = await llamarContrato(...);           // 1. cadena
 *        return api.post<Contrato>('/contratos', {                   // 2. espejo en la BD
 *          inmuebleId: p.inmueble.id, inquilinoId: p.inquilino.id,
 *          montoUsdc: p.montoUsdc, plazoMeses: p.plazoMeses, garantiaPct: p.garantiaPct,
 *          modo: 'testnet', onchainId: String(id), txHash,
 *        });
 *
 * Datos que necesita el contrato (ya vienen en los parámetros):
 *   - folio_hash : p.inmueble.folioHash   → Buffer.from(hex, 'hex')  (BytesN<32>)
 *   - dueno      : p.inmueble.dueno.wallet
 *   - inquilino  : p.inquilino.wallet
 *   - monto      : p.montoUsdc × 10^7 (los activos de Stellar usan 7 decimales)
 *   - id on-chain para el resto de las funciones: contrato.onchainId
 *
 * Los demás métodos siguen el mismo patrón:
 *   aportarDevolucion → POST /contratos/:id/aportes            { montoUsdc, txHash }
 *   iniciarCheckout   → POST /contratos/:id/checkout/iniciar   { txHash }
 *   reclamarDanos     → POST /contratos/:id/checkout/reclamar  { montoUsdc, motivo, txHash }
 *   aprobarCheckout   → POST /contratos/:id/checkout/aprobar   { txHash }
 *
 * Importante: si el contrato rechaza (por ejemplo FolioOcupado), lanza un Error con el mensaje
 * "Este inmueble ya tiene un anticrético activo." para que la interfaz lo muestre igual que en modo mock.
 */
const pendiente = (): never => {
  throw new Error(
    'Modo testnet: falta implementar src/lib/anticretico/stellar.ts (ver PASOS-BLOCKCHAIN.md, paso 7). ' +
      'Mientras tanto usa NEXT_PUBLIC_MODE=mock.',
  );
};

export const stellarService: AnticreticoService = {
  modo: 'testnet',
  crearAnticretico: async () => pendiente(),
  aportarDevolucion: async () => pendiente(),
  iniciarCheckout: async () => pendiente(),
  reclamarDanos: async () => pendiente(),
  aprobarCheckout: async () => pendiente(),
};
