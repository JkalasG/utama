import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FolioService } from './folio.service.js';
import type { VerificarFolioDto } from './dto.js';

@Controller('folio')
export class FolioController {
  constructor(private readonly folio: FolioService) {}

  /** Lista de folios de ejemplo para el selector de la interfaz. */
  @Get('escenarios')
  escenarios() {
    return this.folio.escenarios();
  }

  @Post('verificar')
  verificar(@Body() body: VerificarFolioDto) {
    return this.folio.verificar(body);
  }

  /** ¿Hay un contrato vigente con este folio? (lectura del bloqueo en la base de datos) */
  @Get(':hash/estado')
  estado(@Param('hash') hash: string) {
    return this.folio.estado(hash);
  }
}
