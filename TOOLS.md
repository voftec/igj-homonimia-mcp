# Herramientas del Servidor MCP IGJ Homonimia v3.1.0

Este servidor expone **32 herramientas (tools)** diseñadas para consultar homonimia societaria de la Inspección General de Justicia (IGJ) con datos reales del portal oficial.

**Arquitectura HTTP-only** — sin Puppeteer, sin Chromium. Flujo en 2 pasos con CAPTCHA como imagen base64.

---

## Flujo de Trabajo (2 Pasos)

```
PASO 1: consultar_homonimia_sa(denominacion="ACME")
         ← [imagen CAPTCHA] + session_id

PASO 2: enviar_captcha_homonimia(session_id="...", captcha="ABCD1")
         ← Resultados parseados del IGJ
```

**Quién resuelve el CAPTCHA:**
- **LLM con visión:** Claude/GPT-4 leen la imagen automáticamente (sin intervención humana)
- **Usuario:** Si el LLM falla, el usuario ve la imagen en el chat y escribe el texto

**Cache:** Si la misma denominación + categoría ya fue consultada (24h TTL), el paso 1 devuelve resultados desde cache sin pedir CAPTCHA.

---

## Tools por Categoría (30)

Todas las tools de categoría siguen el mismo patrón: devuelven imagen CAPTCHA + session_id en el paso 1.

### Sociedades Comerciales

#### `consultar_homonimia_sociedad_colectiva`
Código IGJ: 010

**Parámetros:**
- `denominacion` (string, requerido): Denominación social (3-200 caracteres)
- `ignorar_cache` (boolean, opcional, default: false)

**Ejemplo:**
```json
{
  "denominacion": "RODRIGUEZ Y CIA"
}
```

**Respuesta (Paso 1):**
```markdown
# Verificación de Homonimia - Paso 1/2

**Categoría:** SOCIEDAD COLECTIVA (010)
**Denominación:** RODRIGUEZ Y CIA
**Session ID:** `abc-123`

Lea el código CAPTCHA mostrado en la imagen y llame a:
enviar_captcha_homonimia({ session_id: "abc-123", captcha: "<TEXTO>" })
```

---

#### `consultar_homonimia_comandita_simple`
Código IGJ: 020

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_capital_e_industria`
Código IGJ: 030

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_srl`
Código IGJ: 040

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_sa`
Código IGJ: 050

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_sociedad_del_estado`
Código IGJ: 055

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_comandita_por_acciones`
Código IGJ: 060

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_sociedad_de_hecho`
Código IGJ: 070

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

### Sociedades Especiales y Extranjeras

#### `consultar_homonimia_extranjera`
Código IGJ: 080

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_binacional`
Código IGJ: 090

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

### Entidades Sin Fines de Lucro

#### `consultar_homonimia_asociacion_civil`
Código IGJ: 100

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_entidad_extranjera_sin_lucro`
Código IGJ: 105

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_fundacion`
Código IGJ: 110

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_simples_asociaciones`
Código IGJ: 115

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

### Asociaciones y Cámaras

#### `consultar_homonimia_federacion`
Código IGJ: 120

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_confederacion`
Código IGJ: 130

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_camara`
Código IGJ: 140

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

### Contratos y Uniones

#### `consultar_homonimia_contrato_colaboracion`
Código IGJ: 150

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_no_registradas`
Código IGJ: 160

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_ute`
Código IGJ: 170

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

### Sistema Financiero

