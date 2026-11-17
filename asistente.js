const { createGateway, generateObject, ToolLoopAgent, tool, stepCountIs } = require('ai');
const { z } = require('zod');
const { queryAll, runSql } = require('./database');

// Vercel AI Gateway: una sola API key para acceder a los modelos.
// En local se lee de .env (dotenv se carga en server.js); en Render, del panel de env vars.
const API_KEY = process.env.VERCEL_AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_API_KEY;
const MODELO = 'google/gemini-2.5-flash'; // visión + tool-calling, disponible en el free tier de AI Gateway

const asistenteDisponible = Boolean(API_KEY);
const gateway = asistenteDisponible ? createGateway({ apiKey: API_KEY }) : null;

// ============ ANÁLISIS DE FOTO ============
// La tía saca una foto y la IA sugiere qué es, nombre, precio y frase.
async function analizarFoto(buffer, mediaType) {
  const { object } = await generateObject({
    model: gateway(MODELO),
    schema: z.object({
      objeto: z.string().describe('Qué objeto se ve en la foto, en una o dos palabras (ej: "taza", "florero")'),
      titulo: z.string().describe('Nombre corto y atractivo para vender la pieza (ej: "Taza hoja verde")'),
      precio: z.number().int().describe('Precio sugerido en pesos argentinos, solo el número entero'),
      frase: z.string().describe('Frase corta, cálida y artesanal contando algo lindo de la pieza'),
    }),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'file', mediaType: mediaType || 'image/jpeg', data: buffer },
          {
            type: 'text',
            text: 'Esta es una foto de una pieza de cerámica artesanal que una ceramista quiere vender en su tienda online. Identificá qué objeto es y sugerí un nombre de venta, un precio razonable en pesos argentinos para cerámica artesanal, y una frase cálida que la acompañe.',
          },
        ],
      },
    ],
  });
  return object;
}

// ============ AGENTE DE COMANDOS ============
// Interpreta lo que pide la tía (por voz o texto) y actúa sobre los productos.
function buscarProductoPorId(id) {
  return queryAll('SELECT * FROM productos WHERE id = ?', [id])[0];
}

