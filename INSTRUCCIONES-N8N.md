# Lola Bot en n8n - Guia Paso a Paso
# Restaurante El Istmo

Esta guia te lleva de cero a tener el bot de Lola funcionando en n8n Cloud.
Tu bot de Railway sigue funcionando como backup hasta que hagas el cambio.

---

## PASO 1: Crear cuenta en n8n Cloud

1. Ve a https://n8n.io/
2. Click en **"Get started free"**
3. Crea tu cuenta (puedes usar Google o email)
4. Una vez dentro, llegas al dashboard de n8n

---

## PASO 2: Crear cuenta en Groq (para transcribir audios)

Groq ofrece el modelo Whisper GRATIS para transcribir notas de voz.

1. Ve a https://console.groq.com/
2. Crea una cuenta gratis (puedes usar Google)
3. Una vez dentro, click en **"API Keys"** en el menu izquierdo
4. Click en **"Create API Key"**
5. Dale un nombre como "lola-bot" y click en **"Submit"**
6. **COPIA la API key** (empieza con `gsk_...`). Solo se muestra una vez!
7. Guardala, la necesitas en el paso 5

---

## PASO 3: Importar el Workflow en n8n

1. En n8n, click en **"Add workflow"** (el boton + arriba)
2. En el menu de arriba (los 3 puntitos o el menu), busca **"Import from File"**
3. Selecciona el archivo `n8n/lola-workflow.json` de tu carpeta CHATBOT
4. Se va a cargar el workflow completo con todos los nodos conectados

Vas a ver algo asi:
```
[Webhook] → [Extraer Datos] → [Marcar Leido] → [Switch]
                                                   ├─ Texto → [Claude] → [Enviar]
                                                   ├─ Audio → [Descargar] → [Transcribir] → [Claude] → [Enviar]
                                                   ├─ Imagen → [Descargar] → [Claude] → [Enviar]
                                                   └─ Otro → [Enviar "solo texto/audio/imagen"]
```

---

## PASO 4: Configurar las Credenciales

Necesitas crear 3 credenciales en n8n. Esto se hace UNA SOLA VEZ.

### 4.1 Credencial de WhatsApp

1. En n8n, ve a **Settings** (icono de engranaje) → **Credentials**
2. Click en **"Add Credential"**
3. Busca **"Header Auth"** y seleccionala
4. Llena:
   - **Name:** `WhatsApp Token`
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer TU_TOKEN_DE_WHATSAPP`
     (reemplaza TU_TOKEN_DE_WHATSAPP con tu token permanente de System User)
5. Click en **"Save"**

### 4.2 Credencial de Anthropic (Claude)

1. Click en **"Add Credential"** de nuevo
2. Busca **"Header Auth"** y seleccionala
3. Llena:
   - **Name:** `Anthropic API Key`
   - **Header Name:** `x-api-key`
   - **Header Value:** `TU_API_KEY_DE_ANTHROPIC`
     (la que empieza con `sk-ant-...`)
4. Click en **"Save"**

**IMPORTANTE:** El nodo de Claude tambien necesita el header `anthropic-version`.
Despues de crear la credencial, haz doble click en el nodo **"Claude AI (Lola)"** y:
1. Ve a la seccion **"Headers"**
2. Agrega un header:
   - **Name:** `anthropic-version`
   - **Value:** `2023-06-01`

### 4.3 Credencial de Groq (Whisper)

1. Click en **"Add Credential"** de nuevo
2. Busca **"Header Auth"** y seleccionala
3. Llena:
   - **Name:** `Groq API Key`
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer TU_API_KEY_DE_GROQ`
     (la que empieza con `gsk_...`)
4. Click en **"Save"**

---

## PASO 5: Asignar Credenciales a los Nodos

Despues de crear las credenciales, necesitas asignarlas a cada nodo.
Haz doble click en cada nodo y selecciona la credencial correcta:

| Nodo | Credencial |
|------|-----------|
| Marcar como Leido | WhatsApp Token |
| Obtener URL del Audio | WhatsApp Token |
| Descargar Audio | WhatsApp Token |
| Obtener URL de Imagen | WhatsApp Token |
| Descargar Imagen | WhatsApp Token |
| Enviar Respuesta WhatsApp | WhatsApp Token |
| Enviar Msg No Soportado | WhatsApp Token |
| Claude AI (Lola) | Anthropic API Key |
| Transcribir Audio (Groq Whisper) | Groq API Key |

Para cada nodo:
1. Doble click en el nodo
2. En la seccion **"Credential to connect with"** o **"Authentication"**
3. Selecciona la credencial correspondiente del dropdown
4. Click en **"Save"** o cierra el panel

---

## PASO 6: Activar el Workflow

