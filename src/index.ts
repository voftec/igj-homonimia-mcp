#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";
import * as cheerio from "cheerio";
import * as https from "https";
import { randomUUID } from "crypto";

const TARGET_URL = "https://www2.jus.gov.ar/igj-homonimia/";
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Tipos de resultado parseado
interface Match {
  razonSocial: string;
  tipo: string;
  estado: string;
}

interface ParsedResults {
  matches: Match[];          // Coincidencias estructuradas extraídas de la tabla (sin transformaciones)
  message: string;           // Mensaje literal del IGJ extraído del HTML (sin inferencias)
  hasResultPanel: boolean;   // True si encontró el panel "Resultados:" en el HTML
}

// Simple in-memory cache
interface CacheEntry {
  results: ParsedResults;
  timestamp: Date;
  source: string;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

// Pending CAPTCHA sessions (waiting for user/LLM to solve)
interface PendingSession {
  cookies: string;
  viewState: string;
  viewStateGen: string;
  eventValidation: string;
  testBox: string;
  denominacion: string;
  categoria: string;
  categoriaNombre: string;
  createdAt: Date;
}

const pendingSessions = new Map<string, PendingSession>();
const SESSION_TTL = 5 * 60 * 1000; // 5 minutos

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of pendingSessions.entries()) {
    if (now - s.createdAt.getTime() > SESSION_TTL) pendingSessions.delete(id);
  }
}, 60 * 1000);

// Helper: Get from cache
function getFromCache(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp.getTime() > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry;
}

// Helper: Set cache
function setCache(key: string, results: ParsedResults, source: string): void {
  cache.set(key, {
    results,
    timestamp: new Date(),
    source
  });
}

// Helper: Parse results from HTML - extrae literalmente lo que IGJ devuelve, sin inferencias
function parseResultsFromHTML(html: string): ParsedResults {
  const $ = cheerio.load(html);
  const matches: Match[] = [];
  
  // 1. Tabla de coincidencias (extracción literal de celdas)
  $("#ctl00_ContentPlaceHolder1_gvHomonimia tr").each((i, el) => {
    if (i === 0) return; // skip header
    const cols = $(el).find("td");
    if (cols.length >= 3) {
      matches.push({
        razonSocial: $(cols[0]).text().trim(),
        tipo: $(cols[1]).text().trim(),
        estado: $(cols[2]).text().trim()
      });
    }
  });
  
  // 2. Mensaje literal del panel "Resultados:" de la página
  let message = '';
  let hasResultPanel = false;
  
  // Buscar el fieldset cuya legend dice "Resultados"
  const fieldset = $('fieldset').filter((_, el) => /Resultados/i.test($(el).find('legend').text())).first();
  if (fieldset.length > 0) {
    hasResultPanel = true;
    // Extraer SOLO el texto visible, sin botones ni elementos accesorios
    const clone = fieldset.clone();
    clone.find('legend, input, button, script, style').remove();
    // Quitar el "Importante:" boilerplate fijo del pie
    let raw = clone.text();
    const importanteIdx = raw.search(/Importante:/i);
    if (importanteIdx > 0) raw = raw.substring(0, importanteIdx);
    message = raw.replace(/\s+/g, ' ').trim();
  }
  
  return { matches, message, hasResultPanel };
}

// Helper: Format results (transmite literalmente lo del IGJ, sin invenciones)
function formatResults(parsed: ParsedResults, metadata: any): string {
  let output = `# Resultados de Consulta de Homonimia (IGJ)\n\n`;
  output += `**Fuente:** ${metadata.source}\n`;
  if (metadata.latency !== undefined) output += `**Latencia:** ${metadata.latency}ms\n`;
  output += `**Timestamp:** ${new Date().toISOString()}\n\n`;
  
  // Mensaje literal del IGJ
  if (parsed.message) {
    output += `## Mensaje del IGJ (literal)\n\n> ${parsed.message}\n\n`;
  } else if (parsed.hasResultPanel) {
    output += `## Panel de resultados detectado pero vacío\n\nEl portal IGJ retornó el panel "Resultados:" sin texto. Verificar manualmente.\n\n`;
  } else {
    output += `## Sin panel de resultados\n\nNo se detectó el panel "Resultados:" en la respuesta HTML del portal IGJ. La consulta puede no haberse procesado correctamente. Verificar manualmente en https://www2.jus.gov.ar/igj-homonimia/\n\n`;
  }
  
  // Tabla de matches (datos crudos)
  if (parsed.matches.length > 0) {
    output += `## Coincidencias en tabla (${parsed.matches.length})\n\n`;
    output += `| Razón Social | Tipo Societario | Estado |\n`;
    output += `|---|---|---|\n`;
    parsed.matches.forEach(r => {
      output += `| ${r.razonSocial} | ${r.tipo} | ${r.estado} |\n`;
    });
    output += `\n`;
  }
  
  output += `\n---\n*Información extraída literalmente del portal IGJ. No se realizaron inferencias.*\n`;
  
  return output;
}

