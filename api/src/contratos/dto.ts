export interface CrearContratoDto {
  inmuebleId: string;
  inquilinoId: string;
  /** Si no se envía, se toman los valores de la publicación. */
  montoUsdc?: number;
  plazoMeses?: number;
  garantiaPct?: number;
  /** "mock": el backend simula la transacción. "testnet": el frontend ya ejecutó el contrato y reporta el resultado. */
  modo?: 'mock' | 'testnet';
  onchainId?: string;
  txHash?: string;
  /** Cómo paga el inquilino. Si es BOB, la conversión a USDC es simulada. */
  metodoPago?: 'USDC' | 'BOB';
}

export interface AporteDto {
  montoUsdc: number;
  txHash?: string;
}

export interface TxDto {
  txHash?: string;
}

export interface ReclamoDto {
  montoUsdc: number;
  motivo?: string;
  txHash?: string;
}

export interface DisputaDto {
  motivo: string;
  txHash?: string;
}

export interface ResolverDisputaDto {
  descuentoUsdc?: number;
  nota?: string;
}

export interface SalidaAnticipadaDto {
  solicitadaPor: 'INQUILINO' | 'DUENO';
  txHash?: string;
}

export interface ProponerRenovacionDto {
  plazoMeses: number;
  propuestoPor: 'INQUILINO' | 'DUENO';
  nota?: string;
}

export interface DdrrDto {
  url: string;
}