const agente = asistenteDisponible
  ? new ToolLoopAgent({
      model: gateway(MODELO),
      instructions: `Sos el asistente del taller de cerámica de la tía. Ella te habla en español rioplatense, de forma simple, a veces por voz (puede haber errores de transcripción).
Podés gestionar las piezas del taller: editarlas, pausarlas/reactivarlas, darlas de baja, marcarlas como vendidas y reportar ventas.

Reglas:
- NUNCA afirmes que hiciste una acción (editar, pausar, vender) sin haber llamado antes a la herramienta correspondiente y haber recibido su resultado. Si no llamaste a la herramienta, la acción NO se hizo.
- ANTES de actuar sobre una pieza, usá listarProductos para encontrar su id. La tía nunca sabe el id, te dice el nombre (ej: "la taza verde").
- Si varias piezas coinciden con lo que describe, NO actúes: preguntale cuál de ellas (mencioná los nombres exactos).
- Si ninguna pieza coincide, decíselo con amabilidad.
- "Dar de baja" o "deshabilitar" significa cambiar el estado a 'pausado' (queda oculta de la web pero no se borra). Nunca borres piezas.
- Para reportes de ventas usá reporteVentas con el período que te pidan y contale el total y la lista de piezas vendidas.
- Respondé siempre en español, corto, cálido y claro: la respuesta se lee en voz alta. No uses markdown ni listas con guiones; hablá en oraciones.
- Confirmá siempre qué hiciste, con el nombre de la pieza (ej: "Listo, pausé la Taza hoja verde").`,
      tools: {
        listarProductos: tool({
          description: 'Lista las piezas del taller con su id, nombre, precio y estado. Usalo siempre antes de editar, pausar, vender o dar de baja una pieza.',
          inputSchema: z.object({
            estado: z.enum(['visible', 'pausado', 'vendido', 'todos']).default('todos')
              .describe('Filtrar por estado, o "todos" para ver todo'),
          }),
          execute: async ({ estado }) => {
            const filas = estado === 'todos'
              ? queryAll('SELECT id, titulo, precio, estado FROM productos ORDER BY creado DESC')
              : queryAll('SELECT id, titulo, precio, estado FROM productos WHERE estado = ? ORDER BY creado DESC', [estado]);
            return { productos: filas };
          },
        }),

        editarProducto: tool({
          description: 'Edita el nombre, el precio y/o la frase de una pieza. Solo se modifican los campos que se pasen.',
          inputSchema: z.object({
            id: z.number().int().describe('Id de la pieza (obtenelo con listarProductos)'),
            titulo: z.string().optional().describe('Nuevo nombre'),
            precio: z.string().optional().describe('Nuevo precio, solo el número (ej: "4500")'),
            frase: z.string().optional().describe('Nueva frase'),
          }),
          execute: async ({ id, titulo, precio, frase }) => {
            const actual = buscarProductoPorId(id);
            if (!actual) return { error: `No existe la pieza con id ${id}` };
            runSql(
              'UPDATE productos SET titulo = ?, precio = ?, frase = ? WHERE id = ?',
              [titulo ?? actual.titulo, precio ?? actual.precio, frase ?? actual.frase, id]
            );
            return { ok: true, titulo: titulo ?? actual.titulo };
          },
        }),

        cambiarEstado: tool({
          description: 'Pausa (oculta de la web, "dar de baja", "deshabilitar") o reactiva una pieza.',
          inputSchema: z.object({
            id: z.number().int().describe('Id de la pieza'),
            estado: z.enum(['visible', 'pausado']).describe('visible = reactivar, pausado = dar de baja'),
          }),
          execute: async ({ id, estado }) => {
            const actual = buscarProductoPorId(id);
            if (!actual) return { error: `No existe la pieza con id ${id}` };
            runSql('UPDATE productos SET estado = ? WHERE id = ?', [estado, id]);
            return { ok: true, titulo: actual.titulo, estado };
          },
        }),

        marcarVendido: tool({
          description: 'Marca una pieza como vendida (queda fuera de la web y registra la fecha de venta).',
          inputSchema: z.object({
            id: z.number().int().describe('Id de la pieza'),
            precioFinal: z.string().optional().describe('Precio final de venta si fue distinto al publicado'),
          }),
          execute: async ({ id, precioFinal }) => {
            const actual = buscarProductoPorId(id);
            if (!actual) return { error: `No existe la pieza con id ${id}` };
            runSql(
              "UPDATE productos SET estado = 'vendido', vendido_en = CURRENT_TIMESTAMP, precio = COALESCE(?, precio) WHERE id = ?",
              [precioFinal ?? null, id]
            );
            return { ok: true, titulo: actual.titulo };
          },
        }),

        reporteVentas: tool({
          description: 'Reporte de piezas vendidas: cuántas se vendieron, el total en pesos y la lista de piezas.',
          inputSchema: z.object({
            periodo: z.enum(['hoy', 'semana', 'mes', 'todo'])
              .describe('hoy, semana = últimos 7 días, mes = mes calendario actual, todo = histórico'),
          }),
          execute: async ({ periodo }) => {
            const filtro = {
              hoy: "AND date(vendido_en) = date('now', 'localtime')",
              semana: "AND datetime(vendido_en) >= datetime('now', '-7 days')",
              mes: "AND strftime('%Y-%m', vendido_en) = strftime('%Y-%m', 'now')",
              todo: '',
            }[periodo];
            const filas = queryAll(
              `SELECT titulo, precio, vendido_en FROM productos
               WHERE estado = 'vendido' ${filtro} ORDER BY vendido_en DESC`
            );
            const total = filas.reduce((suma, p) => suma + (Number(p.precio) || 0), 0);
            return { periodo, cantidad: filas.length, total, vendidas: filas };
          },
        }),
      },
      stopWhen: stepCountIs(5),
    })
  : null;

async function ejecutarComando(texto) {
  const resultado = await agente.generate({ prompt: texto });
  return { texto: resultado.text };
}

module.exports = { asistenteDisponible, analizarFoto, ejecutarComando };
