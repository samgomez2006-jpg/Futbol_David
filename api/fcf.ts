// Función de Vercel: GET /api/fcf?op=… → datos públicos de la FCF normalizados (ver src/server/fcf.ts).
import { fcfResponse } from '../src/server/fcf.js';

export function GET(request: Request): Promise<Response> {
  return fcfResponse(new URL(request.url));
}
