'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { anticretico } from '@/lib/anticretico';
import { api } from '@/lib/api';
import { NIVELES } from '@/lib/format';
import { useUsuario } from '@/lib/usuario';
import { Campana } from './Campana';
import { Icono, IconoNivel } from './Iconos';
import { Selector } from './Selector';
import { ThemeToggle } from './ThemeToggle';

const ENLACES = [
  { href: '/', texto: 'Inmuebles' },
  { href: '/publicar', texto: 'Publicar' },
  { href: '/panel', texto: 'Mi panel' },
  { href: '/hoja-de-ruta', texto: 'Hoja de ruta' },
];

export function Header() {
  const { usuario, usuarios, seleccionar } = useUsuario();
  const [reiniciando, setReiniciando] = useState(false);
  const [menu, setMenu] = useState(false);
  const ruta = usePathname();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenu(false);
  }, [ruta]);

  async function reiniciar() {
    if (!confirm('¿Reiniciar la demo? Se borran contratos, visitas y ofertas, y todos los inmuebles quedan disponibles.')) return;
    setReiniciando(true);
    try {
      await api.post('/demo/reset');
      window.location.href = '/';
    } finally {
      setReiniciando(false);
    }
  }

  const activo = (href: string) => (href === '/' ? ruta === '/' : ruta.startsWith(href));
  const enlace = (href: string) =>
    `rounded-md px-3 py-2 text-sm font-semibold transition hover:bg-oro-claro ${activo(href) ? 'bg-terracota-claro text-terracota-oscuro' : 'text-tinta'}`;

  const rolTxt = (r: string) => (r === 'INQUILINO' ? 'inquilino' : r === 'DUENO' ? 'dueño' : 'ambos');
  const selectorUsuario = (id: string, clase: string) => (
    <>
      <label className="sr-only" htmlFor={id}>Usuario de demostración</label>
      <Selector
        id={id}
        className={clase}
        alinear="der"
        anchoLista="w-72 max-w-[calc(100vw-2rem)]"
        valor={usuario?.id ?? ''}
        onCambio={seleccionar}
        opciones={usuarios.map((u) => ({
          valor: u.id,
          etiqueta: u.nombre,
          icono: <IconoNivel nivel={u.nivel} />,
          detalle: `${rolTxt(u.rol)} · ${NIVELES[u.nivel] ?? u.nivel}`,
        }))}
      />
    </>
  );

  return (
    <>
      {anticretico.modo === 'mock' && (
        <div className="bg-oro px-4 py-1.5 text-center text-xs font-bold text-tierra">
          MODO MOCK · la cadena Stellar está simulada por el backend (no es una transacción real)
        </div>
      )}
      {anticretico.modo === 'testnet' && (
        <div className="bg-lago px-4 py-1.5 text-center text-xs font-bold text-white">
          TESTNET · transacciones reales en la red de pruebas de Stellar
        </div>
      )}
      <header className="sticky top-0 z-30 border-b-2 border-borde bg-barra text-tinta">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-1.5">
          <Link href="/" aria-label="Utama, inicio" className="-ml-1 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo-sobre-claro.svg" alt="Utama" className="h-10 w-auto sm:h-12 dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo-claro.svg" alt="Utama" className="hidden h-10 w-auto sm:h-12 dark:block" />
          </Link>

          <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Principal">
            {ENLACES.map((e) => (
              <Link key={e.href} href={e.href} className={enlace(e.href)}>{e.texto}</Link>
            ))}
            <Link href="/registro" className="rounded-md px-3 py-2 text-sm font-bold text-terracota hover:bg-oro-claro">
              Registrarme
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Campana />
            <ThemeToggle />
            <div className="hidden lg:block">{selectorUsuario('usuario-demo', 'w-60')}</div>
            <button
              className="hidden h-10 rounded-md border-2 border-borde px-3 text-sm hover:bg-oro-claro lg:block"
              onClick={reiniciar}
              disabled={reiniciando}
              title="Reiniciar la demo"
              aria-label="Reiniciar la demo"
            >
              <Icono nombre="refrescar" className="h-4 w-4" />
            </button>
            <button
              className="grid h-10 w-10 place-items-center rounded-md border-2 border-borde text-tinta hover:bg-oro-claro lg:hidden"
              onClick={() => setMenu((m) => !m)}
              aria-expanded={menu}
              aria-controls="menu-movil"
              aria-label={menu ? 'Cerrar el menú' : 'Abrir el menú'}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                {menu ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>

        {menu && (
          <div id="menu-movil" className="border-t-2 border-borde bg-barra px-4 pb-4 pt-3 lg:hidden">
            <nav className="grid gap-1" aria-label="Menú">
              {ENLACES.map((e) => (
                <Link key={e.href} href={e.href} className={`${enlace(e.href)} py-3 text-base`}>{e.texto}</Link>
              ))}
              <Link href="/registro" className="rounded-md px-3 py-3 text-base font-bold text-terracota hover:bg-oro-claro">Registrarme</Link>
            </nav>
            <div className="mt-3 space-y-2 border-t-2 border-dashed border-borde pt-3">
              <p className="label">Usuario de demostración</p>
              {selectorUsuario('usuario-demo-movil', 'w-full')}
              <button className="btn btn-sec w-full" onClick={reiniciar} disabled={reiniciando}><Icono nombre="refrescar" className="h-4 w-4" /> Reiniciar la demo</button>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
