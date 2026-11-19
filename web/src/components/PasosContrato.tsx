import type { Contrato } from '@/lib/types';
import { Icono } from './Iconos';

const PASOS = ['Contrato firmado', 'Check-in', 'Vigencia', 'Check-out', 'Cierre'];

/** En qué etapa del ciclo de vida está el contrato (0 a 4; 5 = todo completo). */
export function etapaDelContrato(c: Contrato): number {
  if (c.estado === 'FINALIZADO') return 5;
  if (c.estado === 'EN_CHECKOUT' || c.estado === 'EN_DISPUTA') return 3;
  const inv = c.inventarios?.find((i) => i.fase === 'CHECKIN');
  return inv?.firmaDueno && inv?.firmaInquilino ? 2 : 1;
}

/** Barra de etapas: contrato firmado → check-in → vigencia → check-out → cierre. */
export function PasosContrato({ c }: { c: Contrato }) {
  const actual = etapaDelContrato(c);
  return (
    <ol className="flex items-start" aria-label="Etapas del contrato">
      {PASOS.map((t, i) => {
        const hecho = i < actual;
        const ahora = i === actual;
        return (
          <li key={t} className="relative flex flex-1 flex-col items-center gap-1.5 text-center" aria-current={ahora ? 'step' : undefined}>
            {i > 0 && (
              <span
                className={`absolute right-1/2 top-3.5 h-0.5 w-full ${i <= actual ? 'bg-lago' : 'bg-borde'}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 grid h-7 w-7 place-items-center rounded-full border-2 text-xs font-bold ${
                hecho
                  ? 'border-lago bg-lago text-white'
                  : ahora
                    ? 'border-terracota bg-terracota-claro text-terracota-oscuro ring-4 ring-terracota/20'
                    : 'border-borde bg-papel text-suave'
              }`}
            >
              {hecho ? <Icono nombre="check" className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={`text-[11px] leading-tight sm:text-xs ${ahora ? 'font-bold text-tinta' : 'text-suave'}`}>{t}</span>
          </li>
        );
      })}
    </ol>
  );
}
