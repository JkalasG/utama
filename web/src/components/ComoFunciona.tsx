const PASOS = [
  {
    n: '1',
    t: 'Verificamos',
    d: 'Revisamos el Folio Real y la identidad del dueño. Si hay una hipoteca o un anticrético inscrito, el inmueble se rechaza.',
  },
  {
    n: '2',
    t: 'Visitas',
    d: 'Agendas una visita en el calendario del dueño. La dirección exacta se revela solo cuando reservas.',
  },
  {
    n: '3',
    t: 'Pagas protegido',
    d: 'El dueño recibe la mayor parte al instante; entre el 10 y el 20 % queda de garantía en un contrato inteligente.',
  },
  {
    n: '4',
    t: 'Check-out',
    d: 'Con el inventario firmado y un check-out conforme se devuelve tu dinero y el folio queda libre.',
  },
];

/** Los cuatro pasos del flujo, sin cajas: columnas sobre el fondo de la página. */
export function ComoFunciona() {
  return (
    <section aria-labelledby="como-funciona" className="space-y-6 border-t-2 border-borde pt-10">
      <h2 id="como-funciona" className="text-2xl font-bold">Cómo funciona</h2>
      <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {PASOS.map((p) => (
          <li key={p.n} className="space-y-2">
            <span className="font-display text-5xl font-extrabold leading-none text-terracota">{p.n}</span>
            <h3 className="text-lg font-bold">{p.t}</h3>
            <p className="text-sm text-suave">{p.d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
