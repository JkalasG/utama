import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CrearUsuarioDto, VerificarIdentidadDto } from './dto.js';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.usuario.findMany({ orderBy: { nombre: 'asc' } });
  }

  async obtener(id: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return u;
  }

  /** Registro de un usuario nuevo. Queda sin identidad verificada hasta completar la verificación. */
  async crear(d: CrearUsuarioDto) {
    if (!d.nombre?.trim()) throw new BadRequestException('El nombre es obligatorio');
    try {
      return await this.prisma.usuario.create({
        data: {
          nombre: d.nombre.trim(),
          email: d.email || null,
          wallet: d.wallet || null,
          rol: d.rol ?? 'AMBOS',
          paisResidencia: d.paisResidencia ?? 'BO',
          identidadVerificada: false,
        },
      });
    } catch {
      throw new ConflictException('Ya existe un usuario con ese correo o esa wallet');
    }
  }

  /**
   * Verificación de identidad SIMULADA: foto del CI o pasaporte y una selfie.
   * En producción pasaría por la verificación mixta (IA + revisión humana).
   */
  async verificarIdentidad(id: string, d: VerificarIdentidadDto) {
    await this.obtener(id);
    if (!d.ciDocUrl || !d.selfieUrl) throw new BadRequestException('Sube la foto de tu documento y una selfie');
    return this.prisma.usuario.update({
      where: { id },
      data: { ciDocUrl: d.ciDocUrl, selfieUrl: d.selfieUrl, identidadVerificada: true },
    });
  }

  async asignarWallet(id: string, wallet: string) {
    if (!wallet) throw new BadRequestException('Falta la wallet');
    await this.obtener(id);
    try {
      return await this.prisma.usuario.update({ where: { id }, data: { wallet } });
    } catch {
      throw new ConflictException('Esa wallet ya está asociada a otro usuario');
    }
  }
}
