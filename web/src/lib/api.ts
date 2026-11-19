const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${ruta}`, init);
  } catch {
    throw new ApiError('No se pudo conectar con el servidor de Utama. ¿Está encendido el backend?', 0);
  }
  const texto = await res.text();
  const datos = texto ? JSON.parse(texto) : null;
  if (!res.ok) {
    const m = datos?.message;
    throw new ApiError(Array.isArray(m) ? m.join(', ') : (m ?? `Error ${res.status}`), res.status);
  }
  return datos as T;
}

const json = (metodo: string, cuerpo?: unknown): RequestInit => ({
  method: metodo,
  headers: { 'content-type': 'application/json' },
  body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
});

export const api = {
  get: <T>(ruta: string) => pedir<T>(ruta),
  post: <T>(ruta: string, cuerpo?: unknown) => pedir<T>(ruta, json('POST', cuerpo ?? {})),
  put: <T>(ruta: string, cuerpo?: unknown) => pedir<T>(ruta, json('PUT', cuerpo ?? {})),
  patch: <T>(ruta: string, cuerpo?: unknown) => pedir<T>(ruta, json('PATCH', cuerpo ?? {})),
  del: <T>(ruta: string) => pedir<T>(ruta, { method: 'DELETE' }),
  /** Sube una imagen y devuelve su URL pública. */
  async subirFoto(archivo: File): Promise<string> {
    const form = new FormData();
    form.append('file', archivo);
    const r = await pedir<{ url: string }>('/uploads', { method: 'POST', body: form });
    return r.url;
  },
};

export function mensajeError(e: unknown): string {
  return e instanceof Error ? e.message : 'Ocurrió un error inesperado';
}
