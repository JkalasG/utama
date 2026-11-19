import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ESTADOS_VIGENTES, hashFolio, normalizarFolio } from '../common/util.js';
import type { VerificarFolioDto } from './dto.js';

/**
 * VERIFICACIÓN SIMULADA.
 * No lee ningún documento: devuelve un resultado predefinido según el escenario elegido.
 * Lo único real es el hash SHA-256 del número de folio, que es el que se manda al contrato.
 * Para pasar a IA real, solo hay que reemplazar el cuerpo de `verificar`.
 */
export const ESCENARIOS = {
  LIMPIO: {
    etiqueta: 'Folio limpio (sin gravámenes)',
    gravamenes: [] as string[],
    coincide: true,
  },
  HIPOTECA: {
    etiqueta: 'Folio con hipoteca inscrita',
    gravamenes: ['Hipoteca inscrita a favor de una entidad financiera'],
    coincide: true,
  },
  ANTICRETICO_INSCRITO: {
    etiqueta: 'Folio con anticrético ya inscrito',
    gravamenes: ['Anticrético inscrito a favor de un tercero'],
    coincide: true,
  },
  TITULAR_DISTINTO: {
    etiqueta: 'Titular distinto al documento de identidad',
    gravamenes: [] as string[],
    coincide: false,
  },
} as const;

export type EscenarioFolio = keyof typeof ESCENARIOS;

@Injectable()
export class FolioService {
  constructor(private readonly prisma: PrismaService) {}

  escenarios() {
    return Object.entries(ESCENARIOS).map(([clave, e]) => ({ clave, etiqueta: e.etiqueta }));
  }

  async verificar(d: VerificarFolioDto) {
    const normalizado = normalizarFolio(d.folioNumero ?? '');
    if (normalizado.length < 5) {
      throw new BadRequestException('Ingresa un número de folio válido');
    }
    const clave = (d.escenario ?? 'LIMPIO') as EscenarioFolio;
    const escenario = ESCENARIOS[clave];
    if (!escenario) throw new BadRequestException('Escenario de folio desconocido');

    // Simula el tiempo de lectura del documento.
    await new Promise((r) => setTimeout(r, 1200));

    const tieneGravamen = escenario.gravamenes.length > 0;
    const verificado = escenario.coincide && !tieneGravamen;
    let motivo = 'Titular coincide con el documento de identidad y el folio no tiene gravámenes.';
    if (!escenario.coincide) motivo = 'El titular del folio no coincide con el documento de identidad del dueño.';
    else if (tieneGravamen) motivo = `Inmueble rechazado: ${escenario.gravamenes[0].toLowerCase()}.`;

    return {
      simulado: true,
      verificado,
      escenario: clave,
      etiqueta: escenario.etiqueta,
      titular: 'Titular según folio (simulado)',
      coincideConCI: escenario.coincide,
      gravamenes: escenario.gravamenes,
      motivo,
      folioNormalizado: normalizado,
      folioHash: hashFolio(d.folioNumero),
      verificadoEn: new Date().toISOString(),
    };
  }

  async estado(hash: string) {
    const c = await this.prisma.contrato.findFirst({
      where: { folioHash: hash, estado: { in: ESTADOS_VIGENTES } },
      select: { id: true, vencimiento: true, estado: true },
    });
    return {
      folioHash: hash,
      ocupado: !!c,
      contratoId: c?.id ?? null,
      vencimiento: c?.vencimiento ?? null,
      estado: c?.estado ?? null,
    };
  }
}