// Helper: Step 1 - GET initial page, capture state, download CAPTCHA image, return session
async function iniciarConsultaHTTP(denominacion: string, categoria: string, categoriaNombre: string): Promise<{ sessionId: string, imageBase64: string, mimeType: string }> {
  // GET initial page
  const getRes = await axios.get(TARGET_URL, {
    httpsAgent,
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  
  const setCookies = getRes.headers['set-cookie'] || [];
  const cookies = setCookies.map(c => c.split(';')[0]).join('; ');
  const $ = cheerio.load(getRes.data);
  
  const viewState = $('input[name="__VIEWSTATE"]').val() as string;
  const viewStateGen = $('input[name="__VIEWSTATEGENERATOR"]').val() as string;
  const eventValidation = $('input[name="__EVENTVALIDATION"]').val() as string;
  const testBox = $('input[name="ctl00$testBox"]').val() as string || "yes";
  const captchaSrc = $('img[id*="aptcha"], img[src*="aptcha"], img[src*="Captcha"], img[src*="captcha"]').attr('src');
  
  if (!viewState) throw new Error("No se pudo obtener __VIEWSTATE de la página inicial");
  if (!captchaSrc) throw new Error("No se pudo localizar la imagen CAPTCHA en la página");
  
  // Download CAPTCHA image with same session cookies
  const captchaUrl = new URL(captchaSrc, TARGET_URL).href;
  const imgRes = await axios.get(captchaUrl, {
    httpsAgent,
    responseType: 'arraybuffer',
    headers: {
      "Cookie": cookies,
      "Referer": TARGET_URL,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    },
    timeout: 10000
  });
  
  const imageBase64 = Buffer.from(imgRes.data).toString('base64');
  const mimeType = (imgRes.headers['content-type'] as string) || 'image/jpeg';
  
  // Store session
  const sessionId = randomUUID();
  pendingSessions.set(sessionId, {
    cookies, viewState, viewStateGen, eventValidation, testBox,
    denominacion, categoria, categoriaNombre,
    createdAt: new Date()
  });
  
  return { sessionId, imageBase64, mimeType };
}

// Helper: Step 2 - POST form with CAPTCHA answer, return parsed results
async function enviarCaptchaHTTP(sessionId: string, captchaText: string): Promise<{ html: string, success: boolean, captchaError: boolean }> {
  const session = pendingSessions.get(sessionId);
  if (!session) {
    throw new Error("Sesión no encontrada o expirada. Inicie una nueva consulta.");
  }
  
  const formData = new URLSearchParams();
  formData.append("__VIEWSTATE", session.viewState);
  formData.append("__VIEWSTATEGENERATOR", session.viewStateGen);
  formData.append("__EVENTVALIDATION", session.eventValidation);
  formData.append("ctl00$testBox", session.testBox);
  formData.append("ctl00$ContentPlaceHolder1$drpDwnTipoSocietario", session.categoria);
  formData.append("ctl00$ContentPlaceHolder1$txtDnmScl", session.denominacion);
  formData.append("ctl00$ContentPlaceHolder1$txtCaptcha", captchaText);
  formData.append("ctl00$ContentPlaceHolder1$btnAceptar", "Aceptar");
  
  const postRes = await axios.post(TARGET_URL, formData.toString(), {
    httpsAgent,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": session.cookies,
      "Referer": TARGET_URL,
      "Origin": "https://www2.jus.gov.ar",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    },
    timeout: 15000,
    maxRedirects: 5,
    validateStatus: (s) => s < 500
  });
  
  pendingSessions.delete(sessionId);
  
  const html = postRes.data as string;
  const captchaError = /no concuerda|captcha incorrecto|código ingresado/i.test(html);
  const success = !captchaError && postRes.status === 200;
  
  return { html, success, captchaError };
}

// Categorías oficiales del portal IGJ Homonimia (extraídas vía ingeniería de reversa)
const CATEGORIAS_IGJ: Array<{ codigo: string, nombre: string, slug: string }> = [
  { codigo: "010", nombre: "SOCIEDAD COLECTIVA", slug: "sociedad_colectiva" },
  { codigo: "020", nombre: "SOCIEDAD EN COMANDITA SIMPLE", slug: "comandita_simple" },
  { codigo: "030", nombre: "SOCIEDAD DE CAPITAL E INDUSTRIA", slug: "capital_e_industria" },
  { codigo: "040", nombre: "SOCIEDAD DE RESPONSABILIDAD LIMITADA", slug: "srl" },
  { codigo: "050", nombre: "SOCIEDAD ANONIMA", slug: "sa" },
  { codigo: "055", nombre: "SOCIEDAD DEL ESTADO", slug: "sociedad_del_estado" },
  { codigo: "060", nombre: "SOCIEDAD EN COMANDITA POR ACCIONES", slug: "comandita_por_acciones" },
  { codigo: "070", nombre: "SOCIEDAD DE HECHO", slug: "sociedad_de_hecho" },
  { codigo: "080", nombre: "SOCIEDAD CONSTITUIDA EN EL EXTRANJERO", slug: "extranjera" },
  { codigo: "090", nombre: "SOCIEDAD BINACIONAL FUERA DE JUSRISDICCION", slug: "binacional" },
  { codigo: "100", nombre: "ASOCIACION CIVIL", slug: "asociacion_civil" },
  { codigo: "105", nombre: "ENTIDAD EXTRANJERA SIN FINES DE LUCRO", slug: "entidad_extranjera_sin_lucro" },
  { codigo: "110", nombre: "FUNDACION", slug: "fundacion" },
  { codigo: "115", nombre: "SIMPLES ASOCIACIONES", slug: "simples_asociaciones" },
  { codigo: "120", nombre: "FEDERACION", slug: "federacion" },
  { codigo: "130", nombre: "CONFEDERACION", slug: "confederacion" },
  { codigo: "140", nombre: "CAMARA", slug: "camara" },
  { codigo: "150", nombre: "CONTRATO DE COLABORACION EMPRESARIA", slug: "contrato_colaboracion" },
  { codigo: "160", nombre: "SOCIEDADES NO REGISTRADAS", slug: "no_registradas" },
  { codigo: "170", nombre: "UNION TRANSITORIA DE EMPRESAS", slug: "ute" },
  { codigo: "180", nombre: "SOCIEDAD DE GARANTIA RECIPROCA", slug: "sgr" },
  { codigo: "190", nombre: "SOC. CAPITALIZACION Y AHORRO, PROVINCIAL", slug: "capitalizacion_ahorro" },
  { codigo: "210", nombre: "COMERCIANTE", slug: "comerciante" },
  { codigo: "215", nombre: "CONSORCIO DE COOPERACION", slug: "consorcio_cooperacion" },
  { codigo: "220", nombre: "MARTILLERO", slug: "martillero" },
  { codigo: "222", nombre: "AGENTE DE BOLSA", slug: "agente_de_bolsa" },
  { codigo: "225", nombre: "MARTILLERO Y CORREDOR", slug: "martillero_y_corredor" },
  { codigo: "230", nombre: "CORREDOR", slug: "corredor" },
  { codigo: "240", nombre: "DESPACHANTE DE ADUANA", slug: "despachante_aduana" },
  { codigo: "250", nombre: "PERSONA FISICA NO REGISTRADA", slug: "persona_fisica" },
];

// Helper: Register a tool for a specific category (HTTP-only, returns CAPTCHA image)
function registerCategoryTool(server: McpServer, cat: { codigo: string, nombre: string, slug: string }) {
  server.tool(
    `consultar_homonimia_${cat.slug}`,
    `Inicia verificación de homonimia como ${cat.nombre} (código ${cat.codigo}). Devuelve la imagen CAPTCHA - léala y luego llame a \`enviar_captcha_homonimia\` con el texto + session_id retornado.`,
    {
      denominacion: z.string().min(3).max(200).describe("Denominación social a verificar"),
      ignorar_cache: z.boolean().optional().default(false).describe("Ignorar cache y forzar consulta nueva")
    },
    async (args) => {
      const startTime = Date.now();
      try {
        const normalized = args.denominacion.trim().toUpperCase();
        const cacheKey = `${cat.codigo}:${normalized}`;
        
        if (!args.ignorar_cache) {
          const cached = getFromCache(cacheKey);
          if (cached) {
            return {
              content: [{
                type: "text",
                text: `**Categoría:** ${cat.nombre} (${cat.codigo})\n\n` + formatResults(cached.results, {
                  source: 'cache',
                  timestamp: cached.timestamp,
                  latency: Date.now() - startTime
                })
              }]
            };
          }
        }
        
        const { sessionId, imageBase64, mimeType } = await iniciarConsultaHTTP(normalized, cat.codigo, cat.nombre);
        
        return {
          content: [
            {
              type: "image",
              data: imageBase64,
              mimeType: mimeType
            },
            {
              type: "text",
              text: `# Verificación de Homonimia - Paso 1/2\n\n**Categoría:** ${cat.nombre} (${cat.codigo})\n**Denominación:** ${normalized}\n**Session ID:** \`${sessionId}\`\n\n## Próximo paso\n\nLea el código CAPTCHA mostrado en la imagen y llame a:\n\n\`\`\`\nenviar_captcha_homonimia({\n  session_id: "${sessionId}",\n  captcha: "<TEXTO_DEL_CAPTCHA>"\n})\n\`\`\`\n\nLa sesión expira en 5 minutos.`
            }
          ]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error en consultar_homonimia_${cat.slug}: ${message}` }],
          isError: true
        };
      }
    }
  );
}

export function registerAllTools(server: McpServer) {
  // Registrar 30 herramientas, una por cada categoría societaria
  CATEGORIAS_IGJ.forEach(cat => registerCategoryTool(server, cat));

  // enviar_captcha_homonimia (paso 2 del flujo: envía la respuesta del CAPTCHA y devuelve resultados)
  server.tool(
    "enviar_captcha_homonimia",
    "Paso 2 del flujo de consulta: envía el texto del CAPTCHA leído de la imagen retornada por consultar_homonimia_<categoria> y devuelve los resultados de homonimia.",
    {
      session_id: z.string().describe("ID de sesión retornado por consultar_homonimia_<categoria>"),
      captcha: z.string().min(1).max(20).describe("Texto del CAPTCHA leído de la imagen")
    },
    async (args) => {
      const startTime = Date.now();
      try {
        const session = pendingSessions.get(args.session_id);
        if (!session) {
          return {
            content: [{ type: "text", text: `# Error: Sesión no encontrada\n\nLa sesión \`${args.session_id}\` no existe o expiró (TTL 5 min). Inicie una nueva consulta con \`consultar_homonimia_<categoria>\`.` }],
            isError: true
          };
        }
        
        const { html, success, captchaError } = await enviarCaptchaHTTP(args.session_id, args.captcha.trim());
        
        if (captchaError) {
          return {
            content: [{ type: "text", text: `# CAPTCHA incorrecto\n\n**Categoría:** ${session.categoriaNombre}\n**Denominación:** ${session.denominacion}\n**CAPTCHA enviado:** ${args.captcha}\n\nInicie una nueva consulta con \`consultar_homonimia_<categoria>\` para obtener un nuevo CAPTCHA.` }],
            isError: true
          };
        }
        
        if (!success) {
          return {
            content: [{ type: "text", text: `# Error inesperado al enviar consulta\n\nNo se obtuvo respuesta exitosa del portal IGJ. Reintente.` }],
            isError: true
          };
        }
        
        const results = parseResultsFromHTML(html);
        const cacheKey = `${session.categoria}:${session.denominacion}`;
        setCache(cacheKey, results, 'http_hitl');
        
        return {
          content: [{
            type: "text",
            text: `**Categoría:** ${session.categoriaNombre} (${session.categoria})\n\n` + formatResults(results, {
              source: 'http_hitl',
              latency: Date.now() - startTime
            })
          }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error en enviar_captcha_homonimia: ${message}` }],
          isError: true
        };
      }
    }
  );

  // consultar_homonimia (genérica con parámetro categoría obligatorio - paso 1)
  server.tool(
    "consultar_homonimia",
    "Inicia verificación de homonimia (paso 1/2). Devuelve imagen CAPTCHA + session_id. Use luego `enviar_captcha_homonimia`. Requiere especificar la categoría societaria explícitamente (no asume default).",
    {
      denominacion: z.string().min(3).max(200).describe("Denominación social a verificar"),
      categoria: z.string().describe("Tipo societario REQUERIDO. Use el código oficial IGJ (010, 020, 030, 040, 050, 055, 060, 070, 080, 090, 100, 105, 110, 115, 120, 130, 140, 150, 160, 170, 180, 190, 210, 215, 220, 222, 225, 230, 240, 250) o el nombre exacto. Ver lista completa con las herramientas consultar_homonimia_<categoria>."),
      ignorar_cache: z.boolean().optional().default(false).describe("Ignorar cache y forzar consulta nueva")
    },
    async (args) => {
      const startTime = Date.now();
      try {
        const normalized = args.denominacion.trim().toUpperCase();
        
        // Resolver categoría - SOLO match exacto contra catálogo oficial IGJ, sin inferencias
        const catUpper = args.categoria.trim().toUpperCase();
        const found = CATEGORIAS_IGJ.find(c =>
          c.codigo === args.categoria.trim() ||
          c.nombre.toUpperCase() === catUpper
        );
        
        if (!found) {
          const validList = CATEGORIAS_IGJ.map(c => `${c.codigo}=${c.nombre}`).join('\n');
          return {
            content: [{
              type: "text",
              text: `# Error: categoría no reconocida\n\nValor recibido: "${args.categoria}"\n\nDebe usar uno de los códigos oficiales o nombres exactos del IGJ:\n\n${validList}`
            }],
            isError: true
          };
        }
        
        const catCodigo = found.codigo;
        const catNombre = found.nombre;
        const cacheKey = `${catCodigo}:${normalized}`;
        
        // Check cache
        if (!args.ignorar_cache) {
          const cached = getFromCache(cacheKey);
          if (cached) {
            return {
              content: [{
                type: "text",
                text: `**Categoría:** ${catNombre} (${catCodigo})\n\n` + formatResults(cached.results, {
                  source: 'cache',
                  timestamp: cached.timestamp,
                  latency: Date.now() - startTime
                })
              }]
            };
          }
        }
        
        const { sessionId, imageBase64, mimeType } = await iniciarConsultaHTTP(normalized, catCodigo, catNombre);
        
        return {
          content: [
            { type: "image", data: imageBase64, mimeType: mimeType },
            {
              type: "text",
              text: `# Verificación de Homonimia - Paso 1/2\n\n**Categoría:** ${catNombre} (${catCodigo})\n**Denominación:** ${normalized}\n**Session ID:** \`${sessionId}\`\n\nLea el CAPTCHA de la imagen y llame a \`enviar_captcha_homonimia\` con \`session_id\` + \`captcha\`. Expira en 5 min.`
            }
          ]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error en consultar_homonimia: ${message}` }],
          isError: true
        };
      }
    }
  );

}

export function registerAllPrompts(server: McpServer) {
  server.prompt(
    "igj_analisis_integral_sociedad",
    "Prompt para analizar integralmente una sociedad (nombre, tipo, estado).",
    { denominacion: z.string(), tipo: z.string() },
    ({ denominacion, tipo }) => ({
      messages: [{ role: "user", content: { type: "text", text: `Actua como un abogado corporativo argentino experto en IGJ. Analiza la viabilidad, riesgos y recomendaciones para constituir una sociedad denominada "${denominacion}" bajo el tipo "${tipo}".` } }]
    })
  );

  server.prompt(
    "igj_guia_constitucion",
    "Guia paso a paso para constituir una sociedad en IGJ.",
    { tipo: z.string() },
    ({ tipo }) => ({
      messages: [{ role: "user", content: { type: "text", text: `Dame una guia legal paso a paso con los requisitos formales de la IGJ (Inspeccion General de Justicia) para constituir una sociedad de tipo "${tipo}" en CABA (Argentina).` } }]
    })
  );

  server.prompt(
    "igj_instrucciones_hitl",
    "Instrucciones sobre cómo usar el flujo HTTP+CAPTCHA imagen en 2 pasos",
    {},
    () => ({
      messages: [{ role: "user", content: { type: "text", text: "Para consultar homonimia en IGJ: (1) Llama a consultar_homonimia_<categoria>(denominacion=...) - devuelve imagen CAPTCHA + session_id. (2) Lee el texto del CAPTCHA de la imagen. (3) Llama a enviar_captcha_homonimia(session_id, captcha=<texto>) para obtener los resultados. La sesión expira en 5 minutos." } }]
    })
  );
}

// Initialize the local server instance
export const server = new McpServer({
  name: "igj-homonimia-mcp",
  version: "3.1.0"
});

// Register tools
registerAllTools(server);
registerAllPrompts(server);

// Connect with stdio (only when run directly and not in Vercel/Next environment)
if (typeof process !== "undefined" && !process.env.VERCEL && !process.env.NEXT_RUNTIME && process.env.NODE_ENV !== "production") {
  const transport = new StdioServerTransport();
  server.connect(transport).catch((err) => {
    console.error("Server connection failed", err);
    process.exit(1);
  });
  console.error("IGJ - Consulta de Homonimia Societaria MCP Server v3.0.0 (HTTP+CAPTCHA-image) is running via Stdio.");
}
