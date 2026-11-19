import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ContratosService } from './contratos.service.js';
import { ReputacionService } from '../reputacion/reputacion.service.js';
import type { CalificarDto } from '../reputacion/reputacion.service.js';
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

@Controller('contratos')
export class ContratosController {
  constructor(
    private readonly contratos: ContratosService,
    private readonly reputacion: ReputacionService,
  ) {}

  @Post()
  crear(@Body() body: CrearContratoDto) {
    return this.contratos.crear(body);
  }

  @Get()
  listar(@Query('usuarioId') usuarioId?: string, @Query('inmuebleId') inmuebleId?: string) {
    return this.contratos.listar({ usuarioId, inmuebleId });
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.contratos.obtener(id);
  }

  @Post(':id/aportes')
  aportar(@Param('id') id: string, @Body() body: AporteDto) {
    return this.contratos.aportar(id, body);
  }

  @Post(':id/checkout/iniciar')
  iniciar(@Param('id') id: string, @Body() body: TxDto) {
    return this.contratos.iniciarCheckout(id, body ?? {});
  }

  @Post(':id/checkout/reclamar')
  reclamar(@Param('id') id: string, @Body() body: ReclamoDto) {
    return this.contratos.reclamarDanos(id, body);
  }

  @Post(':id/checkout/aprobar')
  aprobar(@Param('id') id: string, @Body() body: TxDto) {
    return this.contratos.aprobarCheckout(id, body ?? {});
  }

  @Post(':id/disputa')
  abrirDisputa(@Param('id') id: string, @Body() body: DisputaDto) {
    return this.contratos.abrirDisputa(id, body);
  }

  /** Resolución por el mediador de la plataforma (en la demo la puede ejecutar cualquiera). */
  @Post(':id/disputa/resolver')
  resolverDisputa(@Param('id') id: string, @Body() body: ResolverDisputaDto) {
    return this.contratos.resolverDisputa(id, body ?? {});
  }

  @Post(':id/salida-anticipada')
  salidaAnticipada(@Param('id') id: string, @Body() body: SalidaAnticipadaDto) {
    return this.contratos.salidaAnticipada(id, body);
  }

  @Post(':id/renovacion/proponer')
  proponerRenovacion(@Param('id') id: string, @Body() body: ProponerRenovacionDto) {
    return this.contratos.proponerRenovacion(id, body);
  }

  @Post(':id/renovacion/aceptar')
  aceptarRenovacion(@Param('id') id: string, @Body() body: { rol: string; txHash?: string }) {
    return this.contratos.aceptarRenovacion(id, body.rol, { txHash: body.txHash });
  }

  @Post(':id/ddrr')
  registrarDdrr(@Param('id') id: string, @Body() body: DdrrDto) {
    return this.contratos.registrarDdrr(id, body);
  }

  @Post(':id/calificaciones')
  calificar(@Param('id') id: string, @Body() body: CalificarDto) {
    return this.reputacion.calificar(id, body);
  }
}
