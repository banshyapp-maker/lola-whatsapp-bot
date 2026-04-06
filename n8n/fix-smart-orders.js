const API = 'https://n8n.solucionesomicron.com/api/v1/workflows/2EZ0PqE6jOX9NHwo';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';
const ADMIN = '50768384242';
const PHONE_ID = '1103393509513315';
const WA_CRED = 'RuldJqintIRvefni';
const ANTHROPIC_CRED = 'QgassfKnwcBfuDFW';

async function main() {
  const r = await fetch(API, { headers: { 'X-N8N-API-KEY': KEY } });
  const wf = await r.json();
  const existingNames = wf.nodes.map(n => n.name);

  for (const node of wf.nodes) {

    // Lista de Contactos: mark as "en_pedido" (single state, Claude handles the rest)
    if (node.name === 'Lista de Contactos') {
      node.parameters.jsCode = `
const CONTACTOS = [
  { numero: "50769815135", nombre: "Vladimir" },
  { numero: "50768384242", nombre: "Veronica" },
];

const imageUrl = $input.first().json.imageUrl;
const caption  = $input.first().json.caption;

const staticData = $getWorkflowStaticData('global');
for (const c of CONTACTOS) {
  staticData['pedido_' + c.numero] = {
    estado: 'en_pedido',
    historial: [],
    datos: { cantidad: '', nombre: '', direccion: '' }
  };
}

return CONTACTOS.map(c => ({
  json: { phoneNumber: c.numero, nombre: c.nombre, imageUrl, caption }
}));
`;
      console.log('✅ Lista de Contactos: estado simplificado "en_pedido"');
    }

    // Routear Pedido: simplify - either "en_pedido" or "normal"
    if (node.name === 'Routear Pedido') {
      node.parameters.jsCode = `
const estado = $input.first().json.estadoPedido;
const item = $input.first().json;
if (estado === 'en_pedido') {
  return [{ json: { ...item, _route: 'pedido' } }];
} else {
  return [{ json: { ...item, _route: 'normal' } }];
}
`;
      console.log('✅ Routear Pedido: simplificado (pedido vs normal)');
    }

    // Verificar Estado Pedido: check for "en_pedido"
    if (node.name === 'Verificar Estado Pedido') {
      node.parameters.jsCode = `
const staticData = $getWorkflowStaticData('global');
const phone = $input.first().json.phoneNumber;
const pedido = staticData['pedido_' + phone];
if (pedido && pedido.estado === 'en_pedido') {
  return [{ json: { ...$input.first().json, estadoPedido: 'en_pedido', pedidoDatos: pedido.datos, pedidoHistorial: pedido.historial } }];
} else {
  return [{ json: { ...$input.first().json, estadoPedido: 'normal' } }];
}
`;
      console.log('✅ Verificar Estado Pedido: pasa historial y datos a Claude');
    }
  }

  // Remove old rigid nodes from connections (Guardar Cantidad, Guardar Nombre, Confirmar Pedido)
  // Replace with single smart flow: Routear Pedido → Preparar Pedido Claude → Claude Pedidos → Procesar Pedido → Enviar/Notificar

  // Node: Preparar Pedido Claude - builds the prompt with context and history
  if (!existingNames.includes('Preparar Pedido Claude')) {
    wf.nodes.push({
      parameters: {
        jsCode: `
const route = $input.first().json._route;
if (route !== 'pedido') return [];

const staticData = $getWorkflowStaticData('global');
const phone = $input.first().json.phoneNumber;
const mensaje = $input.first().json.messageContent;
const pedido = staticData['pedido_' + phone] || { historial: [], datos: { cantidad: '', nombre: '', direccion: '' } };

// Add new message to history
pedido.historial.push({ role: 'cliente', text: mensaje });

// Save updated history
staticData['pedido_' + phone] = pedido;

// Build context for Claude
const historialTexto = pedido.historial.map(h => h.role === 'cliente' ? 'Cliente: ' + h.text : 'Lola: ' + h.text).join('\\n');
const datosTexto = 'Cantidad: ' + (pedido.datos.cantidad || 'NO TIENE') + ', Nombre: ' + (pedido.datos.nombre || 'NO TIENE') + ', Direccion: ' + (pedido.datos.direccion || 'NO TIENE');

return [{ json: {
  phoneNumber: phone,
  historial: historialTexto,
  datosActuales: datosTexto,
  mensajeCliente: mensaje
}}];
`
      },
      id: 'smart-order-prep-001',
      name: 'Preparar Pedido Claude',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1540, 150]
    });
    console.log('✅ Nodo: Preparar Pedido Claude');
  }

  // Node: Claude Pedidos - AI handles the order conversation
  if (!existingNames.includes('Claude Pedidos')) {
    wf.nodes.push({
      parameters: {
        model: 'claude-haiku-4-5-20251001',
        system: `Eres Lola, asistente de pedidos del Restaurante El Istmo. Hablas casual panameño.

HOY SE VENDE:
- Arroz con Marisco con ensalada de repollo y plátano en tentación - $8.00 por porción
- Delivery GRATIS

Tu trabajo es obtener del cliente estos 3 datos:
1. CANTIDAD de porciones
2. NOMBRE del cliente
3. DIRECCIÓN de entrega

REGLAS:
- Se amable y breve
- Si el cliente da varios datos en un mensaje, anotalos todos
- Si falta info, pregunta SOLO lo que falta
- NO mandes el menú del restaurante, solo se vende lo de la promoción
- Cuando tengas los 3 datos, confirma el pedido y al FINAL de tu mensaje agrega en una linea aparte exactamente asi:
[PEDIDO_LISTO|cantidad:X|nombre:NOMBRE|direccion:DIRECCION]
- SOLO agrega esa linea cuando tengas los 3 datos completos`,
        messages: {
          values: [
            {
              role: 'user',
              content: '={{ "Datos recopilados hasta ahora: " + $json.datosActuales + "\\n\\nHistorial:\\n" + $json.historial + "\\n\\nNuevo mensaje del cliente: " + $json.mensajeCliente }}'
            }
          ]
        },
        options: {
          maxTokens: 300,
          temperature: 0.3
        }
      },
      id: 'smart-order-claude-001',
      name: 'Claude Pedidos',
      type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
      typeVersion: 1.3,
      position: [1780, 150],
      credentials: {
        anthropicApi: {
          id: ANTHROPIC_CRED,
          name: 'Anthropic'
        }
      }
    });
    console.log('✅ Nodo: Claude Pedidos');
  }

  // Node: Procesar Respuesta Pedido - extract order data and check if complete
  if (!existingNames.includes('Procesar Respuesta Pedido')) {
    wf.nodes.push({
      parameters: {
        jsCode: `
const staticData = $getWorkflowStaticData('global');
const phone = $input.first().json.phoneNumber;
const respuesta = $input.first().json.response?.text || $input.first().json.text || $input.first().json.content?.[0]?.text || '';

// Check if order is complete
const match = respuesta.match(/\\[PEDIDO_LISTO\\|cantidad:(.+?)\\|nombre:(.+?)\\|direccion:(.+?)\\]/);

// Clean response (remove the marker)
const respuestaLimpia = respuesta.replace(/\\[PEDIDO_LISTO\\|.*?\\]/, '').trim();

// Save Lola's response to history
const pedido = staticData['pedido_' + phone] || { historial: [], datos: {} };
pedido.historial.push({ role: 'lola', text: respuestaLimpia });

if (match) {
  // Order complete! Extract data
  const resumen = {
    telefono: phone,
    cantidad: match[1].trim(),
    nombre: match[2].trim(),
    direccion: match[3].trim(),
    hora: new Date().toLocaleString('es-PA', { timeZone: 'America/Panama' })
  };

  // Clear state
  delete staticData['pedido_' + phone];

  return [{ json: {
    phoneNumber: phone,
    respuesta: respuestaLimpia,
    pedidoCompleto: true,
    pedidoFinal: resumen
  }}];
} else {
  // Update stored data if Claude extracted any
  staticData['pedido_' + phone] = pedido;

  return [{ json: {
    phoneNumber: phone,
    respuesta: respuestaLimpia,
    pedidoCompleto: false,
    pedidoFinal: null
  }}];
}
`
      },
      id: 'smart-order-proc-001',
      name: 'Procesar Respuesta Pedido',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2020, 150]
    });
    console.log('✅ Nodo: Procesar Respuesta Pedido');
  }

  // Node: Notificar Admin Pedido Completo
  if (!existingNames.includes('Notificar Admin Pedido')) {
    wf.nodes.push({
      parameters: {
        jsCode: `
if (!$input.first().json.pedidoCompleto) return [];
const p = $input.first().json.pedidoFinal;
return [{ json: {
  to: "${ADMIN}",
  body: "\\ud83d\\udccb *NUEVO PEDIDO*\\n\\ud83d\\udc64 " + p.nombre + " (" + p.telefono + ")\\n\\ud83d\\udce6 Cantidad: " + p.cantidad + "\\n\\ud83d\\udccd Direcci\\u00f3n: " + p.direccion + "\\n\\ud83d\\udd51 " + p.hora
}}];
`
      },
      id: 'smart-order-notif-001',
      name: 'Notificar Admin Pedido',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2260, 250]
    });
    console.log('✅ Nodo: Notificar Admin Pedido');
  }

  // Node: Enviar Notif Admin WA
  if (!existingNames.includes('Enviar Notif Admin WA')) {
    wf.nodes.push({
      parameters: {
        method: 'POST',
        url: 'https://graph.facebook.com/v21.0/' + PHONE_ID + '/messages',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ messaging_product: "whatsapp", to: $json.to, type: "text", text: { body: $json.body } }) }}',
        options: {}
      },
      id: 'smart-order-notif-wa-001',
      name: 'Enviar Notif Admin WA',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [2500, 250],
      credentials: { httpHeaderAuth: { id: WA_CRED, name: 'WhatsApp Token' } }
    });
    console.log('✅ Nodo: Enviar Notif Admin WA');
  }

  // ── UPDATE CONNECTIONS ──

  // Routear Pedido → Preparar Pedido Claude + Menu del Negocio (normal)
  wf.connections['Routear Pedido'] = {
    main: [[
      { node: 'Menu del Negocio', type: 'main', index: 0 },
      { node: 'Preparar Pedido Claude', type: 'main', index: 0 }
    ]]
  };

  // Preparar Pedido Claude → Claude Pedidos
  wf.connections['Preparar Pedido Claude'] = {
    main: [[{ node: 'Claude Pedidos', type: 'main', index: 0 }]]
  };

  // Claude Pedidos → Procesar Respuesta Pedido
  wf.connections['Claude Pedidos'] = {
    main: [[{ node: 'Procesar Respuesta Pedido', type: 'main', index: 0 }]]
  };

  // Procesar Respuesta Pedido → Enviar Respuesta Pedido + Notificar Admin
  wf.connections['Procesar Respuesta Pedido'] = {
    main: [[
      { node: 'Enviar Respuesta Pedido', type: 'main', index: 0 },
      { node: 'Notificar Admin Pedido', type: 'main', index: 0 }
    ]]
  };

  // Notificar Admin Pedido → Enviar Notif Admin WA
  wf.connections['Notificar Admin Pedido'] = {
    main: [[{ node: 'Enviar Notif Admin WA', type: 'main', index: 0 }]]
  };

  console.log('✅ Conexiones actualizadas');

  // Save
  const saveResp = await fetch(API, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await saveResp.json();
  if (result.id) {
    console.log('\n🚀 Guardado! Nodos:', result.nodes.length);
    console.log('\n🧠 FLUJO INTELIGENTE:');
    console.log('  Cliente responde a cadena → Claude entiende contexto');
    console.log('  Claude recopila: cantidad, nombre, dirección');
    console.log('  Cuando tiene todo → confirma + notifica admin');
  } else {
    console.log('Error:', JSON.stringify(result).substring(0, 500));
  }
}
main();
