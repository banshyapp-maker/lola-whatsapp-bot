/**
 * Script: update-cadena-pedidos.js
 * Actualiza el workflow de Lola para:
 * 1. Lista de contactos con nombres
 * 2. Enviar imagen (cadena) en vez de texto
 * 3. Flujo de pedido: imagen -> cantidad -> dirección -> confirmación
 */

const API = 'https://n8n.solucionesomicron.com/api/v1/workflows/2EZ0PqE6jOX9NHwo';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';
const WA_CRED = 'ShasMEORV7ZkA7ks';
const PHONE_ID = '1103393509513315';

// ⚠️ CAMBIAR ESTO con la URL publica de la imagen
const IMAGE_URL = 'IMAGEN_URL_AQUI';

async function main() {
  console.log('📥 Descargando workflow...');
  const r = await fetch(API, { headers: { 'X-N8N-API-KEY': KEY } });
  const wf = await r.json();
  console.log('Nodos actuales:', wf.nodes.length);

  // ─────────────────────────────────────────────
  // 1. ACTUALIZAR NODOS EXISTENTES
  // ─────────────────────────────────────────────
  for (const node of wf.nodes) {

    // Lista de Contactos: agregar nombres y pasar imageUrl
    if (node.name === 'Lista de Contactos') {
      node.parameters.jsCode = `
// ========== LISTA DE CONTACTOS - EDITA AQUI ==========
const CONTACTOS = [
  { numero: "50769815135", nombre: "Vladimir" },
  { numero: "50768384242", nombre: "Veronica" },
  { numero: "50763340124", nombre: "Genesis" },
];
// ======================================================

const imageUrl = $input.first().json.imageUrl;
const caption  = $input.first().json.caption;

// Marcar cada contacto como "esperando pedido" en static data
const staticData = $getWorkflowStaticData('global');
for (const c of CONTACTOS) {
  staticData['pedido_' + c.numero] = {
    estado: 'esperando_cantidad',
    nombre: c.nombre
  };
}

return CONTACTOS.map(c => ({
  json: { phoneNumber: c.numero, nombre: c.nombre, imageUrl, caption }
}));
`;
      console.log('✅ Lista de Contactos actualizada (Vladimir, Veronica, Genesis)');
    }

    // Generar Cadena: ahora genera datos para imagen
    if (node.name === 'Generar Cadena') {
      node.parameters.jsCode = `
return [{
  json: {
    imageUrl: "${IMAGE_URL}",
    caption: "🔥 *Hola! Soy Lola de El Istmo* 🔥\\n\\nMira lo que cocinamos HOY para ti!\\n\\n💰 Solo $8.00\\n🛵 Delivery GRATIS\\n\\n👇 Responde con la *cantidad* que quieres pedir y te atiendo! 😊"
  }
}];
`;
      console.log('✅ Generar Cadena: ahora prepara imagen');
    }

    // Enviar Cadena: cambiar de texto a imagen
    if (node.name === 'Enviar Cadena') {
      node.parameters.jsonBody = '={{ JSON.stringify({ messaging_product: "whatsapp", to: $json.phoneNumber, type: "image", image: { link: $json.imageUrl, caption: $json.caption } }) }}';
      console.log('✅ Enviar Cadena: ahora envia imagen');
    }
  }

  // ─────────────────────────────────────────────
  // 2. AGREGAR NODOS NUEVOS (flujo de pedido)
  // ─────────────────────────────────────────────

  // Verificar si ya existen (para no duplicar)
  const nombresExistentes = wf.nodes.map(n => n.name);

  if (!nombresExistentes.includes('Verificar Estado Pedido')) {
    wf.nodes.push({
      parameters: {
        jsCode: `
// Revisa si este numero está en proceso de pedido
const staticData = $getWorkflowStaticData('global');
const phone = $input.first().json.phoneNumber;
const estado = staticData['pedido_' + phone];
if (estado) {
  return [{ json: { ...$input.first().json, estadoPedido: estado.estado, nombreContacto: estado.nombre, cantidad: estado.cantidad || '' } }];
} else {
  return [{ json: { ...$input.first().json, estadoPedido: 'normal', nombreContacto: '' } }];
}
`
      },
      id: 'order-check-001',
      name: 'Verificar Estado Pedido',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1060, 400]
    });
    console.log('✅ Nodo agregado: Verificar Estado Pedido');
  }

  if (!nombresExistentes.includes('Routear Pedido')) {
    wf.nodes.push({
      parameters: {
        jsCode: `
const estado = $input.first().json.estadoPedido;
if (estado === 'esperando_cantidad') {
  return [{ json: { ...$input.first().json, _route: 'cantidad' } }];
} else if (estado === 'esperando_direccion') {
  return [{ json: { ...$input.first().json, _route: 'direccion' } }];
} else {
  return [{ json: { ...$input.first().json, _route: 'normal' } }];
}
`
      },
      id: 'order-route-001',
      name: 'Routear Pedido',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1300, 400]
    });
    console.log('✅ Nodo agregado: Routear Pedido');
  }

  if (!nombresExistentes.includes('Guardar Cantidad')) {
    wf.nodes.push({
      parameters: {
        jsCode: `
const staticData = $getWorkflowStaticData('global');
const phone    = $input.first().json.phoneNumber;
const cantidad = $input.first().json.messageContent;
const nombre   = $input.first().json.nombreContacto || phone;

// Actualizar estado a esperando dirección
staticData['pedido_' + phone] = {
  estado: 'esperando_direccion',
  cantidad: cantidad,
  nombre: nombre
};

return [{ json: {
  phoneNumber: phone,
  respuesta: '✅ *' + cantidad + '* anotado, ' + nombre + '! 📝\\n\\n📍 ¿Cuál es tu *dirección de entrega*?'
}}];
`
      },
      id: 'order-qty-001',
      name: 'Guardar Cantidad',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1540, 300]
    });
    console.log('✅ Nodo agregado: Guardar Cantidad');
  }

  if (!nombresExistentes.includes('Confirmar Pedido')) {
    wf.nodes.push({
      parameters: {
        jsCode: `
const staticData = $getWorkflowStaticData('global');
const phone     = $input.first().json.phoneNumber;
const direccion = $input.first().json.messageContent;
const pedido    = staticData['pedido_' + phone] || {};

const resumen = {
  telefono: phone,
  nombre:   pedido.nombre   || phone,
  cantidad: pedido.cantidad || 'N/A',
  direccion: direccion,
  hora: new Date().toLocaleString('es-PA', { timeZone: 'America/Panama' })
};

// Limpiar estado
delete staticData['pedido_' + phone];

return [{ json: {
  phoneNumber: phone,
  respuesta: '🎉 *Pedido confirmado!*\\n\\n👤 ' + resumen.nombre + '\\n📦 Cantidad: ' + resumen.cantidad + '\\n📍 Dirección: ' + resumen.direccion + '\\n⏱️ En camino pronto!\\n\\nGracias por tu pedido! 😊🛵',
  pedidoFinal: resumen
}}];
`
      },
      id: 'order-addr-001',
      name: 'Confirmar Pedido',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1540, 500]
    });
    console.log('✅ Nodo agregado: Confirmar Pedido');
  }

  if (!nombresExistentes.includes('Enviar Respuesta Pedido')) {
    wf.nodes.push({
      parameters: {
        method: 'POST',
        url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ messaging_product: "whatsapp", to: $json.phoneNumber, type: "text", text: { body: $json.respuesta } }) }}',
        options: {}
      },
      id: 'order-send-001',
      name: 'Enviar Respuesta Pedido',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1780, 400],
      credentials: { httpHeaderAuth: { id: WA_CRED, name: 'WhatsApp Token' } }
    });
    console.log('✅ Nodo agregado: Enviar Respuesta Pedido');
  }

  if (!nombresExistentes.includes('Notif Admin Pedido')) {
    wf.nodes.push({
      parameters: {
        method: 'POST',
        url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ messaging_product: "whatsapp", to: "50768384242", type: "text", text: { body: "📋 *NUEVO PEDIDO*\\n👤 " + $json.pedidoFinal.nombre + " (" + $json.pedidoFinal.telefono + ")\\n📦 Cantidad: " + $json.pedidoFinal.cantidad + "\\n📍 Dirección: " + $json.pedidoFinal.direccion + "\\n🕐 " + $json.pedidoFinal.hora } }) }}',
        options: {}
      },
      id: 'order-notif-001',
      name: 'Notif Admin Pedido',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [2020, 400],
      credentials: { httpHeaderAuth: { id: WA_CRED, name: 'WhatsApp Token' } }
    });
    console.log('✅ Nodo agregado: Notif Admin Pedido');
  }

  // ─────────────────────────────────────────────
  // 3. ACTUALIZAR CONEXIONES
  // ─────────────────────────────────────────────

  // Solo Texto -> Verificar Estado Pedido (antes iba a Preparar Texto directo)
  wf.connections['Solo Texto'] = {
    main: [[{ node: 'Verificar Estado Pedido', type: 'main', index: 0 }]]
  };

  // Verificar Estado Pedido -> Routear Pedido
  wf.connections['Verificar Estado Pedido'] = {
    main: [[{ node: 'Routear Pedido', type: 'main', index: 0 }]]
  };

  // Routear Pedido -> 3 salidas según estado
  wf.connections['Routear Pedido'] = {
    main: [
      [{ node: 'Preparar Texto', type: 'main', index: 0 }],      // output 0: normal
      [{ node: 'Guardar Cantidad', type: 'main', index: 0 }],    // output 1: esperando_cantidad
      [{ node: 'Confirmar Pedido', type: 'main', index: 0 }]     // output 2: esperando_direccion
    ]
  };

  // Guardar Cantidad -> Enviar Respuesta Pedido
  wf.connections['Guardar Cantidad'] = {
    main: [[{ node: 'Enviar Respuesta Pedido', type: 'main', index: 0 }]]
  };

  // Confirmar Pedido -> Enviar Respuesta Pedido + Notif Admin
  wf.connections['Confirmar Pedido'] = {
    main: [[
      { node: 'Enviar Respuesta Pedido', type: 'main', index: 0 },
      { node: 'Notif Admin Pedido', type: 'main', index: 0 }
    ]]
  };

  console.log('✅ Conexiones actualizadas');

  // ─────────────────────────────────────────────
  // 4. GUARDAR EN N8N
  // ─────────────────────────────────────────────
  console.log('\n💾 Guardando workflow...');
  const saveResp = await fetch(API, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: wf.settings
    })
  });

  const result = await saveResp.json();
  if (result.id) {
    console.log('\n🚀 ¡LISTO! Workflow actualizado');
    console.log('   Nodos totales:', result.nodes.length);
    console.log('   Activo:', result.active);
    console.log('\n⚠️  PENDIENTE: Cambiar IMAGE_URL con la URL real de la imagen');
  } else {
    console.error('❌ Error:', JSON.stringify(result).substring(0, 300));
  }
}

main().catch(console.error);
