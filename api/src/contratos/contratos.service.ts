import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ESTADOS_VIGENTES, redondear, sumarMeses, txFalso } from '../common/util.js';
import { PENALIDAD_SALIDA_PCT, type Plantilla } from '../common/reglas.js';
import type {
  AporteDto,
  CrearContratoDto,
  DdrrDto,
  DisputaDto,
  ProponerRenovacionDto,
  ReclamoDto,
  ResolverDisputaDto,
  SalidaAnticipadaDto,
  TxDto,
} from './dto.js';

/** Tipo de cambio de referencia Bs por USDC (simulado). Se puede cambiar con la variable TIPO_CAMBIO_BOB. */
export const tipoCambioBob = () => Number(process.env.TIPO_CAMBIO_BOB ?? 9.3);

/**
 * Espejo en base de datos del contrato inteligente.
 *  - modo "mock": este servicio hace de contrato (aplica las mismas reglas y genera un txHash falso).
 *  - modo "testnet": el frontend ya ejecutó la transacción en Soroban y aquí solo se registra el resultado
 *    (onchainId y txHash) para que las pantallas puedan mostrarlo.
 */
@Injectable()
export class ContratosService {
  constructor(private readonly prisma: PrismaService) {}

  private vista(c: any) {
    const retenido = redondear(c.garantiaUsdc + c.devueltoUsdc);
    return {
      ...c,
      retenidoUsdc: retenido,
      pendienteUsdc: redondear(Math.max(0, c.montoUsdc - retenido)),
      progresoPct: c.montoUsdc > 0 ? Math.min(100, Math.round((retenido / c.montoUsdc) * 100)) : 0,
    };
  }

  private async cargar(id: string) {
    const c = await this.prisma.contrato.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Contrato no encontrado');
    return c;
  }

  private tx(c: { modo: string }, d: TxDto) {
    return d.txHash ?? (c.modo === 'mock' ? txFalso() : null);
  }

  async crear(d: CrearContratoDto) {
    const inmueble = await this.prisma.inmueble.findUnique({ where: { id: d.inmuebleId } });
    if (!inmueble) throw new NotFoundException('Inmueble no encontrado');
    if (inmueble.duenoId === d.inquilinoId) throw new BadRequestException('El dueño no puede tomar su propio inmueble');
    const inquilino = await this.prisma.usuario.findUnique({ where: { id: d.inquilinoId } });
    if (!inquilino) throw new NotFoundException('Inquilino no encontrado');
    if (!inquilino.identidadVerificada) throw new BadRequestException('Debes verificar tu identidad');

    const monto = d.montoUsdc ?? inmueble.montoUsdc;
    const plazo = d.plazoMeses ?? inmueble.plazoMeses;
    const pct = d.garantiaPct ?? inmueble.garantiaPct;
    if (!(monto > 0) || !(plazo > 0) || pct < 0 || pct > 100) throw new BadRequestException('Parámetros inválidos');

    const modo = d.modo ?? 'mock';
    const garantia = redondear((monto * pct) / 100);
    const alDueno = redondear(monto - garantia);
    const txHash = d.txHash ?? (modo === 'mock' ? txFalso() : null);
    const metodoPago = d.metodoPago === 'BOB' ? 'BOB' : 'USDC';
    const tipoCambio = metodoPago === 'BOB' ? tipoCambioBob() : null;
    const montoBs = tipoCambio ? redondear(monto * tipoCambio) : null;
    const ahora = new Date();

    const creado = await this.prisma.$transaction(
      async (tx) => {
        const ocupado = await tx.contrato.findFirst({
          where: { folioHash: inmueble.folioHash, estado: { in: ESTADOS_VIGENTES } },
        });
        // Misma regla que el contrato Soroban: un folio no puede tener dos contratos vigentes.
        if (ocupado) throw new ConflictException('Este inmueble ya tiene un anticrético activo.');

        const c = await tx.contrato.create({
          data: {
            inmuebleId: inmueble.id,
            duenoId: inmueble.duenoId,
            inquilinoId: d.inquilinoId,
            montoUsdc: monto,
            montoDuenoUsdc: alDueno,
            garantiaUsdc: garantia,
            folioHash: inmueble.folioHash,
            plazoMeses: plazo,
            inicio: ahora,
            vencimiento: sumarMeses(ahora, plazo),
            modo,
            onchainId: d.onchainId,
            txHash,
            metodoPago,
            tipoCambio,
            montoBs,
          },
        });
        await tx.inmueble.update({ where: { id: inmueble.id }, data: { estado: 'EN_ANTICRETICO' } });
        await tx.evento.create({
          data: {
            contratoId: c.id,
            tipo: 'CREADO',
            detalle:
              metodoPago === 'BOB'
                ? `Pago de ${montoBs} Bs (convertidos a ${monto} USDC, simulado): ${alDueno} al dueño, ${garantia} al fondo de garantía. Folio bloqueado.`
                : `Pago de ${monto} USDC: ${alDueno} al dueño, ${garantia} al fondo de garantía. Folio bloqueado.`,
            txHash,
          },
        });
        return c;
      },
      { isolationLevel: 'Serializable' },
    );
    return this.obtener(creado.id);
  }

