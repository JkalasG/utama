import { Controller, Get, Post } from '@nestjs/common';
import { GARANTIA_RECOMENDADA_PCT, PENALIDAD_SALIDA_PCT, REGLAS } from '../common/reglas.js';
import { tipoCambioBob } from '../contratos/contratos.service.js';
import { DemoService } from './demo.service.js';

@Controller()
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Get('health')
  health() {
    return { ok: true, hora: new Date().toISOString() };
  }

  /** Reglas por categoría y plantilla (M4), para mostrarlas igual en publicar y en la ficha. */
  @Get('reglas')
  reglas() {
    return { categorias: REGLAS, penalidadSalidaPct: PENALIDAD_SALIDA_PCT, garantiaRecomendadaPct: GARANTIA_RECOMENDADA_PCT };
  }

  /** Datos de configuración que usa la interfaz (por ejemplo, el tipo de cambio simulado). */
  @Get('config')
  config() {
    return { tipoCambioBob: tipoCambioBob(), comisionPlataformaPct: 0.5 };
  }

  @Post('demo/reset')
  reset() {
    return this.demo.reset();
  }
}
