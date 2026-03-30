"""Servidor principal del bot de WhatsApp - Restaurante El Istmo."""

import os
import time
import logging
from contextlib import asynccontextmanager

import anthropic
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Query, Request, Response

from menu import SYSTEM_PROMPT

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lola-bot")

# --- Configuracion ---
WHATSAPP_TOKEN = os.environ["WHATSAPP_TOKEN"]
WHATSAPP_PHONE_NUMBER_ID = os.environ["WHATSAPP_PHONE_NUMBER_ID"]
WHATSAPP_VERIFY_TOKEN = os.environ["WHATSAPP_VERIFY_TOKEN"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

WHATSAPP_API_URL = (
    f"https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages"
)

# --- Memoria de conversaciones ---
# Diccionario: phone_number -> {"messages": [...], "last_active": timestamp}
conversations: dict[str, dict] = {}
MAX_HISTORY = 20  # Maximo de mensajes por conversacion
SESSION_TIMEOUT = 3600  # 1 hora sin actividad = nueva sesion


def get_conversation(phone: str) -> list[dict]:
    """Obtiene o crea el historial de conversacion para un numero."""
    now = time.time()
    if phone in conversations:
        if now - conversations[phone]["last_active"] > SESSION_TIMEOUT:
            # Sesion expirada, empezar de nuevo
            conversations[phone] = {"messages": [], "last_active": now}
    else:
        conversations[phone] = {"messages": [], "last_active": now}

    conversations[phone]["last_active"] = now
    return conversations[phone]["messages"]


def cleanup_old_sessions():
    """Elimina sesiones inactivas para liberar memoria."""
    now = time.time()
    expired = [
        phone
        for phone, data in conversations.items()
        if now - data["last_active"] > SESSION_TIMEOUT
    ]
    for phone in expired:
        del conversations[phone]
    if expired:
        logger.info(f"Limpiadas {len(expired)} sesiones expiradas")


# --- Cliente de Claude ---
claude_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


async def get_lola_response(phone: str, user_message: str) -> str:
    """Genera respuesta de Lola usando Claude."""
    messages = get_conversation(phone)

    # Agregar mensaje del usuario
    messages.append({"role": "user", "content": user_message})

    # Mantener solo los ultimos N mensajes
    if len(messages) > MAX_HISTORY:
        messages[:] = messages[-MAX_HISTORY:]

    try:
        response = claude_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            system=SYSTEM_PROMPT,
            messages=messages,
        )
        assistant_message = response.content[0].text

        # Guardar respuesta en historial
        messages.append({"role": "assistant", "content": assistant_message})

        return assistant_message
    except Exception as e:
        logger.error(f"Error con Claude API: {e}")
        return (
            "Ay, disculpa! Tuve un problemita tecnico 😅 "
            "Intenta de nuevo en un momentito."
        )


# --- WhatsApp Cloud API ---
async def send_whatsapp_message(to: str, text: str):
    """Envia un mensaje de texto por WhatsApp."""
    # WhatsApp tiene limite de ~4096 chars, cortar si es necesario
    if len(text) > 4000:
        text = text[:4000] + "..."

    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(WHATSAPP_API_URL, json=payload, headers=headers)
        if resp.status_code != 200:
            logger.error(f"Error enviando mensaje: {resp.status_code} {resp.text}")
        else:
            logger.info(f"Mensaje enviado a {to}")


async def mark_as_read(message_id: str):
    """Marca un mensaje como leido (doble check azul)."""
    payload = {
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": message_id,
    }
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient() as client:
        await client.post(WHATSAPP_API_URL, json=payload, headers=headers)


# --- FastAPI App ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🟢 Lola Bot iniciado - Restaurante El Istmo")
    yield
    logger.info("🔴 Lola Bot detenido")


app = FastAPI(title="Lola Bot - Restaurante El Istmo", lifespan=lifespan)


@app.get("/")
async def root():
    return {"status": "ok", "bot": "Lola - Restaurante El Istmo"}


@app.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Verificacion del webhook de WhatsApp (solo se usa una vez al configurar)."""
    if hub_mode == "subscribe" and hub_verify_token == WHATSAPP_VERIFY_TOKEN:
        logger.info("Webhook verificado exitosamente")
        return Response(content=hub_challenge, media_type="text/plain")
    logger.warning("Verificacion de webhook fallida")
    return Response(content="Forbidden", status_code=403)


@app.post("/webhook")
async def handle_webhook(request: Request):
    """Recibe mensajes entrantes de WhatsApp."""
    body = await request.json()

    # Limpiar sesiones viejas cada vez que llega un mensaje
    cleanup_old_sessions()

    try:
        entry = body.get("entry", [])
        for e in entry:
            changes = e.get("changes", [])
            for change in changes:
                value = change.get("value", {})
                messages = value.get("messages", [])

                for msg in messages:
                    # Solo procesar mensajes de texto
                    if msg.get("type") != "text":
                        phone = msg["from"]
                        await send_whatsapp_message(
                            phone,
                            "Hola! Por ahora solo puedo leer mensajes de texto 😊 "
                            "Escríbeme lo que necesites!",
                        )
                        continue

                    phone = msg["from"]
                    text = msg["text"]["body"]
                    message_id = msg["id"]

                    logger.info(f"Mensaje de {phone}: {text}")

                    # Marcar como leido
                    await mark_as_read(message_id)

                    # Obtener respuesta de Lola
                    response_text = await get_lola_response(phone, text)

                    # Detectar si hay que escalar
                    if "[ESCALAR_A_HUMANO]" in response_text:
                        response_text = response_text.replace(
                            "[ESCALAR_A_HUMANO]", ""
                        ).strip()
                        logger.info(f"⚠️ ESCALAR: Cliente {phone} pidio hablar con humano")
                        # Aqui podrias enviar una notificacion al equipo

                    # Enviar respuesta
                    await send_whatsapp_message(phone, response_text)

    except Exception as e:
        logger.error(f"Error procesando webhook: {e}")

    # Siempre responder 200 a Meta
    return Response(status_code=200)


# --- Para probar localmente sin WhatsApp ---
@app.post("/test")
async def test_chat(request: Request):
    """Endpoint de prueba: simula una conversacion sin WhatsApp.
    Enviar JSON: {"phone": "test123", "message": "Hola!"}
    """
    body = await request.json()
    phone = body.get("phone", "test-user")
    message = body.get("message", "")

    if not message:
        return {"error": "Falta el campo 'message'"}

    response = await get_lola_response(phone, message)
    return {"from": "Lola", "message": response}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app:app", host="0.0.0.0", port=port)
