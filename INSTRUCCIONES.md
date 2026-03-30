# Lola Bot - Restaurante El Istmo
# Guia completa de configuracion y deploy

## Que hace este bot?
Lola es un bot de WhatsApp que atiende clientes del restaurante:
responde sobre el menu, toma pedidos, confirma ordenes y da info del local.

---

## PASO 1: Obtener la API Key de Anthropic (Claude)

1. Ve a https://console.anthropic.com/
2. Crea una cuenta si no tienes (o inicia sesion)
3. En el menu de la izquierda, click en **"API Keys"**
4. Click en **"Create Key"**
5. Dale un nombre como "lola-bot" y click en **"Create Key"**
6. **COPIA la key** (empieza con `sk-ant-...`). Solo se muestra una vez!
7. Guarda esta key, la necesitaras despues

> IMPORTANTE: Necesitas agregar credito a tu cuenta de Anthropic.
> Ve a **"Plans & Billing"** en el menu izquierdo y agrega un metodo de pago.
> Con $5 tienes para miles de mensajes con el modelo Haiku.

---

## PASO 2: Configurar WhatsApp Cloud API en Meta

### 2.1 Crear cuenta de desarrollador en Meta

1. Ve a https://developers.facebook.com/
2. Click en **"Get Started"** o **"My Apps"** (arriba a la derecha)
3. Inicia sesion con tu cuenta de Facebook
4. Si te pide registrarte como desarrollador, acepta los terminos

### 2.2 Crear una App

1. En https://developers.facebook.com/apps/ click en **"Create App"**
2. Selecciona **"Other"** como tipo de uso, click **"Next"**
3. Selecciona **"Business"** como tipo de app, click **"Next"**
4. Llena:
   - App name: `Restaurante El Istmo Bot`
   - Contact email: tu email
5. Click en **"Create App"**

### 2.3 Agregar WhatsApp a la App

1. En el dashboard de tu app, busca **"WhatsApp"** en la lista de productos
2. Click en **"Set Up"** junto a WhatsApp
3. Te va a llevar a la pagina de WhatsApp > Getting Started

### 2.4 Obtener las credenciales

En la pagina de **WhatsApp > API Setup** vas a ver:

- **Phone number ID**: Es un numero largo (ej: `123456789012345`).
  Lo necesitas para la variable `WHATSAPP_PHONE_NUMBER_ID`
- **Temporary access token**: Click en **"Generate"** para obtener uno.
  Este es tu `WHATSAPP_TOKEN` (pero es temporal, dura 24h)

> PARA TOKEN PERMANENTE (recomendado para produccion):
> 1. Ve a **Business Settings** > **System Users** en business.facebook.com
> 2. Crea un System User con rol Admin
> 3. Click en **"Generate New Token"**
> 4. Selecciona tu app y dale permiso `whatsapp_business_messaging`
> 5. Ese token no expira

### 2.5 El Verify Token

El `WHATSAPP_VERIFY_TOKEN` es un texto que TU inventas. Puede ser cualquier
cosa, por ejemplo: `mi_token_secreto_123`. Lo importante es que sea el
mismo valor en tu archivo .env y cuando configures el webhook en Meta.

---

## PASO 3: Deploy en Railway

### 3.1 Subir codigo a GitHub

Primero necesitas subir tu codigo a GitHub:

1. Ve a https://github.com/ y crea una cuenta (o inicia sesion)
2. Click en el boton **"+"** arriba a la derecha > **"New repository"**
3. Nombre: `lola-whatsapp-bot`
4. Dejalo **Public** o **Private** (como prefieras)
5. NO marques "Add a README file"
6. Click en **"Create repository"**

Ahora en tu computadora, abre la terminal (cmd o PowerShell) en la
carpeta CHATBOT y ejecuta estos comandos uno por uno:

```
git init
git add .
git commit -m "Primer commit - Lola Bot"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/lola-whatsapp-bot.git
git push -u origin main
```

(Reemplaza TU_USUARIO con tu nombre de usuario de GitHub)

### 3.2 Configurar Railway

1. Ve a https://railway.com/ y crea una cuenta (puedes usar tu cuenta de GitHub)
2. En el dashboard, click en **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Conecta tu cuenta de GitHub si te lo pide
5. Selecciona el repositorio `lola-whatsapp-bot`
6. Railway va a detectar automaticamente que es un proyecto Python

### 3.3 Configurar variables de entorno en Railway

1. Click en tu servicio (el recuadro morado que aparece)
2. Ve a la pestana **"Variables"**
3. Click en **"New Variable"** y agrega cada una:

| Variable                    | Valor                                    |
|-----------------------------|------------------------------------------|
| `WHATSAPP_PHONE_NUMBER_ID`  | El Phone Number ID de Meta (paso 2.4)    |
| `WHATSAPP_TOKEN`            | El token de acceso de Meta (paso 2.4)    |
| `WHATSAPP_VERIFY_TOKEN`     | El texto que inventaste (paso 2.5)       |
| `ANTHROPIC_API_KEY`         | Tu API key de Anthropic (paso 1)         |
| `PORT`                      | `8000`                                   |

4. Railway va a re-deployar automaticamente

### 3.4 Obtener la URL publica

1. Ve a la pestana **"Settings"** de tu servicio
2. En la seccion **"Networking"** > **"Public Networking"**
3. Click en **"Generate Domain"**
4. Te va a dar una URL como: `lola-whatsapp-bot-production-xxxx.up.railway.app`
5. **Copia esa URL**, la necesitas para el siguiente paso