  async obtener(id: string) {
    const c = await this.prisma.contrato.findUnique({
      where: { id },
      include: {
        inmueble: { select: { id: true, titulo: true, zona: true, ciudad: true, tipo: true, plantillaReglas: true } },
        dueno: { select: { id: true, nombre: true, nivel: true, wallet: true } },
        inquilino: { select: { id: true, nombre: true, nivel: true, wallet: true } },
        eventos: { orderBy: { creadoEn: 'asc' } },
        inventarios: true,
        calificaciones: true,
      },
    });
    if (!c) throw new NotFoundException('Contrato no encontrado');
    return this.vista(c);
  }

  async listar(f: { usuarioId?: string; inmuebleId?: string }) {
    const where: any = {};
    if (f.inmuebleId) where.inmuebleId = f.inmuebleId;
    if (f.usuarioId) where.OR = [{ duenoId: f.usuarioId }, { inquilinoId: f.usuarioId }];
    const filas = await this.prisma.contrato.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      include: {
        inmueble: { select: { id: true, titulo: true, zona: true, ciudad: true, tipo: true } },
        dueno: { select: { id: true, nombre: true } },
        inquilino: { select: { id: true, nombre: true } },
      },
    });
    return filas.map((c) => this.vista(c));
  }

  async aportar(id: string, d: AporteDto) {
    const c = await this.cargar(id);
    if (c.estado !== 'ACTIVO') throw new BadRequestException('Solo se puede aportar a un contrato activo');
    if (!(d.montoUsdc > 0)) throw new BadRequestException('El aporte debe ser mayor a 0');
    const restante = c.montoUsdc - c.garantiaUsdc - c.devueltoUsdc;
    if (d.montoUsdc > restante + 0.001) throw new BadRequestException(`El aporte excede lo que falta (${redondear(restante)} USDC)`);
    const txHash = this.tx(c, d);
    await this.prisma.$transaction([
      this.prisma.contrato.update({ where: { id }, data: { devueltoUsdc: redondear(c.devueltoUsdc + d.montoUsdc) } }),
      this.prisma.evento.create({
        data: { contratoId: id, tipo: 'APORTE', detalle: `Aporte al plan de devolución: ${d.montoUsdc} USDC`, txHash },
      }),
    ]);
    return this.obtener(id);
  }

  async iniciarCheckout(id: string, d: TxDto) {
    const c = await this.cargar(id);
    if (c.estado !== 'ACTIVO') throw new BadRequestException('El contrato no está activo');
    const txHash = this.tx(c, d);
    await this.prisma.$transaction([
      this.prisma.contrato.update({ where: { id }, data: { estado: 'EN_CHECKOUT' } }),
      this.prisma.evento.create({ data: { contratoId: id, tipo: 'CHECKOUT_INICIADO', detalle: 'Se abrió el check-out', txHash } }),
    ]);
    return this.obtener(id);
  }

  async reclamarDanos(id: string, d: ReclamoDto) {
    const c = await this.cargar(id);
    if (c.estado !== 'EN_CHECKOUT') throw new BadRequestException('Solo se reclaman daños durante el check-out');
    if (!(d.montoUsdc > 0) || d.montoUsdc > c.garantiaUsdc) {
      throw new BadRequestException(`El reclamo debe ser mayor a 0 y no superar la garantía (${c.garantiaUsdc} USDC)`);
    }
    const txHash = this.tx(c, d);
    await this.prisma.$transaction([
      this.prisma.contrato.update({ where: { id }, data: { garantiaUsdc: redondear(c.garantiaUsdc - d.montoUsdc) } }),
      this.prisma.evento.create({
        data: { contratoId: id, tipo: 'DANOS', detalle: `Descuento de ${d.montoUsdc} USDC de la garantía${d.motivo ? `: ${d.motivo}` : ''}`, txHash },
      }),
    ]);
    return this.obtener(id);
  }

  async aprobarCheckout(id: string, d: TxDto) {
    const c = await this.cargar(id);
    if (c.estado !== 'EN_CHECKOUT') throw new BadRequestException('El contrato no está en check-out');
    const devuelto = redondear(c.garantiaUsdc + c.devueltoUsdc);
    const txHash = this.tx(c, d);
    await this.prisma.$transaction([
      this.prisma.contrato.update({ where: { id }, data: { estado: 'FINALIZADO' } }),
      // Al finalizar el contrato se libera el folio y el inmueble vuelve a estar disponible.
      this.prisma.inmueble.update({ where: { id: c.inmuebleId }, data: { estado: 'PUBLICADO' } }),
      this.prisma.evento.create({
        data: {
          contratoId: id,
          tipo: 'FINALIZADO',
          detalle: `Check-out conforme. Se devuelven ${devuelto} USDC al inquilino y se libera el folio.`,
          txHash,
        },
      }),
    ]);
    return { ...(await this.obtener(id)), devueltoAlInquilinoUsdc: devuelto };
  }

  // ---------- Funciones adicionales del contrato (M8) ----------

  /** abrir_disputa: si no hay acuerdo en el check-out (o durante el contrato), pasa a disputa. */
  async abrirDisputa(id: string, d: DisputaDto) {
    const c = await this.cargar(id);
    if (c.estado !== 'ACTIVO' && c.estado !== 'EN_CHECKOUT') {
      throw new BadRequestException('No se puede abrir una disputa en este estado');
    }
    if (!d.motivo?.trim()) throw new BadRequestException('Cuenta brevemente el motivo de la disputa');
    const txHash = this.tx(c, d);
    await this.prisma.$transaction([
      this.prisma.contrato.update({ where: { id }, data: { estado: 'EN_DISPUTA', disputaMotivo: d.motivo.trim() } }),
      this.prisma.evento.create({
        data: { contratoId: id, tipo: 'DISPUTA', detalle: `Disputa abierta: ${d.motivo.trim()}`, txHash },
      }),
    ]);
    return this.obtener(id);
  }

  /** Resolución por el mediador de la plataforma (propuesto). Aplica un descuento opcional y vuelve al check-out. */
  async resolverDisputa(id: string, d: ResolverDisputaDto) {
    const c = await this.cargar(id);
    if (c.estado !== 'EN_DISPUTA') throw new BadRequestException('El contrato no está en disputa');
    const descuento = d.descuentoUsdc ?? 0;
    if (descuento < 0 || descuento > c.garantiaUsdc) {
      throw new BadRequestException(`El descuento no puede superar la garantía (${c.garantiaUsdc} USDC)`);
    }
    const detalle = descuento ? ` con un descuento de ${descuento} USDC de la garantía` : ' sin descuento';
    await this.prisma.$transaction([
      this.prisma.contrato.update({
        where: { id },
        data: { estado: 'EN_CHECKOUT', disputaMotivo: null, garantiaUsdc: redondear(c.garantiaUsdc - descuento) },
      }),
      this.prisma.evento.create({
        data: {
          contratoId: id,
          tipo: 'DISPUTA_RESUELTA',
          detalle: `El mediador resolvió la disputa${detalle}${d.nota ? `: ${d.nota}` : ''}.`,
        },
      }),
    ]);
    return this.obtener(id);
  }

  /** salida_anticipada: aplica la penalidad de la plantilla de reglas y abre el check-out. */
  async salidaAnticipada(id: string, d: SalidaAnticipadaDto) {
    const c = await this.cargar(id);
    if (c.estado !== 'ACTIVO') throw new BadRequestException('Solo se puede salir de forma anticipada de un contrato activo');
    const inmueble = await this.prisma.inmueble.findUnique({ where: { id: c.inmuebleId } });
    const plantilla = (inmueble?.plantillaReglas ?? 'MODERADA') as Plantilla;
    const pct = PENALIDAD_SALIDA_PCT[plantilla];
    const penalidad = d.solicitadaPor === 'INQUILINO' ? Math.min(c.garantiaUsdc, redondear((c.montoUsdc * pct) / 100)) : 0;
    const txHash = this.tx(c, d);
    const quien = d.solicitadaPor === 'INQUILINO' ? 'el inquilino' : 'el dueño';
    const detalle = penalidad
      ? `Salida anticipada pedida por ${quien}. Penalidad pactada (${plantilla.toLowerCase()}, ${pct} %): ${penalidad} USDC, descontados de la garantía.`
      : `Salida anticipada pedida por ${quien}. Sin penalidad según las reglas pactadas.`;
    await this.prisma.$transaction([
      this.prisma.contrato.update({
        where: { id },
        data: {
          estado: 'EN_CHECKOUT',
          salidaAnticipada: true,
          penalidadUsdc: penalidad,
          garantiaUsdc: redondear(c.garantiaUsdc - penalidad),
        },
      }),
      this.prisma.evento.create({ data: { contratoId: id, tipo: 'SALIDA_ANTICIPADA', detalle, txHash } }),
    ]);
    return this.obtener(id);
  }

  /** renovar (paso 1): una parte propone nuevas condiciones. */
  async proponerRenovacion(id: string, d: ProponerRenovacionDto) {
    const c = await this.cargar(id);
    if (c.estado !== 'ACTIVO') throw new BadRequestException('Solo se renueva un contrato activo');
    if (!(d.plazoMeses > 0) || d.plazoMeses > 36) throw new BadRequestException('El plazo debe estar entre 1 y 36 meses');
    const porDueno = d.propuestoPor === 'DUENO';
    await this.prisma.$transaction([
      this.prisma.contrato.update({
        where: { id },
        data: {
          renovacion: {
            plazoMeses: d.plazoMeses,
            nota: d.nota ?? null,
            propuestoPor: d.propuestoPor,
            aceptaDueno: porDueno,
            aceptaInquilino: !porDueno,
          },
        },
      }),
      this.prisma.evento.create({
        data: {
          contratoId: id,
          tipo: 'RENOVACION_PROPUESTA',
          detalle: `${porDueno ? 'El dueño' : 'El inquilino'} propone renovar por ${d.plazoMeses} meses${d.nota ? `: ${d.nota}` : ''}.`,
        },
      }),
    ]);
    return this.obtener(id);
  }

  /** renovar (paso 2): cuando ambas partes aceptan, el contrato continúa sin devolver y volver a depositar. */
  async aceptarRenovacion(id: string, rol: string, d: TxDto) {
    const c = await this.cargar(id);
    const r = c.renovacion as {
      plazoMeses: number;
      nota: string | null;
      propuestoPor: string;
      aceptaDueno: boolean;
      aceptaInquilino: boolean;
    } | null;
    if (!r) throw new BadRequestException('No hay una propuesta de renovación');
    if (rol !== 'DUENO' && rol !== 'INQUILINO') throw new BadRequestException('El rol debe ser DUENO o INQUILINO');
    const acuerdo = {
      ...r,
      aceptaDueno: r.aceptaDueno || rol === 'DUENO',
      aceptaInquilino: r.aceptaInquilino || rol === 'INQUILINO',
    };
    if (!(acuerdo.aceptaDueno && acuerdo.aceptaInquilino)) {
      await this.prisma.contrato.update({ where: { id }, data: { renovacion: acuerdo } });
      return this.obtener(id);
    }
    const txHash = this.tx(c, d);
    await this.prisma.$transaction([
      this.prisma.contrato.update({
        where: { id },
        data: {
          vencimiento: sumarMeses(c.vencimiento, r.plazoMeses),
          plazoMeses: c.plazoMeses + r.plazoMeses,
          renovaciones: c.renovaciones + 1,
          renovacion: Prisma.DbNull,
        },
      }),
      this.prisma.evento.create({
        data: {
          contratoId: id,
          tipo: 'RENOVADO',
          detalle: `Ambas partes aceptaron. El contrato continúa ${r.plazoMeses} meses más, sin devolver ni volver a depositar.`,
          txHash,
        },
      }),
    ]);
    return this.obtener(id);
  }

  /** Comprobante opcional de inscripción en Derechos Reales (M12): otorga la insignia al inmueble. */
  async registrarDdrr(id: string, d: DdrrDto) {
    const c = await this.cargar(id);
    if (!d.url) throw new BadRequestException('Sube el folio actualizado donde figura el anticrético');
    await this.prisma.$transaction([
      this.prisma.contrato.update({ where: { id }, data: { ddrrUrl: d.url } }),
      this.prisma.inmueble.update({ where: { id: c.inmuebleId }, data: { inscritoDDRR: true } }),
      this.prisma.evento.create({
        data: { contratoId: id, tipo: 'DDRR', detalle: 'Se cargó el folio actualizado: insignia «Inscrito en DD.RR.».' },
      }),
    ]);
    return this.obtener(id);
  }
}
