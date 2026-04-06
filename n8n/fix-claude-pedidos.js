const API = 'https://n8n.solucionesomicron.com/api/v1/workflows/2EZ0PqE6jOX9NHwo';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';

const SYSTEM_PROMPT = `Eres Lola, asistente de pedidos del Restaurante El Istmo. Hablas casual panameño.

HOY SE VENDE:
- Arroz con Marisco con ensalada de repollo y platano en tentacion - $8.00 por porcion
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

async function main() {
  const r = await fetch(API, { headers: { 'X-N8N-API-KEY': KEY } });
  const wf = await r.json();

  // Find and replace Claude Pedidos node
  const idx = wf.nodes.findIndex(n => n.name === 'Claude Pedidos');
  if (idx >= 0) {
    wf.nodes[idx] = {
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
        jsonBody: `={{ JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, system: ${JSON.stringify(SYSTEM_PROMPT)}, messages: [{ role: 'user', content: 'Datos recopilados: ' + $json.datosActuales + '. Historial de conversacion: ' + $json.historial + '. Nuevo mensaje del cliente: ' + $json.mensajeCliente }] }) }}`,
        options: {}
      },
      id: 'smart-order-claude-001',
      name: 'Claude Pedidos',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1780, 150],
      credentials: {
        httpHeaderAuth: {
          id: 'QgassfKnwcBfuDFW',
          name: 'Anthropic API Key'
        }
      }
    };
    console.log('✅ Claude Pedidos: cambiado a HTTP Request (igual que Claude AI Lola)');
  }

  // Fix Procesar Respuesta Pedido to handle HTTP response format
  const procNode = wf.nodes.find(n => n.name === 'Procesar Respuesta Pedido');
  if (procNode) {
    procNode.parameters.jsCode = `
const staticData = $getWorkflowStaticData('global');
const phone = $input.first().json.phoneNumber || '';

// Extract response from Anthropic API format
const apiResponse = $input.first().json;
let respuesta = '';
if (apiResponse.content && apiResponse.content[0]) {
  respuesta = apiResponse.content[0].text;
} else if (apiResponse.text) {
  respuesta = apiResponse.text;
} else {
  respuesta = JSON.stringify(apiResponse).substring(0, 200);
}

// Check if order is complete
const match = respuesta.match(/\\[PEDIDO_LISTO\\|cantidad:(.+?)\\|nombre:(.+?)\\|direccion:(.+?)\\]/);
const respuestaLimpia = respuesta.replace(/\\[PEDIDO_LISTO\\|.*?\\]/, '').trim();

// Get phone from static data if not in response
let actualPhone = phone;
if (!actualPhone) {
  // Find it from previous node data
  for (const key of Object.keys(staticData)) {
    if (key.startsWith('pedido_') && staticData[key].estado === 'en_pedido') {
      actualPhone = key.replace('pedido_', '');
      break;
    }
  }
}

const pedido = staticData['pedido_' + actualPhone] || { historial: [], datos: {} };
pedido.historial.push({ role: 'lola', text: respuestaLimpia });

if (match) {
  const resumen = {
    telefono: actualPhone,
    cantidad: match[1].trim(),
    nombre: match[2].trim(),
    direccion: match[3].trim(),
    hora: new Date().toLocaleString('es-PA', { timeZone: 'America/Panama' })
  };
  delete staticData['pedido_' + actualPhone];

  return [{ json: {
    phoneNumber: actualPhone,
    respuesta: respuestaLimpia,
    pedidoCompleto: true,
    pedidoFinal: resumen
  }}];
} else {
  staticData['pedido_' + actualPhone] = pedido;
  return [{ json: {
    phoneNumber: actualPhone,
    respuesta: respuestaLimpia,
    pedidoCompleto: false,
    pedidoFinal: null
  }}];
}
`;
    console.log('✅ Procesar Respuesta Pedido: adaptado a formato HTTP');
  }

  // Fix Preparar Pedido Claude to pass phoneNumber forward
  const prepNode = wf.nodes.find(n => n.name === 'Preparar Pedido Claude');
  if (prepNode) {
    prepNode.parameters.jsCode = `
const route = $input.first().json._route;
if (route !== 'pedido') return [];

const staticData = $getWorkflowStaticData('global');
const phone = $input.first().json.phoneNumber;
const mensaje = $input.first().json.messageContent;
const pedido = staticData['pedido_' + phone] || { historial: [], datos: { cantidad: '', nombre: '', direccion: '' } };

pedido.historial.push({ role: 'cliente', text: mensaje });
staticData['pedido_' + phone] = pedido;

const historialTexto = pedido.historial.map(h => h.role === 'cliente' ? 'Cliente: ' + h.text : 'Lola: ' + h.text).join(' | ');
const datosTexto = 'Cantidad: ' + (pedido.datos.cantidad || 'NO TIENE') + ', Nombre: ' + (pedido.datos.nombre || 'NO TIENE') + ', Direccion: ' + (pedido.datos.direccion || 'NO TIENE');

return [{ json: {
  phoneNumber: phone,
  historial: historialTexto,
  datosActuales: datosTexto,
  mensajeCliente: mensaje
}}];
`;
    console.log('✅ Preparar Pedido Claude: incluye phoneNumber');
  }

  // Save
  const saveResp = await fetch(API, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await saveResp.json();
  console.log(result.id ? '🚀 Guardado! Nodos: ' + result.nodes.length : 'Error: ' + JSON.stringify(result).substring(0, 300));
}
main();
