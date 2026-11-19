import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { FolioModule } from './folio/folio.module.js';
import { InmueblesModule } from './inmuebles/inmuebles.module.js';
import { VisitasModule } from './visitas/visitas.module.js';
import { OfertasModule } from './ofertas/ofertas.module.js';
import { ContratosModule } from './contratos/contratos.module.js';
import { InventarioModule } from './inventario/inventario.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { DemoModule } from './demo/demo.module.js';
import { ReputacionModule } from './reputacion/reputacion.module.js';
import { NotificacionesModule } from './notificaciones/notificaciones.module.js';

@Module({
  imports: [
    PrismaModule,
    UsuariosModule,
    FolioModule,
    InmueblesModule,
    VisitasModule,
    OfertasModule,
    ContratosModule,
    InventarioModule,
    UploadsModule,
    DemoModule,
    ReputacionModule,
    NotificacionesModule,
  ],
})
export class AppModule {}