#### `consultar_homonimia_sgr`
Código IGJ: 180

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_capitalizacion_ahorro`
Código IGJ: 190

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

### Matriculados y Comerciantes

#### `consultar_homonimia_comerciante`
Código IGJ: 210

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_consorcio_cooperacion`
Código IGJ: 215

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_martillero`
Código IGJ: 220

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_martillero_y_corredor`
Código IGJ: 225

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_agente_de_bolsa`
Código IGJ: 222

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_corredor`
Código IGJ: 230

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_despachante_aduana`
Código IGJ: 240

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

#### `consultar_homonimia_persona_fisica`
Código IGJ: 250

**Parámetros:** iguales a `consultar_homonimia_sociedad_colectiva`

---

## Tools Core (2)

### `consultar_homonimia` (Genérica)

Tool genérica con parámetro `categoria` obligatorio. Útil cuando el LLM elige dinámicamente la categoría.

**Parámetros:**
- `denominacion` (string, requerido): Denominación social (3-200 caracteres)
- `categoria` (string, requerido): Categoría por código oficial o nombre exacto
- `ignorar_cache` (boolean, opcional, default: false)

**Categorías válidas (código o nombre exacto):**
- Códigos: 010, 020, 030, 040, 050, 055, 060, 070, 080, 090, 100, 105, 110, 115, 120, 130, 140, 150, 160, 170, 180, 190, 210, 215, 220, 222, 225, 230, 240, 250
- Nombres: "SOCIEDAD COLECTIVA", "SOCIEDAD EN COMANDITA SIMPLE", "SOCIEDAD DE CAPITAL E INDUSTRIA", "SOCIEDAD DE RESPONSABILIDAD LIMITADA", "SOCIEDAD ANONIMA", etc.

**Ejemplo:**
```json
{
  "denominacion": "TECNOLOGIA ARGENTINA",
  "categoria": "050"
}
```

**Ejemplo con nombre:**
```json
{
  "denominacion": "TECNOLOGIA ARGENTINA",
  "categoria": "SOCIEDAD ANONIMA"
}
```

**Respuesta:** Igual a tools por categoría (imagen CAPTCHA + session_id)

---

### `enviar_captcha_homonimia` (Paso 2)

Envía el texto del CAPTCHA leído de la imagen y devuelve los resultados parseados del IGJ.

**Parámetros:**
- `session_id` (string, requerido): ID de sesión retornado por la tool de paso 1
- `captcha` (string, requerido): Texto del CAPTCHA leído de la imagen (1-20 caracteres)

**Ejemplo:**
```json
{
  "session_id": "abc-123-def-456",
  "captcha": "CLWX4"
}
```

**Respuesta (éxito):**
```markdown
**Categoría:** SOCIEDAD ANONIMA (050)

# Resultados de Consulta de Homonimia (IGJ)

**Fuente:** http_hitl
**Latencia:** 215ms
**Timestamp:** 2026-05-28T05:02:40.002Z

## Mensaje del IGJ (literal)

> La denominación ingresada 'TECNOLOGIA ARGENTINA' coincide con una ya registrada, por lo tanto será observado en la IGJ.

## Coincidencias en tabla (3)

| Razón Social | Tipo Societario | Estado |
|---|---|---|
| TECNOLOGIA ARGENTINA S.A. | SOCIEDAD ANONIMA | ACTIVA |
| TECNOLOGIA ARGENTINA S.R.L. | SOCIEDAD DE RESPONSABILIDAD LIMITADA | ACTIVA |
| TECNOLOGIA ARGENTINA S.C.S. | SOCIEDAD EN COMANDITA SIMPLE | ACTIVA |

---
*Información extraída literalmente del portal IGJ. No se realizaron inferencias.*
```

**Respuesta (CAPTCHA incorrecto):**
```markdown
# CAPTCHA incorrecto

**Categoría:** SOCIEDAD ANONIMA (050)
**Denominación:** TECNOLOGIA ARGENTINA
**CAPTCHA enviado:** XXXXX

Inicie una nueva consulta con `consultar_homonimia_<categoria>` para obtener un nuevo CAPTCHA.
```

**Respuesta (sesión expirada):**
```markdown
# Error: Sesión no encontrada

La sesión `session-id` no existe o expiró (TTL 5 min). Inicie una nueva consulta con `consultar_homonimia_<categoria>`.
```

---

## Notas Técnicas

- **Arquitectura:** HTTP-only (axios + cheerio), sin Puppeteer, sin Chromium
- **Tamaño:** ~2 MB (vs ~170 MB con Puppeteer)
- **Cache:** 24h TTL por clave `categoria:denominacion`
- **Sesiones CAPTCHA:** 5 min TTL, limpieza automática
- **Parser:** Extracción literal del panel "Resultados:" y tabla `gvHomonimia`
- **Sin invenciones:** No se infiere disponibilidad ni estado. Solo se transmite lo que IGJ devuelve literalmente.
- **Requisito cliente MCP:** Debe soportar `type: "image"` en respuestas (Windsurf/Claude/Cursor sí)
- **Validación MCP SDK:** 100% compliant
- **Datos Reales:** 100% (0 mocks, 0 simulaciones)

---

## Disclaimer Legal

Este conector accede al portal público de IGJ Homonimia.
La resolución de CAPTCHA se realiza mediante visión humana o LLM (HITL).
No hay automatización de CAPTCHA.
Resultados provienen del sitio oficial. No se garantiza disponibilidad.
