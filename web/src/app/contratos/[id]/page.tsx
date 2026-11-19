'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Bloque } from '@/components/Bloque';
import { Calificar, Disputa, GuiaDdrr, Renovacion, ResumenContrato, SalidaAnticipada } from '@/components/ContratoExtras';
import { Icono, IconoEvento } from '@/components/Iconos';
import { Chakana } from '@/components/Motivos';
import { PasosContrato } from '@/components/PasosContrato';
import { Pestanas } from '@/components/Pestanas';
import { Selector } from '@/components/Selector';
import { Barra, Cargando, EstadoContratoBadge, Insignia, Mensaje } from '@/components/ui';
import { anticretico } from '@/lib/anticretico';
import { api, mensajeError } from '@/lib/api';
import { corto, fechaCorta, fechaHora, urlTx, usdc } from '@/lib/format';
import type { Contrato, Evento, Inventario, ItemInventario } from '@/lib/types';
import { useUsuario } from '@/lib/usuario';

type Rol = 'DUENO' | 'INQUILINO' | null;
type Fase = 'CHECKIN' | 'CHECKOUT';
type TabId = 'resumen' | 'devolucion' | 'inventario' | 'cambios' | 'checkout' | 'documentos' | 'historial';

const TAB_IDS: TabId[] = ['resumen', 'devolucion', 'inventario', 'cambios', 'checkout', 'documentos', 'historial'];

interface Siguiente {
  texto: string;
  tab: TabId;
  fase?: Fase;
  boton: string;
}

/** Qué le toca hacer ahora a quien está mirando el contrato. */
function siguientePaso(c: Contrato, rol: Rol, usuarioId?: string): Siguiente | null {
  if (!rol) return null;
  const ren = c.renovacion;
  const faltaRen = !!ren && (rol === 'DUENO' ? !ren.aceptaDueno : !ren.aceptaInquilino);
  const invIn = c.inventarios?.find((i) => i.fase === 'CHECKIN');
  const invOut = c.inventarios?.find((i) => i.fase === 'CHECKOUT');
  const miFirma = (i?: Inventario) => (rol === 'DUENO' ? i?.firmaDueno : i?.firmaInquilino);

  if (c.estado === 'EN_DISPUTA') {
    return { texto: 'Hay una disputa abierta. Un mediador de la plataforma debe resolverla.', tab: 'cambios', boton: 'Ver la disputa' };
  }
  if (c.estado === 'FINALIZADO') {
    const yaCalifique = c.calificaciones?.some((x) => x.deId === usuarioId);
    if (!yaCalifique) {
      const otro = rol === 'DUENO' ? c.inquilino.nombre : c.dueno.nombre;
      return { texto: `El contrato terminó. Califica a ${otro} para construir su reputación.`, tab: 'checkout', boton: 'Calificar' };
    }
    return null;
  }
  if (c.estado === 'EN_CHECKOUT') {
    if (rol === 'DUENO') {
      return { texto: 'Compara el inmueble con el inventario de entrada y decide: check-out conforme, descontar daños o abrir una disputa.', tab: 'checkout', boton: 'Ir al check-out' };
    }
    if (!miFirma(invOut)) {
      return { texto: 'El dueño está revisando el inmueble. Registra y firma el inventario de salida.', tab: 'inventario', fase: 'CHECKOUT', boton: 'Ir al inventario de salida' };
    }
    return null;
  }
  // ACTIVO
  if (faltaRen) return { texto: 'Tienes una propuesta de renovación por responder.', tab: 'cambios', boton: 'Responder' };
  if (!invIn) {
    return rol === 'DUENO'
      ? { texto: 'Registra el inventario de entrada (check-in) con fotos y fírmalo.', tab: 'inventario', fase: 'CHECKIN', boton: 'Hacer el check-in' }
      : { texto: 'Cuando el dueño registre el inventario de entrada, podrás revisarlo y firmarlo.', tab: 'inventario', fase: 'CHECKIN', boton: 'Ver el inventario' };
  }
  if (!miFirma(invIn)) {
    return { texto: 'Revisa el inventario de entrada y fírmalo.', tab: 'inventario', fase: 'CHECKIN', boton: 'Revisar y firmar' };
  }
  if (rol === 'DUENO' && c.pendienteUsdc > 0) {
    return { texto: `Sigue aportando a tu plan de devolución: faltan ${usdc(c.pendienteUsdc)}.`, tab: 'devolucion', boton: 'Aportar' };
  }
  if (rol === 'INQUILINO') {
    return { texto: 'Todo en orden. Sigue el avance del plan de devolución del dueño.', tab: 'devolucion', boton: 'Ver el plan' };
  }
  return null;
}

