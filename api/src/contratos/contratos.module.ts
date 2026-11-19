import { Module } from '@nestjs/common';
import { ReputacionModule } from '../reputacion/reputacion.module.js';
import { ContratosController } from './contratos.controller.js';
import { ContratosService } from './contratos.service.js';

@Module({
  imports: [ReputacionModule],
  controllers: [ContratosController],
  providers: [ContratosService],
  exports: [ContratosService],
})
export class ContratosModule {}
