export interface CrearUsuarioDto {
  nombre: string;
  email?: string;
  wallet?: string;
  rol?: 'INQUILINO' | 'DUENO' | 'AMBOS';
  paisResidencia?: string;
}

export interface VerificarIdentidadDto {
  ciDocUrl: string;
  selfieUrl: string;
}
