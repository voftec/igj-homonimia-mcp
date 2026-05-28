# Argentina IGJ Homonimia MCP v3.1.0

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/Model_Context_Protocol-1.5.0-green.svg)](https://modelcontextprotocol.io/)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black.svg?logo=vercel)](https://igj-homonimia-mcp.vercel.app)
[![NPM Version](https://img.shields.io/npm/v/igj-homonimia-mcp?color=cb3837&logo=npm)](https://www.npmjs.com/package/igj-homonimia-mcp)

Servidor MCP (Model Context Protocol) para consultar homonimia societaria de la **Inspección General de Justicia (IGJ)**. Conecta cualquier LLM compatible (Claude, Cursor, Windsurf) con el portal oficial de la IGJ para verificar la disponibilidad de denominaciones sociales.

**Arquitectura HTTP-only** — sin Puppeteer, sin Chromium. Flujo en 2 pasos con CAPTCHA como imagen base64.

---

## 🚀 Características Principales

*   **HTTP-only**: Axios + Cheerio, sin dependencias pesadas (~2 MB vs ~170 MB con Puppeteer)
*   **Flujo en 2 pasos**: Tool devuelve imagen CAPTCHA → LLM/usuario lee → enviar_captcha_homonimia con el texto
*   **30 categorías societarias**: Tools dedicadas por tipo (SA, SRL, Fundación, Asociación Civil, etc.)
*   **Cache inteligente**: TTL 24h por categoría + denominación
*   **Parser literal**: Transmite mensajes del IGJ sin invenciones ni inferencias
*   **100% datos reales**: Sin herramientas simuladas, todas acceden al portal oficial

---

## ⚠️ CAPTCHA por Consulta

El portal de la IGJ requiere validación CAPTCHA visual **para cada consulta**.

### Flujo de trabajo

```
1. consultar_homonimia_sa(denominacion="ACME")
   ← [imagen CAPTCHA] + session_id

2. LLM lee la imagen (o usuario la lee del chat)

3. enviar_captcha_homonimia(session_id="...", captcha="ABCD1")
   ← Resultados parseados del IGJ
```

**Ventaja:** El LLM con visión puede resolver el CAPTCHA automáticamente sin intervención humana. Si falla, el usuario ve la imagen en el chat y escribe el texto.

**Limitación:** Cada consulta requiere resolver un CAPTCHA nuevo. No es eficiente para consultas masivas.

---

## 🛠️ Instalación y Configuración

Requiere [Node.js](https://nodejs.org/) v18+.

### Cursor IDE / Windsurf

1. Configuración → MCP → + Add New MCP Server
2. **Name:** `igj-homonimia-mcp`
3. **Type:** `command`
4. **Command:** `node`
5. **Args:** `D:/MCP/Legales/09-igj-homonimia-mcp/Argentina-IgjHomonimia-MCP/build/index.js`
6. **Env:** `NODE_TLS_REJECT_UNAUTHORIZED=0`

### Claude Desktop

Archivo `C:\Users\<TuUsuario>\AppData\Roaming\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "igj-homonimia-mcp": {
      "command": "node",
      "args": ["D:/MCP/Legales/09-igj-homonimia-mcp/Argentina-IgjHomonimia-MCP/build/index.js"],
      "env": {
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

> [!IMPORTANT]
> `NODE_TLS_REJECT_UNAUTHORIZED=0` es necesario para problemas SSL de sitios gubernamentales argentinos.

---

## 💻 Instalación Manual (Desarrolladores)

```bash
cd 09-igj-homonimia-mcp/Argentina-IgjHomonimia-MCP
npm install
npm run build
npm start
```

---

## ⚖️ Herramientas Disponibles (32 Tools)

### Tools por Categoría (30)

| Tool | Categoría IGJ | Código |
|---|---|---|
| `consultar_homonimia_sociedad_colectiva` | SOCIEDAD COLECTIVA | 010 |
| `consultar_homonimia_comandita_simple` | SOCIEDAD EN COMANDITA SIMPLE | 020 |
| `consultar_homonimia_capital_e_industria` | SOCIEDAD DE CAPITAL E INDUSTRIA | 030 |
| `consultar_homonimia_srl` | SOCIEDAD DE RESPONSABILIDAD LIMITADA | 040 |
| `consultar_homonimia_sa` | SOCIEDAD ANONIMA | 050 |
| `consultar_homonimia_sociedad_del_estado` | SOCIEDAD DEL ESTADO | 055 |
| `consultar_homonimia_comandita_por_acciones` | SOCIEDAD EN COMANDITA POR ACCIONES | 060 |
| `consultar_homonimia_sociedad_de_hecho` | SOCIEDAD DE HECHO | 070 |
| `consultar_homonimia_extranjera` | SOCIEDAD CONSTITUIDA EN EL EXTRANJERO | 080 |
| `consultar_homonimia_binacional` | SOCIEDAD BINACIONAL FUERA DE JURISDICCION | 090 |
| `consultar_homonimia_asociacion_civil` | ASOCIACION CIVIL | 100 |
| `consultar_homonimia_entidad_extranjera_sin_lucro` | ENTIDAD EXTRANJERA SIN FINES DE LUCRO | 105 |
| `consultar_homonimia_fundacion` | FUNDACION | 110 |
| `consultar_homonimia_simples_asociaciones` | SIMPLES ASOCIACIONES | 115 |
| `consultar_homonimia_federacion` | FEDERACION | 120 |
| `consultar_homonimia_confederacion` | CONFEDERACION | 130 |
| `consultar_homonimia_camara` | CAMARA | 140 |
| `consultar_homonimia_contrato_colaboracion` | CONTRATO DE COLABORACION EMPRESARIA | 150 |
| `consultar_homonimia_no_registradas` | SOCIEDADES NO REGISTRADAS | 160 |
| `consultar_homonimia_ute` | UNION TRANSITORIA DE EMPRESAS | 170 |
| `consultar_homonimia_sgr` | SOCIEDAD DE GARANTIA RECIPROCA | 180 |
| `consultar_homonimia_capitalizacion_ahorro` | SOC. CAPITALIZACION Y AHORRO, PROVINCIAL | 190 |
| `consultar_homonimia_comerciante` | COMERCIANTE | 210 |
| `consultar_homonimia_consorcio_cooperacion` | CONSORCIO DE COOPERACION | 215 |
| `consultar_homonimia_martillero` | MARTILLERO | 220 |
| `consultar_homonimia_martillero_y_corredor` | MARTILLERO Y CORREDOR | 225 |
| `consultar_homonimia_agente_de_bolsa` | AGENTE DE BOLSA | 222 |
| `consultar_homonimia_corredor` | CORREDOR | 230 |
| `consultar_homonimia_despachante_aduana` | DESPACHANTE DE ADUANA | 240 |
| `consultar_homonimia_persona_fisica` | PERSONA FISICA NO REGISTRADA | 250 |

### Tools Core (2)

| Tool | Descripción |
|---|---|
| `consultar_homonimia` | Genérica con parámetro `categoria` obligatorio (código o nombre exacto) |
| `enviar_captcha_homonimia` | Paso 2 del flujo: envía texto del CAPTCHA y devuelve resultados |

Parámetros detallados: [TOOLS.md](./TOOLS.md).

---

## 📝 Licencia

MIT License. Ver [LICENSE](./LICENSE).