export default function PaginaContrato() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useUsuario();
  const [c, setC] = useState<Contrato | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aporte, setAporte] = useState('1000');
  const [danos, setDanos] = useState('');
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('resumen');
  const [fase, setFase] = useState<Fase>('CHECKIN');

  const cargar = useCallback(async () => {
    try {
      setC(await api.get<Contrato>(`/contratos/${id}`));
      setError(null);
    } catch (e) {
      setError(mensajeError(e));
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  useEffect(() => {
    const h = window.location.hash.slice(1) as TabId;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (TAB_IDS.includes(h)) setTab(h);
  }, []);

  function irA(t: string, f?: Fase) {
    setTab(t as TabId);
    if (f) setFase(f);
    window.history.replaceState(null, '', `#${t}`);
  }

  async function accion(fn: () => Promise<Contrato>, ok?: string) {
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      const nuevo = await fn();
      setC(nuevo);
      if (ok) setAviso(ok);
      await cargar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }

  if (error && !c) return <Mensaje tipo="error">{error}</Mensaje>;
  if (!c) return <Cargando />;

  const esDueno = usuario?.id === c.duenoId;
  const esInquilino = usuario?.id === c.inquilinoId;
  const rol: Rol = esDueno ? 'DUENO' : esInquilino ? 'INQUILINO' : null;
  const faltaAportar = Math.max(0, c.montoUsdc - c.garantiaUsdc - c.devueltoUsdc);
  const proximo = siguientePaso(c, rol, usuario?.id);

  const pestanas = [
    { id: 'resumen', etiqueta: 'Resumen', icono: <Icono nombre="documento" /> },
    { id: 'devolucion', etiqueta: 'Devolución', icono: <Icono nombre="monedas" /> },
    { id: 'inventario', etiqueta: 'Inventario', icono: <Icono nombre="inventario" /> },
    { id: 'cambios', etiqueta: 'Cambios', icono: <Icono nombre="repetir" /> },
    { id: 'checkout', etiqueta: 'Check-out', icono: <Icono nombre="puerta" /> },
    { id: 'documentos', etiqueta: 'Derechos Reales', icono: <Icono nombre="firma" /> },
    { id: 'historial', etiqueta: 'Historial', icono: <Icono nombre="reloj" /> },
  ].map((p) => ({ ...p, marca: proximo?.tab === p.id }));

  return (
    <div className="space-y-6">
      <Link href="/panel" className="inline-flex items-center gap-1.5 text-sm font-semibold text-suave hover:text-terracota">
        <Icono nombre="flecha" className="h-3.5 w-3.5" /> Mi panel
      </Link>

      <div className="card flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <EstadoContratoBadge estado={c.estado} />
            <Insignia tono={c.modo === 'mock' ? 'oro' : 'andino'}>{c.modo === 'mock' ? 'Modo mock' : 'Stellar testnet'}</Insignia>
            {c.ddrrUrl && <Insignia tono="gris">Inscrito en DD.RR.</Insignia>}
          </div>
          <h1 className="text-2xl font-bold">{c.inmueble.titulo}</h1>
          <p className="text-sm text-suave">
            Dueño: {c.dueno.nombre} · Inquilino: {c.inquilino.nombre} · {c.plazoMeses} meses · vence {fechaCorta(c.vencimiento)}
          </p>
          <p className="flex items-center gap-1.5 break-all text-xs text-suave">
            <Icono nombre="candado" className="h-3.5 w-3.5 text-terracota" /> Folio {c.estado === 'FINALIZADO' ? 'liberado' : 'bloqueado'}: {corto(c.folioHash, 12)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-suave">Monto del anticrético</p>
          <p className="font-display text-3xl font-bold text-terracota">{usdc(c.montoUsdc)}</p>
        </div>
      </div>

      <div className="card py-4">
        <PasosContrato c={c} />
      </div>

      {proximo && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-oro bg-oro-claro p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-oro text-tierra">
            <Icono nombre="info" className="h-5 w-5" />
          </span>
          <p className="min-w-48 flex-1 text-sm">
            <b>Próximo paso:</b> {proximo.texto}
          </p>
          <button className="btn btn-oscuro" onClick={() => irA(proximo.tab, proximo.fase)}>
            {proximo.boton}
          </button>
        </div>
      )}

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {aviso && <Mensaje tipo="ok">{aviso}</Mensaje>}

      <Pestanas items={pestanas} activa={tab} onCambio={irA} />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-6">
        {tab === 'resumen' && (
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <ResumenContrato c={c} plantilla={c.inmueble.plantillaReglas} />
            <Bloque icono="monedas" titulo="Reparto del pago" descripcion="Así se dividió lo que pagó el inquilino.">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-andino-claro p-3">
                  <p className="text-xs text-suave">Recibió el dueño</p>
                  <p className="font-bold">{usdc(c.montoDuenoUsdc)}</p>
                </div>
                <div className="rounded-md bg-oro-claro p-3">
                  <p className="text-xs text-suave">Fondo de garantía</p>
                  <p className="font-bold">{usdc(c.montoUsdc - c.montoDuenoUsdc)}</p>
                </div>
              </div>
              <p className="flex items-start gap-2 text-sm text-suave">
                <Icono nombre="candado" className="mt-0.5 h-4 w-4 text-terracota" />
                <span>
                  El folio queda bloqueado mientras el contrato esté activo, y se libera cuando el check-out es conforme.
                </span>
              </p>
            </Bloque>
          </div>
        )}

        {tab === 'devolucion' && (
          <Bloque
            icono="monedas"
            titulo="Plan de devolución"
            descripcion={
              esDueno
                ? 'Junta mes a mes el dinero que tendrás que devolver al terminar el contrato.'
                : 'El dueño va juntando el dinero que te devolverá. Tu garantía ya está retenida en el contrato.'
            }
          >
            <Barra garantia={c.garantiaUsdc} aportes={c.devueltoUsdc} total={c.montoUsdc} />
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-oro" />Garantía {usdc(c.garantiaUsdc)}</span>
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-andino" />Aportes {usdc(c.devueltoUsdc)}</span>
              <span className="font-bold">{c.progresoPct}% asegurado</span>
            </div>
            <p className="text-sm text-suave">Falta juntar {usdc(faltaAportar)} para devolver el monto completo al final del contrato.</p>

            {esDueno && c.estado === 'ACTIVO' && (
              <div className="space-y-2 border-t-2 border-dashed border-borde pt-4">
                <label className="label" htmlFor="aporte">Aportar a la devolución (USDC)</label>
                <div className="flex gap-2">
                  <input id="aporte" className="input" type="number" value={aporte} onChange={(e) => setAporte(e.target.value)} />
                  <button
                    className="btn btn-andino shrink-0"
                    disabled={ocupado}
                    onClick={() => accion(() => anticretico.aportarDevolucion(c, Number(aporte)), 'Aporte registrado.')}
                  >
                    Aportar
                  </button>
                </div>
              </div>
            )}
            {!esDueno && c.estado === 'ACTIVO' && <p className="text-xs text-suave">Solo el dueño puede hacer aportes.</p>}
          </Bloque>
        )}

        {tab === 'inventario' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button className={`chip ${fase === 'CHECKIN' ? 'chip-activo' : ''}`} onClick={() => setFase('CHECKIN')}>
                Check-in (entrada)
              </button>
              <button
                className={`chip ${fase === 'CHECKOUT' ? 'chip-activo' : ''}`}
                disabled={c.estado === 'ACTIVO'}
                onClick={() => setFase('CHECKOUT')}
                title={c.estado === 'ACTIVO' ? 'Se habilita cuando se abre el check-out' : undefined}
              >
                Check-out (salida)
              </button>
              {c.estado === 'ACTIVO' && <span className="text-xs text-suave">El inventario de salida se habilita al abrir el check-out.</span>}
            </div>
            <FormularioInventario
              key={fase}
              contrato={c}
              fase={fase}
              inventario={c.inventarios?.find((i) => i.fase === fase)}
              rol={rol}
              alCambiar={cargar}
            />
          </div>
        )}

        {tab === 'cambios' &&
          (c.estado === 'FINALIZADO' ? (
            <Mensaje tipo="info">El contrato finalizó: ya no admite cambios.</Mensaje>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-2">
              {c.estado === 'EN_DISPUTA' && (
                <div className="lg:col-span-2">
                  <Disputa c={c} rol={rol} alCambiar={cargar} />
                </div>
              )}
              <Renovacion c={c} rol={rol} alCambiar={cargar} />
              <SalidaAnticipada c={c} rol={rol} alCambiar={cargar} />
              {c.estado !== 'EN_DISPUTA' && (
                <div className="lg:col-span-2">
                  <Disputa c={c} rol={rol} alCambiar={cargar} />
                </div>
              )}
            </div>
          ))}

        {tab === 'checkout' && (
          <div className="space-y-6">
            <Bloque
              icono="puerta"
              titulo="Check-out"
              descripcion="Al terminar el contrato se compara el inmueble con el inventario de entrada. Tu dinero solo se libera después de un check-out conforme."
            >
              {c.estado === 'ACTIVO' && (
                <>
                  <p className="text-sm text-suave">El check-out todavía no está abierto. Lo abre el dueño al vencer el contrato.</p>
                  {esDueno && (
                    <button className="btn btn-sec" disabled={ocupado} onClick={() => accion(() => anticretico.iniciarCheckout(c), 'Check-out iniciado.')}>
                      Iniciar check-out
                    </button>
                  )}
                </>
              )}

              {c.estado === 'EN_CHECKOUT' && esDueno && (
                <div className="space-y-4">
                  <button
                    className="btn btn-primario w-full"
                    disabled={ocupado}
                    onClick={() => accion(() => anticretico.aprobarCheckout(c), 'Check-out conforme: se devolvió el dinero y se liberó el folio.')}
                  >
                    <Icono nombre="check" className="h-4 w-4" /> Check-out conforme: devolver y liberar folio
                  </button>
                  <div className="space-y-2 border-t-2 border-dashed border-borde pt-4">
                    <p className="label">O reclamar daños (se descuentan de la garantía)</p>
                    <div className="flex flex-wrap gap-2">
                      <input className="input min-w-32 flex-1" type="number" placeholder="Monto" value={danos} onChange={(e) => setDanos(e.target.value)} />
                      <input className="input min-w-40 flex-[2]" placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                    </div>
                    <button
                      className="btn btn-peligro"
                      disabled={ocupado || !Number(danos)}
                      onClick={() => accion(() => anticretico.reclamarDanos(c, Number(danos), motivo), 'Descuento aplicado a la garantía.')}
                    >
                      Aplicar descuento
                    </button>
                  </div>
                </div>
              )}

              {c.estado === 'EN_CHECKOUT' && !esDueno && (
                <Mensaje tipo="info">El dueño está revisando el inmueble. Firma el inventario de salida cuando esté listo.</Mensaje>
              )}

              {c.estado === 'EN_DISPUTA' && <Mensaje tipo="info">El contrato está en disputa. Mientras tanto, el dinero sigue retenido.</Mensaje>}

              {c.estado === 'FINALIZADO' && (
                <Mensaje tipo="ok">
                  Contrato finalizado. El dinero retenido fue devuelto al inquilino y el folio quedó libre para un nuevo contrato.
                </Mensaje>
              )}
            </Bloque>
            <Calificar c={c} usuario={usuario} alCambiar={cargar} />
          </div>
        )}

        {tab === 'documentos' && <GuiaDdrr c={c} alCambiar={cargar} />}

        {tab === 'historial' && (
          <Bloque icono="reloj" titulo="Historial" descripcion="Todo lo que pasó en este contrato, en orden.">
            <ol className="space-y-4">
              {(c.eventos ?? []).map((e) => <EventoFila key={e.id} e={e} modo={c.modo} />)}
            </ol>
          </Bloque>
        )}
      </div>
    </div>
  );
}

function EventoFila({ e, modo }: { e: Evento; modo: 'mock' | 'testnet' }) {
  return (
    <li className="flex gap-3 text-sm">
      <span className="mt-0.5 text-terracota"><IconoEvento tipo={e.tipo} /></span>
      <div>
        <p className="font-medium">{e.detalle ?? e.tipo}</p>
        <p className="text-xs text-suave">
          {fechaHora(e.creadoEn)}
          {e.txHash && (
            <>
              {' · tx '}
              {modo === 'testnet' ? (
                <a className="text-andino underline" href={urlTx(e.txHash)} target="_blank" rel="noreferrer">{corto(e.txHash, 8)}</a>
              ) : (
                <span title="Transacción simulada">{corto(e.txHash, 8)}</span>
              )}
            </>
          )}
        </p>
      </div>
    </li>
  );
}

const AMBIENTES_BASE = ['Sala', 'Cocina', 'Dormitorio principal', 'Baño', 'Pisos y paredes'];

function FormularioInventario({
  contrato,
  fase,
  inventario,
  rol,
  alCambiar,
}: {
  contrato: Contrato;
  fase: Fase;
  inventario?: Inventario;
  rol: Rol;
  alCambiar: () => void;
}) {
  const [items, setItems] = useState<ItemInventario[]>(
    inventario?.items ?? AMBIENTES_BASE.map((a) => ({ ambiente: a, estado: 'BUENO' as const, observacion: '', fotos: [] })),
  );
  const [error, setError] = useState<string | null>(null);

  const actualizar = (n: number, parcial: Partial<ItemInventario>) =>
    setItems((x) => x.map((it, k) => (k === n ? { ...it, ...parcial } : it)));

  async function agregarFoto(n: number, archivo?: File) {
    if (!archivo) return;
    try {
      const url = await api.subirFoto(archivo);
      actualizar(n, { fotos: [...(items[n].fotos ?? []), url] });
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  async function guardar() {
    try {
      await api.put(`/contratos/${contrato.id}/inventario/${fase}`, { items });
      setError(null);
      alCambiar();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  async function firmar() {
    if (!rol) return;
    try {
      await api.post(`/contratos/${contrato.id}/inventario/${fase}/firmar`, { rol });
      setError(null);
      alCambiar();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  const entrada = fase === 'CHECKIN';
  const yaFirme = rol === 'DUENO' ? inventario?.firmaDueno : rol === 'INQUILINO' ? inventario?.firmaInquilino : true;

  return (
    <Bloque
      icono="inventario"
      titulo={entrada ? 'Check-in: inventario de entrada' : 'Check-out: inventario de salida'}
      descripcion={
        entrada
          ? 'Registren el estado de cada ambiente con fotos. Cuando firman las dos partes, queda un hash que prueba que nadie lo cambió.'
          : 'Registren cómo queda el inmueble al salir, para compararlo con el inventario de entrada.'
      }
    >
      <ol className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-bold text-suave">
        <li><span className="text-terracota">1.</span> Completar</li>
        <li><span className="text-terracota">2.</span> Guardar</li>
        <li><span className="text-terracota">3.</span> Firmar las dos partes</li>
      </ol>

      <div className="space-y-4">
        {items.map((it, n) => (
          <div key={it.ambiente} className="space-y-2 border-b-2 border-dashed border-borde pb-4 last:border-0 last:pb-0">
            <div className="grid grid-cols-[1fr_140px] items-center gap-2 sm:grid-cols-[1fr_140px_1.3fr]">
              <p className="text-sm font-bold">{it.ambiente}</p>
              <Selector
                valor={it.estado}
                onCambio={(v) => actualizar(n, { estado: v as ItemInventario['estado'] })}
                ariaLabel={`Estado de ${it.ambiente}`}
                opciones={[
                  { valor: 'EXCELENTE', etiqueta: 'Excelente', icono: <span className="h-2.5 w-2.5 rounded-sm bg-lago" /> },
                  { valor: 'BUENO', etiqueta: 'Bueno', icono: <span className="h-2.5 w-2.5 rounded-sm bg-andino" /> },
                  { valor: 'REGULAR', etiqueta: 'Regular', icono: <span className="h-2.5 w-2.5 rounded-sm bg-oro" /> },
                  { valor: 'MALO', etiqueta: 'Malo', icono: <span className="h-2.5 w-2.5 rounded-sm bg-peligro" /> },
                ]}
              />
              <input className="input col-span-2 sm:col-span-1" placeholder="Observación" value={it.observacion ?? ''} onChange={(e) => actualizar(n, { observacion: e.target.value })} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(it.fotos ?? []).map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={u} src={u} alt="" className="h-12 w-16 rounded-sm border-2 border-borde object-cover" />
              ))}
              <label className="cursor-pointer rounded-sm bg-borde/70 px-2.5 py-1.5 text-xs font-bold hover:bg-oro-claro">
                <Icono nombre="camara" className="mr-1 inline h-3.5 w-3.5 align-text-bottom" /> Agregar foto
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => agregarFoto(n, e.target.files?.[0])} />
              </label>
            </div>
          </div>
        ))}
      </div>

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <div className="flex flex-wrap items-center gap-2 border-t-2 border-borde pt-4">
        <button className="btn btn-sec" onClick={guardar} disabled={!rol}>Guardar inventario</button>
        {inventario && rol && !yaFirme && (
          <button className="btn btn-andino" onClick={firmar}>Firmar como {rol === 'DUENO' ? 'dueño' : 'inquilino'}</button>
        )}
        {!rol && <span className="text-xs text-suave">Solo las partes del contrato pueden editar y firmar.</span>}
      </div>

      {inventario && (
        <div className="space-y-1 rounded-md bg-crema p-3 text-xs">
          <p className="flex flex-wrap gap-x-6">
            <span className={inventario.firmaDueno ? 'font-bold text-andino' : 'text-suave'}>Dueño: {inventario.firmaDueno ? 'firmó' : 'pendiente'}</span>
            <span className={inventario.firmaInquilino ? 'font-bold text-andino' : 'text-suave'}>Inquilino: {inventario.firmaInquilino ? 'firmó' : 'pendiente'}</span>
          </p>
          {inventario.hash && <p className="break-all text-suave">Hash registrado: {inventario.hash}</p>}
        </div>
      )}
      {!inventario && rol && <p className="flex items-center gap-1.5 text-xs text-suave"><Chakana className="h-3 w-3 text-terracota" /> Aún no se guardó el inventario: completa y guarda para poder firmar.</p>}
    </Bloque>
  );
}