---

## PASO 4: Conectar el Webhook en Meta

1. Ve a https://developers.facebook.com/ > tu app > WhatsApp > **Configuration**
2. En la seccion **"Webhook"**, click en **"Edit"**
3. Llena:
   - **Callback URL**: `https://TU-URL-DE-RAILWAY.up.railway.app/webhook`
   - **Verify token**: El mismo texto que pusiste en `WHATSAPP_VERIFY_TOKEN`
4. Click en **"Verify and Save"**
   - Si te da error, revisa que Railway este corriendo (revisa los logs)
5. Ahora en **"Webhook fields"**, click en **"Manage"**
6. Busca **"messages"** y activa la suscripcion (toggle on)

---

## PASO 5: Probar ANTES de conectar WhatsApp real

### Opcion A: Probar con el endpoint /test (sin WhatsApp)

Puedes probar que Lola responda correctamente sin WhatsApp.

Si estas corriendo el servidor localmente:
```bash
curl -X POST http://localhost:8000/test \
  -H "Content-Type: application/json" \
  -d '{"phone": "test123", "message": "Hola! Que tienen de menu?"}'
```

O si ya esta en Railway:
```bash
curl -X POST https://TU-URL-DE-RAILWAY.up.railway.app/test \
  -H "Content-Type: application/json" \
  -d '{"phone": "test123", "message": "Hola! Que tienen de menu?"}'
```

Tambien puedes usar la herramienta online https://reqbin.com/:
1. Pon la URL: `https://TU-URL-DE-RAILWAY.up.railway.app/test`
2. Metodo: POST
3. Content-Type: application/json
4. Body: `{"phone": "test123", "message": "Hola!"}`
5. Click Send

### Opcion B: Probar con el numero de prueba de Meta

Meta te da un numero de prueba gratuito:

1. Ve a tu app > WhatsApp > **API Setup**
2. En la seccion "Send and receive messages", ves un numero de prueba
3. Agrega TU numero de telefono en **"To"** (click "Manage phone number list")
4. Te van a enviar un codigo de verificacion por WhatsApp
5. Pon el codigo para verificar tu numero
6. Ahora puedes enviar mensajes al numero de prueba de Meta desde TU WhatsApp
7. Los mensajes que envies al numero de prueba llegaran a tu webhook

> NOTA: Con el numero de prueba, solo puedes recibir mensajes de numeros
> que hayas verificado (maximo 5 numeros en modo desarrollo).

### Opcion C: Probar localmente con ngrok

Si quieres probar el webhook sin hacer deploy:

1. Descarga ngrok de https://ngrok.com/download
2. Registrate gratis y copia tu auth token
3. En la terminal: `ngrok config add-authtoken TU_TOKEN`
4. Ejecuta tu servidor: `python app.py`
5. En otra terminal: `ngrok http 8000`
6. ngrok te da una URL publica (ej: `https://abc123.ngrok-free.app`)
7. Usa esa URL como Callback URL en Meta (paso 4)

---

## PASO 6: Ir a produccion (cuando quieras salir de modo desarrollo)

Cuando quieras que cualquier numero te pueda escribir (no solo los 5 de prueba):

1. Ve a tu app en Meta > **App Review** > **Requests**
2. Solicita los permisos:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
3. Meta va a revisar tu app (puede tomar unos dias)
4. Una vez aprobado, cualquier persona puede escribirle a tu bot

---

## Estructura de archivos

```
CHATBOT/
  app.py              <- Servidor principal (FastAPI + webhook)
  menu.py             <- Menu del restaurante + prompt de Lola
  requirements.txt    <- Dependencias de Python
  .env.example        <- Plantilla de variables de entorno
  .env                <- Tus variables reales (NO subir a GitHub)
  .gitignore          <- Archivos que Git ignora
  Procfile            <- Comando de inicio para Railway
  railway.json        <- Configuracion de Railway
```

---

## Comandos utiles

```bash
# Instalar dependencias localmente
pip install -r requirements.txt

# Correr servidor local
python app.py

# Ver logs en Railway
# (desde el dashboard de Railway, click en tu servicio > pestaña "Logs")
```

---

## Costos estimados

| Servicio  | Costo                                       |
|-----------|---------------------------------------------|
| Railway   | Gratis para empezar (plan Trial: $5/mes)    |
| Claude API| ~$0.001 por mensaje (Haiku es muy barato)   |
| WhatsApp  | Gratis primeras 1,000 conversaciones/mes    |
| **Total** | **~$5-10/mes para demo con poco trafico**   |

---

## Problemas comunes

**"El webhook no verifica"**
- Revisa que Railway este corriendo (mira los logs)
- Revisa que el WHATSAPP_VERIFY_TOKEN sea exactamente igual en Railway y en Meta

**"El bot no responde"**
- Revisa los logs en Railway
- Confirma que el campo "messages" este suscrito en el webhook
- Verifica que tu ANTHROPIC_API_KEY tenga credito

**"Error 401 al enviar mensajes"**
- Tu WHATSAPP_TOKEN expiro. Genera uno nuevo o usa un token permanente

**"Solo puedo probar con 5 numeros"**
- Es normal en modo desarrollo. Para mas, necesitas aprobacion de Meta (paso 6)
