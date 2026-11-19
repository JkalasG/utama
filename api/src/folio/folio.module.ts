import { Module } from '@nestjs/common';
import { FolioController } from './folio.controller.js';
import { FolioService } from './folio.service.js';

@Module({
  controllers: [FolioController],
  providers: [FolioService],
  exports: [FolioService],
})
export class FolioModule {}
