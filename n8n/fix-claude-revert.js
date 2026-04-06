const API = 'https://n8n.solucionesomicron.com/api/v1/workflows/2EZ0PqE6jOX9NHwo';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';

const SYSTEM_LOLA = `Eres Lola, la asistente virtual de WhatsApp del Restaurante El Istmo, ubicado en Panama City, Panama.

PERSONALIDAD:
- Eres amigable, servicial y hablas de forma casual panameña
- Usas expresiones panameñas naturales
- Eres profesional pero cercana

MENU DEL RESTAURANTE:
- Arroz con Marisco con ensalada de repollo y platano en tentacion - 8.00 dolares por porcion
- Delivery GRATIS

Tu trabajo:
- Ayudar a los clientes con informacion del restaurante
- Tomar pedidos
- Dar precios y recomendaciones
- Ser amable y profesional siempre`;

const SYSTEM_PEDIDOS = `Eres Lola, asistente de pedidos del Restaurante El Istmo. Hablas casual panameño.

HOY SE VENDE:
- Arroz con Marisco con ensalada de repollo y platano en tentacion - 8.00 dolares por porcion
- Delivery GRATIS

Tu trabajo es obtener del cliente estos 3 datos:
1. CANTIDAD de porciones
2. NOMBRE del cliente
3. DIRECCION de entrega

REGLAS:
- Se amable y breve, habla panameño casual
- Si el cliente da varios datos en un mensaje, anotalos todos
- Si falta info, pregunta SOLO lo que falta de forma natural
- NO mandes el menu del restaurante, solo se vende lo de la promocion de hoy
- Cuando tengas los 3 datos COMPLETOS, confirma el pedido mostrando resumen y al FINAL agrega en una linea aparte exactamente asi:
[PEDIDO_LISTO|cantidad:X|nombre:NOMBRE|direccion:DIRECCION]
- SOLO agrega esa linea cuando tengas los 3 datos completos
- Si el cliente dice algo como "quiero 2" ya tienes la cantidad, pregunta nombre y direccion`;

// Validate the JSON bodies BEFORE deploying
const testBody1 = `JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 500, system: ${JSON.stringify(SYSTEM_LOLA)}, messages: [{ role: "user", content: "hola" }] })`;
const testBody2 = `JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 300, system: ${JSON.stringify(SYSTEM_PEDIDOS)}, messages: [{ role: "user", content: "quiero 2" }] })`;

try {
  const result1 = new Function('return ' + testBody1)();
  JSON.parse(result1); // verify it's valid JSON
  console.log('✅ Claude AI Lola body: VALID');
} catch(e) {
  console.log('❌ Claude AI Lola body ERROR:', e.message);
  process.exit(1);
}

try {
  const result2 = new Function('return ' + testBody2)();
  JSON.parse(result2);
  console.log('✅ Claude Pedidos body: VALID');
} catch(e) {
  console.log('❌ Claude Pedidos body ERROR:', e.message);
  process.exit(1);
}

const jsonBodyLola = `={{ JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 500, system: ${JSON.stringify(SYSTEM_LOLA)}, messages: [{ role: "user", content: $json.promptText }] }) }}`;
const jsonBodyPedidos = `={{ JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 300, system: ${JSON.stringify(SYSTEM_PEDIDOS)}, messages: [{ role: "user", content: "Datos recopilados: " + $json.datosActuales + ". Historial de conversacion: " + $json.historial + ". Nuevo mensaje del cliente: " + $json.mensajeCliente }] }) }}`;

async function main() {
  const r = await fetch(API, { headers: { 'X-N8N-API-KEY': KEY } });
  const wf = await r.json();

  // Find current Anthropic credential ID
  let anthropicCredId = '';
  for (const n of wf.nodes) {
    if (n.name === 'Claude Pedidos' && n.credentials?.httpHeaderAuth) {
      anthropicCredId = n.credentials.httpHeaderAuth.id;
      break;
    }
  }
  console.log('Using Anthropic cred ID:', anthropicCredId);

  for (let i = 0; i < wf.nodes.length; i++) {
    const node = wf.nodes[i];

    if (node.name === 'Claude AI Lola') {
      wf.nodes[i] = {
        parameters: {
          method: 'POST',
          url: 'https://api.anthropic.com/v1/messages',
          authentication: 'genericCredentialType',
          genericAuthType: 'httpHeaderAuth',
          sendHeaders: true,
          headerParameters: {
            parameters: [{ name: 'anthropic-version', value: '2023-06-01' }]
          },
          sendBody: true,
          specifyBody: 'json',
          jsonBody: jsonBodyLola,
          options: {}
        },
        id: node.id,
        name: 'Claude AI Lola',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: node.position,
        credentials: {
          httpHeaderAuth: { id: anthropicCredId, name: 'Anthropic API Key' }
        }
      };
      console.log('✅ Claude AI Lola: fixed with properly escaped system prompt');
    }

    if (node.name === 'Claude Pedidos') {
      wf.nodes[i] = {
        parameters: {
          method: 'POST',
          url: 'https://api.anthropic.com/v1/messages',
          authentication: 'genericCredentialType',
          genericAuthType: 'httpHeaderAuth',
          sendHeaders: true,
          headerParameters: {
            parameters: [{ name: 'anthropic-version', value: '2023-06-01' }]
          },
          sendBody: true,
          specifyBody: 'json',
          jsonBody: jsonBodyPedidos,
          options: {}
        },
        id: node.id,
        name: 'Claude Pedidos',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: node.position,
        credentials: {
          httpHeaderAuth: { id: anthropicCredId, name: 'Anthropic API Key' }
        }
      };
      console.log('✅ Claude Pedidos: fixed with properly escaped system prompt');
    }
  }

  // Save
  const saveR = await fetch(API, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings, staticData: wf.staticData })
  });
  const result = await saveR.json();
  console.log(result.id ? '\n🚀 ¡Guardado! Claude arreglado.' : 'Error: ' + JSON.stringify(result).substring(0, 300));
}
main();
