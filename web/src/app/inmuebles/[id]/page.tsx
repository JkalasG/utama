'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icono } from '@/components/Iconos';
import { Chakana, Titulo, Ubicacion } from '@/components/Motivos';
import { ReglasInmueble, useConfig } from '@/components/ReglasInmueble';
import { Cargando, Insignias, Mensaje, Nivel, TipoEtiqueta } from '@/components/ui';
import { anticretico } from '@/lib/anticretico';
import { api, mensajeError } from '@/lib/api';
import { diaClave, fechaCorta, fechaHora, hora, usdc } from '@/lib/format';
import type { Inmueble, Oferta, Slot } from '@/lib/types';
import { useUsuario } from '@/lib/usuario';

interface Terminos {
  montoUsdc: number;
  plazoMeses: number;
  origen: string;
}

export default function FichaInmueble() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { usuario } = useUsuario();
  const config = useConfig();

  const [inmueble, setInmueble] = useState<Inmueble | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [foto, setFoto] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [terminos, setTerminos] = useState<Terminos | null>(null);
  const [metodo, setMetodo] = useState<'USDC' | 'BOB'>('USDC');
  const [procesando, setProcesando] = useState(false);
  const [errorContrato, setErrorContrato] = useState<string | null>(null);

  const esDueno = !!usuario && !!inmueble && usuario.id === inmueble.duenoId;

  const cargar = useCallback(async () => {
    try {
      const qs = usuario ? `?usuarioId=${usuario.id}` : '';
      const [i, s, o] = await Promise.all([
        api.get<Inmueble>(`/inmuebles/${id}${qs}`),
        api.get<Slot[]>(`/inmuebles/${id}/disponibilidad`),
        api.get<Oferta[]>(`/ofertas?inmuebleId=${id}`),
      ]);
      setInmueble(i);
      setSlots(s);
      setOfertas(o);
      setError(null);
    } catch (e) {
      setError(mensajeError(e));
    }
  }, [id, usuario]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, Slot[]>();
    for (const s of slots) {
      const k = diaClave(s.inicio);
      mapa.set(k, [...(mapa.get(k) ?? []), s]);
    }
    return [...mapa.entries()];
  }, [slots]);

  function abrirConfirmacion(t: Terminos) {
    setErrorContrato(null);
    // Moneda sugerida según la residencia (D4): dólares si vive en el exterior, bolivianos si vive en Bolivia.
    setMetodo(usuario && usuario.paisResidencia !== 'BO' ? 'USDC' : 'BOB');
    setTerminos(t);
  }

  async function reservar(slot: Slot) {
    if (!usuario) return;
    setAviso(null);
    try {
      await api.post('/visitas', { disponibilidadId: slot.id, inquilinoId: usuario.id });
      setAviso(`Visita confirmada para ${fechaHora(slot.inicio)}. Ya puedes ver la dirección exacta.`);
      await cargar();
    } catch (e) {
      setError(mensajeError(e));
      await cargar();
    }
  }

  async function tomar() {
    if (!usuario || !inmueble || !terminos) return;
    setProcesando(true);
    setErrorContrato(null);
    try {
      const contrato = await anticretico.crearAnticretico({
        inmueble,
        inquilino: usuario,
        montoUsdc: terminos.montoUsdc,
        plazoMeses: terminos.plazoMeses,
        garantiaPct: inmueble.garantiaPct,
        metodoPago: metodo,
      });
      router.push(`/contratos/${contrato.id}`);
    } catch (e) {
      setErrorContrato(mensajeError(e));
    } finally {
      setProcesando(false);
    }
  }

  if (error && !inmueble) return <Mensaje tipo="error">{error}</Mensaje>;
  if (!inmueble) return <Cargando />;

  const ocupado = inmueble.estado === 'EN_ANTICRETICO';
  const garantia = (inmueble.montoUsdc * inmueble.garantiaPct) / 100;
  const tc = config?.tipoCambioBob ?? 9.3;
  const tMonto = terminos?.montoUsdc ?? inmueble.montoUsdc;
  const tGarantia = (tMonto * inmueble.garantiaPct) / 100;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-suave hover:text-terracota"><Icono nombre="flecha" className="h-3.5 w-3.5" /> Volver a los inmuebles</Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="aspect-[16/10] overflow-hidden rounded-lg border-2 border-borde bg-borde">
              {inmueble.fotos[foto] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={inmueble.fotos[foto].url} alt={inmueble.titulo} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex gap-2">
              {inmueble.fotos.map((f, n) => (
                <button key={f.id} onClick={() => setFoto(n)} className={`h-16 w-24 overflow-hidden rounded-md border-2 ${n === foto ? 'border-cochinilla' : 'border-transparent opacity-80'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-terracota">
              <Chakana className="h-3.5 w-3.5" /> <TipoEtiqueta tipo={inmueble.tipo} /> · {inmueble.zona}, {inmueble.ciudad}
            </p>
            <h1 className="text-3xl font-bold leading-tight">{inmueble.titulo}</h1>
            <Insignias i={inmueble} />
            <p className="text-suave">{inmueble.descripcion}</p>
          </div>

          <div className="card grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Dato t="Superficie" v={`${inmueble.superficieM2} m²`} />
            <Dato t="Ambientes" v={String(inmueble.ambientes)} />
            <Dato t="Dormitorios" v={String(inmueble.dormitorios)} />
            <Dato t="Baños" v={String(inmueble.banos)} />
            <Dato t="Amoblado" v={inmueble.amoblado ? 'Sí' : 'No'} />
            <Dato t="Reglas" v={inmueble.plantillaReglas.charAt(0) + inmueble.plantillaReglas.slice(1).toLowerCase()} />
            <Dato t="Folio" v={inmueble.folioMascara} />
            <Dato t="Dueño" v={inmueble.dueno.nombre} extra={<Nivel nivel={inmueble.dueno.nivel} />} />
          </div>

          <div className="card space-y-1">
            <Titulo nivel={3}>Ubicación</Titulo>
            {inmueble.direccionVisible ? (
              <p className="flex items-center gap-2 font-semibold"><Ubicacion className="h-4 w-4 text-terracota" /> {inmueble.direccion}</p>
            ) : (
              <p className="text-sm text-suave">
                La dirección exacta se revela cuando agendas una visita. Por ahora: {inmueble.zona}, {inmueble.ciudad}.
              </p>
            )}
          </div>

          <ReglasInmueble plantilla={inmueble.plantillaReglas} reglasRecomendadas={inmueble.reglasRecomendadas} />

          <div className="card space-y-4">
            <Titulo nivel={3}>Agenda una visita</Titulo>
            {aviso && <Mensaje tipo="ok">{aviso}</Mensaje>}
            {error && <Mensaje tipo="error">{error}</Mensaje>}
            {slots.length === 0 && <p className="text-sm text-suave">El dueño todavía no definió horarios.</p>}
            {porDia.map(([dia, lista]) => (
              <div key={dia}>
                <p className="mb-2 text-sm font-bold">{dia}</p>
                <div className="flex flex-wrap gap-2">
                  {lista.map((s) => (
                    <button
                      key={s.id}
                      disabled={s.reservada || esDueno}
                      onClick={() => reservar(s)}
                      className={`chip ${s.reservada ? 'line-through opacity-40' : ''}`}
                    >
                      {hora(s.inicio)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {esDueno && <AgregarHorario inmuebleId={inmueble.id} onListo={cargar} />}
            <p className="rounded-md bg-crema p-3 text-xs text-suave">
              <Icono nombre="info" className="mr-1.5 inline h-4 w-4 align-text-bottom text-terracota" /> Qué revisar en la visita: humedad en paredes y techos, presión del agua, instalación eléctrica, estado de
              puertas y ventanas, y qué servicios paga cada parte. Pregunta también por el plan de devolución del dueño.
            </p>
          </div>

          <Ofertas inmueble={inmueble} ofertas={ofertas} esDueno={esDueno} onCambio={cargar} onTomar={(o) => abrirConfirmacion({ montoUsdc: o.montoUsdc, plazoMeses: o.plazoMeses, origen: 'tu oferta aceptada' })} />
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="card space-y-4">
            <div>
              <p className="text-xs text-suave">Anticrético por {inmueble.plazoMeses / 12} {inmueble.plazoMeses === 12 ? 'año' : 'años'}</p>
              <p className="font-display text-4xl font-bold text-terracota">{usdc(inmueble.montoUsdc)}</p>
              <p className="text-xs text-suave">≈ {(inmueble.montoUsdc * tc).toLocaleString('es-BO', { maximumFractionDigits: 0 })} Bs (referencial)</p>
            </div>

            <div className="space-y-2 rounded-md bg-crema p-3 text-sm">
              <Fila t="Al dueño, al instante" v={usdc(inmueble.montoUsdc - garantia)} />
              <Fila t={`Fondo de garantía (${inmueble.garantiaPct}%)`} v={usdc(garantia)} />
              <p className="text-xs text-suave">
                La garantía queda bloqueada en el contrato inteligente y se libera tras un check-out conforme.
              </p>
            </div>

            {ocupado && inmueble.ocupadoHasta && (
              <Mensaje tipo="info">
                En anticrético hasta {fechaCorta(inmueble.ocupadoHasta)}. (Demo: puedes intentar tomarlo para ver cómo el
                contrato rechaza el doble anticrético.)
              </Mensaje>
            )}

            {esDueno ? (
              <Mensaje tipo="info">Eres el dueño de este inmueble.</Mensaje>
            ) : (
              <button
                className="btn btn-primario w-full"
                onClick={() => abrirConfirmacion({ montoUsdc: inmueble.montoUsdc, plazoMeses: inmueble.plazoMeses, origen: 'las condiciones publicadas' })}
                disabled={!usuario}
              >
                Tomar en anticrético
              </button>
            )}
            <p className="text-center text-xs text-suave">
              Folio {inmueble.folioMascara} · bloqueo en {anticretico.modo === 'mock' ? 'base de datos (mock)' : 'Stellar testnet'}
            </p>
          </div>
        </aside>
      </div>

      {/* En pantallas pequeñas la tarjeta de precio queda al final: se repite como barra fija. */}
      {!esDueno && usuario && !terminos && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t-2 border-borde bg-barra px-4 py-3 lg:hidden">
          <div>
            <p className="text-xs text-suave">Anticrético · {inmueble.plazoMeses / 12} {inmueble.plazoMeses === 12 ? 'año' : 'años'}</p>
            <p className="font-display text-xl font-bold text-terracota">{usdc(inmueble.montoUsdc)}</p>
          </div>
          <button
            className="btn btn-primario"
            onClick={() => abrirConfirmacion({ montoUsdc: inmueble.montoUsdc, plazoMeses: inmueble.plazoMeses, origen: 'las condiciones publicadas' })}
          >
            Tomar en anticrético
          </button>
        </div>
      )}

      {terminos && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-auto bg-tierra/60 p-4">
          <div className="card w-full max-w-lg space-y-4">
            <h2 className="text-xl font-bold">Resumen y pago</h2>
            <p className="text-sm text-suave">{inmueble.titulo} · con {terminos.origen}</p>

            <div className="space-y-2 rounded-md bg-crema p-3 text-sm">
              <Fila t="Partes" v={`${inmueble.dueno.nombre} (dueño) · ${usuario?.nombre} (inquilino)`} />
              <Fila t="Monto del anticrético" v={usdc(tMonto)} />
              <Fila t="Plazo" v={`${terminos.plazoMeses} meses`} />
              <Fila t="Recibe el dueño" v={usdc(tMonto - tGarantia)} />
              <Fila t={`Fondo de garantía (${inmueble.garantiaPct}%)`} v={usdc(tGarantia)} />
              <Fila t="Reglas" v={`Plantilla ${inmueble.plantillaReglas.toLowerCase()}`} />
              <Fila t="Comisión de Utama" v={`${config?.comisionPlataformaPct ?? 0.5} % (referencial)`} />
            </div>

            <div>
              <p className="label">Forma de pago</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" className={`chip justify-start ${metodo === 'USDC' ? 'chip-activo' : ''}`} onClick={() => setMetodo('USDC')}>
                  Dólares digitales (USDC)
                </button>
                <button type="button" className={`chip justify-start ${metodo === 'BOB' ? 'chip-activo' : ''}`} onClick={() => setMetodo('BOB')}>
                  Bolivianos (QR bancario)
                </button>
              </div>
              {metodo === 'BOB' ? (
                <p className="mt-2 rounded-md bg-oro-claro p-2.5 text-xs">
                  Pagas <b>{(tMonto * tc).toLocaleString('es-BO', { maximumFractionDigits: 0 })} Bs</b> (1 USDC = {tc} Bs). Un anchor lo convierte a USDC y
                  la garantía queda en USDC en el contrato. <b>Conversión simulada.</b>
                </p>
              ) : (
                <p className="mt-2 text-xs text-suave">Pagas directamente desde tu wallet Stellar.</p>
              )}
              {usuario && (
                <p className="mt-1 text-xs text-suave">
                  Sugerido para tu residencia ({usuario.paisResidencia === 'BO' ? 'Bolivia: bolivianos' : 'exterior: dólares'}); puedes cambiarlo.
                </p>
              )}
            </div>

            {errorContrato && (
              <div className="rounded-md border-2 border-peligro bg-peligro-claro p-4 text-peligro">
                <p className="flex items-center gap-2 font-bold"><Icono nombre="prohibido" className="h-4 w-4" /> Operación rechazada por el contrato</p>
                <p className="text-sm">{errorContrato}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button className="btn btn-sec flex-1" onClick={() => { setTerminos(null); setErrorContrato(null); }}>
                Cancelar
              </button>
              <button className="btn btn-primario flex-1" onClick={tomar} disabled={procesando}>
                {procesando ? 'Firmando…' : 'Firmar y pagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Dato({ t, v, extra }: { t: string; v: string; extra?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-suave">{t}</p>
      <p className="font-semibold">{v}</p>
      {extra}
    </div>
  );
}

function Fila({ t, v }: { t: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-suave">{t}</span>
      <span className="text-right font-semibold">{v}</span>
    </div>
  );
}

function AgregarHorario({ inmuebleId, onListo }: { inmuebleId: string; onListo: () => void }) {
  const [valor, setValor] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function agregar() {
    if (!valor) return;
    const inicio = new Date(valor);
    const fin = new Date(inicio.getTime() + 45 * 60_000);
    try {
      await api.post(`/inmuebles/${inmuebleId}/disponibilidad`, {
        slots: [{ inicio: inicio.toISOString(), fin: fin.toISOString() }],
      });
      setValor('');
      setError(null);
      onListo();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  return (
    <div className="space-y-2 border-t-2 border-dashed border-borde pt-4">
      <p className="label">Agregar un horario libre (visitas de 45 min)</p>
      <div className="flex flex-wrap gap-2">
        <input type="datetime-local" className="input min-w-0 flex-1" value={valor} onChange={(e) => setValor(e.target.value)} />
        <button className="btn btn-andino" onClick={agregar}>Agregar</button>
      </div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </div>
  );
}

function Ofertas({
  inmueble,
  ofertas,
  esDueno,
  onCambio,
  onTomar,
}: {
  inmueble: Inmueble;
  ofertas: Oferta[];
  esDueno: boolean;
  onCambio: () => void;
  onTomar: (o: Oferta) => void;
}) {
  const { usuario } = useUsuario();
  const [monto, setMonto] = useState(String(inmueble.montoUsdc));
  const [plazo, setPlazo] = useState(String(inmueble.plazoMeses));
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [contra, setContra] = useState<{ id: string; monto: string; plazo: string } | null>(null);

  async function ofertar() {
    if (!usuario) return;
    try {
      await api.post('/ofertas', {
        inmuebleId: inmueble.id,
        inquilinoId: usuario.id,
        montoUsdc: Number(monto),
        plazoMeses: Number(plazo),
        mensaje: mensaje || undefined,
      });
      setMensaje('');
      setError(null);
      onCambio();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  async function responder(id: string, estado: 'ACEPTADA' | 'RECHAZADA') {
    await api.patch(`/ofertas/${id}`, { estado });
    onCambio();
  }

  async function contraofertar() {
    if (!contra) return;
    try {
      await api.patch(`/ofertas/${contra.id}`, { estado: 'CONTRAOFERTA', montoUsdc: Number(contra.monto), plazoMeses: Number(contra.plazo) });
      setContra(null);
      onCambio();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  const visibles = esDueno ? ofertas : ofertas.filter((o) => o.inquilino.id === usuario?.id);
  const etiqueta: Record<string, string> = { PENDIENTE: 'pendiente', ACEPTADA: 'aceptada', RECHAZADA: 'rechazada', CONTRAOFERTA: 'contraoferta del dueño' };

  return (
    <div className="card space-y-4">
      <Titulo nivel={3}>{esDueno ? 'Ofertas recibidas' : 'Negocia: haz una oferta'}</Titulo>
      {!esDueno && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Monto (USDC)</label>
            <input className="input" type="number" value={monto} onChange={(e) => setMonto(e.target.value)} />
          </div>
          <div>
            <label className="label">Plazo (meses)</label>
            <input className="input" type="number" value={plazo} onChange={(e) => setPlazo(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Mensaje (opcional)</label>
            <input className="input" value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <button className="btn btn-sec" onClick={ofertar} disabled={!usuario}>Enviar oferta</button>
          </div>
        </div>
      )}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {visibles.length === 0 && <p className="text-sm text-suave">Todavía no hay ofertas.</p>}
      {visibles.map((o) => (
        <div key={o.id} className="space-y-2 rounded-md bg-crema p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">
                {o.inquilino.nombre} {o.estado === 'CONTRAOFERTA' ? 'recibió una contraoferta de' : 'ofrece'} {usdc(o.montoUsdc)} por {o.plazoMeses} meses
              </p>
              {o.mensaje && <p className="text-suave">“{o.mensaje}”</p>}
            </div>
            <span className="rounded-sm bg-borde px-2 py-0.5 text-xs font-bold">{etiqueta[o.estado]}</span>
          </div>

          {esDueno && o.estado === 'PENDIENTE' && (
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-andino !py-1.5" onClick={() => responder(o.id, 'ACEPTADA')}>Aceptar</button>
              <button className="btn btn-sec !py-1.5" onClick={() => setContra({ id: o.id, monto: String(o.montoUsdc), plazo: String(o.plazoMeses) })}>Contraofertar</button>
              <button className="btn btn-peligro !py-1.5" onClick={() => responder(o.id, 'RECHAZADA')}>Rechazar</button>
            </div>
          )}
          {esDueno && contra?.id === o.id && (
            <div className="flex flex-wrap items-end gap-2">
              <div><label className="label">Monto</label><input className="input !w-32" type="number" value={contra.monto} onChange={(e) => setContra({ ...contra, monto: e.target.value })} /></div>
              <div><label className="label">Plazo</label><input className="input !w-24" type="number" value={contra.plazo} onChange={(e) => setContra({ ...contra, plazo: e.target.value })} /></div>
              <button className="btn btn-primario !py-2" onClick={contraofertar}>Enviar contraoferta</button>
            </div>
          )}
          {!esDueno && o.estado === 'CONTRAOFERTA' && (
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-andino !py-1.5" onClick={() => responder(o.id, 'ACEPTADA')}>Aceptar contraoferta</button>
              <button className="btn btn-peligro !py-1.5" onClick={() => responder(o.id, 'RECHAZADA')}>Rechazar</button>
            </div>
          )}
          {!esDueno && o.estado === 'ACEPTADA' && (
            <button className="btn btn-primario !py-1.5" onClick={() => onTomar(o)}>Tomar en anticrético con esta oferta</button>
          )}
        </div>
      ))}
    </div>
  );
}
