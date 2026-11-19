import { BadRequestException, HttpException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { contexto } from './contexto.js';
import { FiltroErrores } from './errores.filter.js';

function host() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const h = { getType: () => 'http', switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({}) }), getArgByIndex: () => res, getArgs: () => [{}, res] };
  return { h: h as unknown as ArgumentsHost, res };
}

describe('FiltroErrores', () => {
  const adaptador = { reply: vi.fn(), isHeadersSent: () => false, end: vi.fn() };
  const filtro = new FiltroErrores(adaptador as never);

  it('responde un error interno genérico con el código de seguimiento', () => {
    const { h, res } = host();
    contexto.run({ requestId: 'abc123' }, () => filtro.catch(new Error('Invalid object name rep.secreto'), h));
    expect(res.status).toHaveBeenCalledWith(500);
    const cuerpo = res.json.mock.calls[0][0];
    expect(cuerpo.requestId).toBe('abc123');
    expect(cuerpo.message).toContain('abc123');
    expect(cuerpo.message).not.toContain('rep.secreto');
  });

  it('deja pasar los errores 4xx con su mensaje', () => {
    const { h, res } = host();
    filtro.catch(new BadRequestException('Fila 3: peso inválido'), h);
    expect(res.status).not.toHaveBeenCalled();
    expect(adaptador.reply).toHaveBeenCalledWith(res, expect.objectContaining({ message: 'Fila 3: peso inválido' }), 400);
  });

  it('mantiene la respuesta de un HttpException 5xx explícito', () => {
    const { h } = host();
    filtro.catch(new HttpException('Servicio no disponible', 503), h);
    expect(adaptador.reply).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ statusCode: 503 }), 503);
  });
});
