export interface VerificarFolioDto {
  folioNumero: string;
  ci?: string;
  escenario?: 'LIMPIO' | 'HIPOTECA' | 'ANTICRETICO_INSCRITO' | 'TITULAR_DISTINTO';
}
