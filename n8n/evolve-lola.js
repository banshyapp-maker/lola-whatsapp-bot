const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';
const WF_ID = '2EZ0PqE6jOX9NHwo';
const WHATSAPP_CRED_ID = 'aynBnx2PMAwRJ7ya';
const ANTHROPIC_CRED_ID = 'QgassfKnwcBfuDFW';
const OPENAI_CRED_ID = 'Rg3uajuLBViWJXpv';
const ADMIN_PHONE = '50768384242';

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://n8n.solucionesomicron.com/api/v1' + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method,
      headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' }
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(chunks.join(''))); }
        catch(e) { resolve(chunks.join('')); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const wf = await apiCall('GET', '/workflows/' + WF_ID);
  console.log('Got workflow:', wf.name, '- Nodes:', wf.nodes.length);

  // =====================================================
  // STEP 1: Add "Menu del Negocio" Code node
  // =====================================================
  const menuNode = {
    parameters: {
      jsCode: [
        '// ========== MENU DE LOLA - EDITA AQUI ==========',
        '// Cambia productos, precios y disponibilidad',
        '// Para agregar: copia una linea y modifica',
        '// Para quitar: borra la linea o pon disponible: false',
        '',
        'const MENU = [',
        '  { producto: "Chicharrones", precio: 6.00, descripcion: "Chicharrones crujientes artesanales", disponible: true },',
        '  { producto: "Empanadas de Carne", precio: 1.50, descripcion: "Empanadas rellenas de carne molida", disponible: true },',
        '  { producto: "Empanadas de Pollo", precio: 1.50, descripcion: "Empanadas rellenas de pollo desmechado", disponible: true },',
        '  { producto: "Patacones con Queso", precio: 4.00, descripcion: "Patacones dobles con queso fundido", disponible: true },',
        '  { producto: "Ceviche de Corvina", precio: 8.00, descripcion: "Ceviche fresco del dia", disponible: true },',
        '  { producto: "Arroz con Pollo", precio: 5.00, descripcion: "Arroz con pollo panameno", disponible: true },',
        '];',
        '',
        '// ========== NO TOCAR DE AQUI PARA ABAJO ==========',
        'const menuDisponible = MENU.filter(m => m.disponible);',
        'const menuTexto = menuDisponible.map(m => "- " + m.producto + " - $" + m.precio.toFixed(2) + " (" + m.descripcion + ")").join("\\n");',
        '',
        'return [{',
        '  json: {',
        '    menu: MENU,',
        '    menuDisponible,',
        '    menuTexto,',
        '    phoneNumber: $input.first().json.phoneNumber,',
        '    messageContent: $input.first().json.messageContent,',
        '    isAudio: $input.first().json.isAudio || false',
        '  }',
        '}];',
      ].join('\n')
    },
    id: 'menu-node-001',
    name: 'Menu del Negocio',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1980, 300]
  };

  // =====================================================
  // STEP 2: Add "Es Comando Cadena?" node
  // =====================================================
  const esAdminNode = {
    parameters: {
      jsCode: [
        'const item = $input.first().json;',
        'const ADMIN_PHONE = "' + ADMIN_PHONE + '";',
        'const isAdmin = item.phoneNumber === ADMIN_PHONE;',
        'const msg = (item.messageContent || "").toLowerCase();',
        'const isBroadcast = isAdmin && (',
        '  msg.includes("envia la cadena") ||',
        '  msg.includes("envia cadena") ||',
        '  msg.includes("manda la cadena") ||',
        '  msg.includes("enviar cadena") ||',
        '  msg.includes("enviar la cadena")',
        ');',
        'if (isBroadcast) {',
        '  return [{ json: { ...item, action: "broadcast" } }];',
        '}',
        'return [];',
      ].join('\n')
    },
    id: 'es-admin-001',
    name: 'Es Comando Cadena?',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1680, 100]
  };

  // =====================================================
  // STEP 3: Add "No Es Cadena" node
  // =====================================================
  const noEsCadenaNode = {
    parameters: {
      jsCode: [
        'const item = $input.first().json;',
        'const ADMIN_PHONE = "' + ADMIN_PHONE + '";',
        'const msg = (item.messageContent || "").toLowerCase();',
        'const isBroadcast = item.phoneNumber === ADMIN_PHONE && (',
        '  msg.includes("envia la cadena") ||',
        '  msg.includes("envia cadena") ||',
        '  msg.includes("manda la cadena") ||',
        '  msg.includes("enviar cadena") ||',
        '  msg.includes("enviar la cadena")',
        ');',
        'if (!isBroadcast) {',
        '  return [{ json: item }];',
        '}',
        'return [];',
      ].join('\n')
    },
    id: 'no-cadena-001',
    name: 'No Es Cadena',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1680, 500]
  };

  // =====================================================
  // STEP 4: Add "Generar Cadena" node
  // =====================================================
  const generarCadenaNode = {
    parameters: {
      jsCode: [
        'const MENU = [',
        '  { producto: "Chicharrones", precio: 6.00, disponible: true },',
        '  { producto: "Empanadas de Carne", precio: 1.50, disponible: true },',
        '  { producto: "Empanadas de Pollo", precio: 1.50, disponible: true },',
        '  { producto: "Patacones con Queso", precio: 4.00, disponible: true },',
        '  { producto: "Ceviche de Corvina", precio: 8.00, disponible: true },',
        '  { producto: "Arroz con Pollo", precio: 5.00, disponible: true },',
        '];',
        '',
        'const menuDisp = MENU.filter(m => m.disponible);',
        'const menuTexto = menuDisp.map(m => "\\u2022 *" + m.producto + "* - $" + m.precio.toFixed(2)).join("\\n");',
        '',
        'const mensaje = "\\ud83d\\udd25 *Hola! Soy Lola de El Istmo!* \\ud83d\\udd25\\n\\n"',
        '  + "Mira lo que tenemos hoy para ti:\\n\\n"',
        '  + menuTexto + "\\n\\n"',
        '  + "\\ud83d\\udcf2 *Responde con lo que quieras pedir*\\n"',
        '  + "Ejemplo: Quiero 2 empanadas de carne\\n\\n"',
        '  + "Te atiendo al instante! \\ud83d\\ude0a";',
        '',
        'return [{ json: { mensaje } }];',
      ].join('\n')
    },
    id: 'generar-cadena-001',
    name: 'Generar Cadena',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2240, -200]
  };

  // =====================================================
  // STEP 5: Add "Lista de Contactos" node
  // =====================================================
  const listaContactosNode = {
    parameters: {
      jsCode: [
        '// ========== LISTA DE CONTACTOS - EDITA AQUI ==========',
        '// Agrega o quita numeros de WhatsApp (con codigo de pais)',
        '',
        'const CONTACTOS = [',
        '  "50768384242",',
        '  // Agrega mas numeros aqui:',
        '  // "50761111111",',
        '  // "50762222222",',
        '];',
        '',
        '// ========== NO TOCAR DE AQUI PARA ABAJO ==========',
        'const mensaje = $input.first().json.mensaje;',
        'const items = CONTACTOS.map(numero => ({',
        '  json: { phoneNumber: numero, mensaje }',
        '}));',
        'return items;',
      ].join('\n')
    },
    id: 'lista-contactos-001',
    name: 'Lista de Contactos',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2500, -200]
  };

  // =====================================================
  // STEP 6: Add "Enviar Cadena" HTTP node
  // =====================================================
  const enviarCadenaNode = {
    parameters: {
      method: 'POST',
      url: 'https://graph.facebook.com/v21.0/1103393509513315/messages',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify({ messaging_product: "whatsapp", to: $json.phoneNumber, type: "text", text: { body: $json.mensaje } }) }}',
      options: {}
    },
    id: 'enviar-cadena-001',
    name: 'Enviar Cadena',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [2760, -200],
    credentials: {
      httpHeaderAuth: { id: WHATSAPP_CRED_ID, name: 'WhatsApp Token' }
    }
  };

  // =====================================================
  // STEP 7: Add "Confirmar Envio al Admin" HTTP node
  // =====================================================
  const confirmarEnvioNode = {
    parameters: {
      method: 'POST',
      url: 'https://graph.facebook.com/v21.0/1103393509513315/messages',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify({ messaging_product: "whatsapp", to: "' + ADMIN_PHONE + '", type: "text", text: { body: "Cadena enviada a todos los contactos de la lista." } }) }}',
      options: {}
    },
    id: 'confirmar-envio-001',
    name: 'Confirmar Envio al Admin',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [3020, -200],
    credentials: {
      httpHeaderAuth: { id: WHATSAPP_CRED_ID, name: 'WhatsApp Token' }
    }
  };

  // =====================================================
  // STEP 8: Add "Preparar Notif Pedido" node
  // =====================================================
  const notificarPedidoNode = {
    parameters: {
      jsCode: [
        'const item = $input.first().json;',
        '',
        'if (item.hasOrder && item.orderDetails) {',
        '  const now = new Date().toLocaleString("es-PA", { timeZone: "America/Panama" });',
        '  const mensaje = "NUEVO PEDIDO\\n\\n"',
        '    + "Fecha: " + now + "\\n"',
        '    + "Tel: " + item.phoneNumber + "\\n\\n"',
        '    + item.orderDetails + "\\n\\n"',
        '    + "---\\nResponde al cliente para confirmar entrega.";',
        '  return [{ json: { ...item, adminNotifMsg: mensaje } }];',
        '}',
        'return [{ json: item }];',
      ].join('\n')
    },
    id: 'notificar-pedido-001',
    name: 'Preparar Notif Pedido',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2700, 300]
  };

  // =====================================================
  // STEP 9: Add "Tiene Pedido?" filter node
  // =====================================================
  const filtroPedidoNode = {
    parameters: {
      jsCode: [
        'const item = $input.first().json;',
        'if (item.hasOrder && item.adminNotifMsg) {',
        '  return [{ json: { mensaje: item.adminNotifMsg } }];',
        '}',
        'return [];',
      ].join('\n')
    },
    id: 'filtro-pedido-001',
    name: 'Tiene Pedido?',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2960, 450]
  };

  // =====================================================
  // STEP 10: Add "WhatsApp Notif Admin" HTTP node
  // =====================================================
  const httpNotifAdminNode = {
    parameters: {
      method: 'POST',
      url: 'https://graph.facebook.com/v21.0/1103393509513315/messages',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify({ messaging_product: "whatsapp", to: "' + ADMIN_PHONE + '", type: "text", text: { body: $json.mensaje } }) }}',
      options: {}
    },
    id: 'http-notif-admin-001',
    name: 'WhatsApp Notif Admin',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [3220, 450],
    credentials: {
      httpHeaderAuth: { id: WHATSAPP_CRED_ID, name: 'WhatsApp Token' }
    }
  };

  // =====================================================
  // STEP 11: Update "Procesar Respuesta" to detect orders
  // =====================================================
  const procesarResp = wf.nodes.find(n => n.name === 'Procesar Respuesta');
  procesarResp.parameters.jsCode = [
    'const response = $input.first().json;',
    'let text = "";',
    '',
    'try {',
    '  text = response.content[0].text;',
    '} catch (e) {',
    '  text = "Ay, disculpa! Tuve un problemita tecnico. Intenta de nuevo en un momentito.";',
    '}',
    '',
    'const needsEscalation = text.includes("[ESCALAR_A_HUMANO]");',
    'if (needsEscalation) {',
    '  text = text.replace("[ESCALAR_A_HUMANO]", "").trim();',
    '}',
    '',
    '// Detect confirmed order',
    'const hasOrder = text.includes("[PEDIDO_CONFIRMADO]");',
    'let orderDetails = "";',
    'if (hasOrder) {',
    '  const orderMatch = text.match(/\\[PEDIDO_CONFIRMADO\\]([\\s\\S]*?)\\[FIN_PEDIDO\\]/);',
    '  if (orderMatch) {',
    '    orderDetails = orderMatch[1].trim();',
    '  }',
    '  text = text.replace(/\\[PEDIDO_CONFIRMADO\\][\\s\\S]*?\\[FIN_PEDIDO\\]/, "").trim();',
    '}',
    '',
    'const phoneNumber = $("Extraer Datos").first().json.phoneNumber;',
    '',
    'let isAudio = false;',
    'try {',
    '  isAudio = $("Texto del Audio").first().json.isAudio === true;',
    '} catch(e) {',
    '  try {',
    '    isAudio = $("Preparar Texto").first().json.isAudio === true;',
    '  } catch(e2) {',
    '    try {',
    '      isAudio = $("Texto de Imagen").first().json.isAudio === true;',
    '    } catch(e3) {',
    '      isAudio = false;',
    '    }',
    '  }',
    '}',
    '',
    'if (text.length > 4000) {',
    '  text = text.substring(0, 4000) + "...";',
    '}',
    '',
    'return [{',
    '  json: {',
    '    phoneNumber,',
    '    responseText: text,',
    '    needsEscalation,',
    '    isAudio,',
    '    hasOrder,',
    '    orderDetails',
    '  }',
    '}];',
  ].join('\n');

  // =====================================================
  // STEP 12: Update Claude AI system prompt
  // =====================================================
  const claudeNode = wf.nodes.find(n => n.name === 'Claude AI Lola');

  const systemPrompt = [
    'Eres Lola, la asistente virtual de ventas de El Istmo. Eres amigable, carinosa y hablas con tono panameno/colombiano casual. Usas emojis con moderacion.',
    '',
    'TU TRABAJO:',
    '- Ayudar a los clientes a hacer pedidos del menu',
    '- Responder preguntas sobre los productos',
    '- Confirmar pedidos con cantidades y precios',
    '- Ser amable y eficiente',
    '',
    'MENU DISPONIBLE HOY:',
    '{{ $json.menuTexto }}',
    '',
    'REGLAS IMPORTANTES:',
    '1. Solo puedes vender lo que esta en el menu de arriba',
    '2. Si piden algo que no esta, diles amablemente que si hay disponible',
    '3. Cuando un cliente CONFIRME su pedido, incluye este formato EXACTO:',
    '   [PEDIDO_CONFIRMADO]',
    '   Producto: nombre - Cantidad: X - Precio: $X.XX',
    '   TOTAL: $XX.XX',
    '   [FIN_PEDIDO]',
    '4. Despues del bloque de pedido, escribe un mensaje bonito confirmando al cliente',
    '5. Si el cliente NO ha confirmado aun, preguntale si quiere confirmar',
    '6. Calcula bien los totales (precio x cantidad)',
    '7. Si alguien manda una imagen, comenta amablemente y ofrece el menu',
    '8. Si necesitan hablar con una persona real, incluye [ESCALAR_A_HUMANO]',
    '',
    'EJEMPLO:',
    '- Cliente: "Quiero 2 empanadas de carne"',
    '  Lola: "Claro! 2 empanadas de carne por $3.00. Te confirmo el pedido o quieres agregar algo mas?"',
    '- Cliente: "Si, confirmalo"',
    '  Lola: "[PEDIDO_CONFIRMADO]',
    '  Producto: Empanadas de Carne - Cantidad: 2 - Precio: $3.00',
    '  TOTAL: $3.00',
    '  [FIN_PEDIDO]',
    '  Listo! Tu pedido de 2 empanadas de carne esta confirmado. Te avisamos cuando este listo!"',
    '',
    'NO hagas:',
    '- No inventes productos que no estan en el menu',
    '- No des precios incorrectos',
    '- No seas muy formal, manten el tono amigable y cercano',
    '- No respondas mensajes muy largos, se concisa',
  ].join('\n');

  if (!claudeNode.parameters.options) {
    claudeNode.parameters.options = {};
  }
  claudeNode.parameters.options.systemMessage = systemPrompt;

  console.log('Updated Claude AI system prompt');

  // =====================================================
  // STEP 13: Add all new nodes to workflow
  // =====================================================
  wf.nodes.push(
    menuNode,
    esAdminNode,
    noEsCadenaNode,
    generarCadenaNode,
    listaContactosNode,
    enviarCadenaNode,
    confirmarEnvioNode,
    notificarPedidoNode,
    filtroPedidoNode,
    httpNotifAdminNode
  );

  console.log('Added 10 new nodes. Total:', wf.nodes.length);

  // =====================================================
  // STEP 14: Update connections
  // =====================================================
  const conn = wf.connections;

  // Preparar Texto -> [Es Comando Cadena?, No Es Cadena]
  conn['Preparar Texto'] = {
    main: [[
      { node: 'Es Comando Cadena?', type: 'main', index: 0 },
      { node: 'No Es Cadena', type: 'main', index: 0 }
    ]]
  };

  // Broadcast path: Es Comando Cadena? -> Generar Cadena -> Lista -> Enviar -> Confirmar
  conn['Es Comando Cadena?'] = {
    main: [[{ node: 'Generar Cadena', type: 'main', index: 0 }]]
  };
  conn['Generar Cadena'] = {
    main: [[{ node: 'Lista de Contactos', type: 'main', index: 0 }]]
  };
  conn['Lista de Contactos'] = {
    main: [[{ node: 'Enviar Cadena', type: 'main', index: 0 }]]
  };
  conn['Enviar Cadena'] = {
    main: [[{ node: 'Confirmar Envio al Admin', type: 'main', index: 0 }]]
  };

  // Normal path: No Es Cadena -> Menu del Negocio -> Claude AI Lola
  conn['No Es Cadena'] = {
    main: [[{ node: 'Menu del Negocio', type: 'main', index: 0 }]]
  };

  // Audio and Image also go to Menu (never broadcast commands)
  conn['Texto del Audio'] = {
    main: [[{ node: 'Menu del Negocio', type: 'main', index: 0 }]]
  };
  conn['Texto de Imagen'] = {
    main: [[{ node: 'Menu del Negocio', type: 'main', index: 0 }]]
  };

  // Menu del Negocio -> Claude AI Lola
  conn['Menu del Negocio'] = {
    main: [[{ node: 'Claude AI Lola', type: 'main', index: 0 }]]
  };

  // Procesar Respuesta -> Preparar Notif Pedido
  conn['Procesar Respuesta'] = {
    main: [[{ node: 'Preparar Notif Pedido', type: 'main', index: 0 }]]
  };

  // Preparar Notif Pedido -> [Es Respuesta Audio?, Es Respuesta Texto?, Tiene Pedido?]
  conn['Preparar Notif Pedido'] = {
    main: [[
      { node: 'Es Respuesta Audio?', type: 'main', index: 0 },
      { node: 'Es Respuesta Texto?', type: 'main', index: 0 },
      { node: 'Tiene Pedido?', type: 'main', index: 0 }
    ]]
  };

  // Tiene Pedido? -> WhatsApp Notif Admin
  conn['Tiene Pedido?'] = {
    main: [[{ node: 'WhatsApp Notif Admin', type: 'main', index: 0 }]]
  };

  // =====================================================
  // STEP 15: Update workflow
  // =====================================================
  const payload = {
    name: 'Lola Bot - Ventas El Istmo',
    nodes: wf.nodes,
    connections: conn,
    settings: wf.settings,
    staticData: wf.staticData
  };

  console.log('Sending update with', wf.nodes.length, 'nodes...');
  const result = await apiCall('PUT', '/workflows/' + WF_ID, payload);

  if (result.id) {
    console.log('\n=== WORKFLOW ACTUALIZADO ===');
    console.log('Nombre:', result.name);
    console.log('Active:', result.active);
    console.log('Total nodos:', result.nodes.length);

    const newNodeNames = [
      'Menu del Negocio', 'Es Comando Cadena?', 'No Es Cadena',
      'Generar Cadena', 'Lista de Contactos', 'Enviar Cadena',
      'Confirmar Envio al Admin', 'Preparar Notif Pedido',
      'Tiene Pedido?', 'WhatsApp Notif Admin'
    ];

    console.log('\nNuevos nodos:');
    newNodeNames.forEach(name => {
      const found = result.nodes.find(n => n.name === name);
      console.log(found ? '  OK' : '  MISSING', name);
    });

    const claude = result.nodes.find(n => n.name === 'Claude AI Lola');
    const hasPrompt = claude.parameters.options && claude.parameters.options.systemMessage;
    console.log('\nClaude prompt actualizado:', hasPrompt ? 'OK' : 'MISSING');

    console.log('\nTodos los nodos:');
    result.nodes.forEach(n => console.log('  -', n.name));

    console.log('\n=== LISTO ===');
  } else {
    console.log('ERROR:', JSON.stringify(result).substring(0, 800));
  }
}

main().catch(e => console.error(e));
