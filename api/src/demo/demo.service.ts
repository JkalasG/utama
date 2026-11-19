import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { asegurarDisponibilidad, USUARIOS } from '../seed/seed.js';

@Injectable()
export class DemoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Deja la demo como al inicio: sin contratos, visitas ni ofertas, y con todos los inmuebles disponibles. */
  async reset() {
    await this.prisma.$transaction([
      this.prisma.contrato.deleteMany(), // eventos, inventarios y calificaciones se borran en cascada
      this.prisma.visita.deleteMany(),
      this.prisma.oferta.deleteMany(),
      this.prisma.inmueble.updateMany({ where: { estado: 'EN_ANTICRETICO' }, data: { estado: 'PUBLICADO' } }),
      this.prisma.inmueble.updateMany({ data: { inscritoDDRR: false } }),
      ...USUARIOS.map((u) => this.prisma.usuario.update({ where: { id: u.id }, data: { nivel: u.nivel } })),
    ]);
    await asegurarDisponibilidad(this.prisma);
    return { ok: true };
  }
}