1. Arriba a la derecha del workflow, hay un toggle que dice **"Inactive"**
2. Click para cambiarlo a **"Active"**
3. n8n te va a mostrar la URL del webhook. Se ve algo asi:
   ```
   https://tu-nombre.app.n8n.cloud/webhook/webhook
   ```
4. **COPIA esa URL** — la necesitas para el siguiente paso

Si el toggle no te deja activar, revisa que todas las credenciales esten asignadas.

---

## PASO 7: Cambiar el Webhook en Meta

Ahora necesitas decirle a Meta que envie los mensajes a n8n en vez de a Railway.

1. Ve a https://developers.facebook.com/
2. Entra a tu app **"El Istmo Bot"**
3. En el menu izquierdo: **WhatsApp** → **Configuration**
4. En la seccion **"Webhook"**, click en **"Edit"**
5. Cambia:
   - **Callback URL:** `https://tu-nombre.app.n8n.cloud/webhook/webhook`
     (la URL que copiaste en el paso 6)
   - **Verify token:** pon cualquier texto (ej: `lola-n8n-verify-2024`)
     NOTA: n8n maneja la verificacion automaticamente con el nodo GET
6. Click en **"Verify and Save"**
7. Confirma que **"messages"** este suscrito en los webhook fields

---

## PASO 8: Probar!

1. Abre WhatsApp en tu telefono
2. Enviale un mensaje al numero del bot: "Hola!"
3. Lola deberia responderte igual que antes
4. Prueba enviar una nota de voz diciendo "quiero ordenar un arroz con pollo"
5. Prueba enviar una imagen

### Si algo no funciona:

**Revisa los logs en n8n:**
1. Click en el workflow
2. Click en **"Executions"** (icono de reloj arriba)
3. Ahi ves cada ejecucion con los datos de entrada y salida de cada nodo
4. Si hay un error, click en la ejecucion roja para ver el detalle

**Problemas comunes:**

| Problema | Solucion |
|----------|----------|
| Webhook no verifica | Revisa que el workflow este ACTIVO (toggle verde) |
| Error 401 en WhatsApp | Tu token de WhatsApp esta mal. Recrea la credencial |
| Error 401 en Claude | Tu API key de Anthropic esta mal o sin credito |
| Error en transcripcion | Revisa la API key de Groq |
| Bot no responde | Revisa en Executions si el webhook recibio el mensaje |
| Responde doble | Puede ser que Railway tambien esta recibiendo. Desactiva el deploy en Railway |

---

## PASO 9 (Opcional): Desactivar Railway

Una vez que confirmes que n8n funciona bien:

1. Ve a https://railway.com/
2. Entra a tu proyecto
3. Click en tu servicio
4. En **Settings**, puedes:
   - **Pausar** el servicio (lo puedes reactivar despues)
   - O **eliminar** el servicio si ya no lo necesitas
5. Esto te ahorra el costo de Railway (~$5/mes)

---

## Limitaciones actuales y mejoras futuras

### Lo que este workflow NO tiene todavia:
1. **Memoria de conversacion:** Este workflow trata cada mensaje como independiente.
   Para agregar memoria necesitas:
   - Agregar una base de datos (Postgres/Redis)
   - Guardar el historial por numero de telefono
   - Enviar los ultimos 20 mensajes a Claude en cada llamada
   - Esto es un poco mas avanzado, te lo puedo hacer como siguiente paso

2. **Vision de imagenes:** Claude puede "ver" imagenes, pero la integracion
   via HTTP Request es mas compleja. Por ahora el bot responde amablemente
   cuando recibe una imagen. Se puede mejorar enviando la imagen como base64.

### Mejoras que puedes hacer despues:
- Agregar notificacion por email cuando un cliente pide escalar a humano
- Conectar con Google Sheets para registrar pedidos
- Agregar horario automatico (respuesta diferente fuera de horario)
- Agregar menu de botones interactivos de WhatsApp

---

## Costos mensuales estimados

| Servicio | Costo |
|----------|-------|
| n8n Cloud (Starter) | ~$20/mes (incluye 2,500 ejecuciones) |
| Claude API (Haiku) | ~$0.001 por mensaje (~$1-3/mes con uso normal) |
| Groq Whisper | GRATIS |
| WhatsApp Cloud API | Gratis primeras 1,000 conversaciones/mes |
| **Total estimado** | **~$22-25/mes** |

---

## Resumen de cuentas que necesitas

| Cuenta | URL | Para que |
|--------|-----|----------|
| n8n Cloud | https://n8n.io | Correr el workflow del bot |
| Groq | https://console.groq.com | Transcribir notas de voz (gratis) |
| Anthropic | https://console.anthropic.com | Claude AI (cerebro de Lola) |
| Meta Developers | https://developers.facebook.com | WhatsApp Cloud API |
