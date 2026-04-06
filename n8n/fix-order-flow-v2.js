const API = 'https://n8n.solucionesomicron.com/api/v1/workflows/2EZ0PqE6jOX9NHwo';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';
const ADMIN = '50768384242';
const WA_CRED_ID = 'RuldJqintIRvefni';
const PHONE_ID = '1103393509513315';

async function main() {
  const r = await fetch(API, { headers: { 'X-N8N-API-KEY': KEY } });
  const wf = await r.json();

  for (const node of wf.nodes) {

    // Lista de Contactos: mark ALL contacts (including admin) as esperando_cantidad
    if (node.name === 'Lista de Contactos') {
      node.parameters.jsCode = `
// ========== LISTA DE CONTACTOS ==========
const CONTACTOS = [
  { numero: "50769815135", nombre: "Vladimir" },
  { numero: "50768384242", nombre: "Veronica" },
];
// =========================================

const imageUrl = $input.first().json.imageUrl;
const caption  = $input.first().json.caption;

const staticData = $getWorkflowStaticData('global');
for (const c of CONTACTOS) {
  staticData['pedido_' + c.numero] = {
    estado: 'esperando_cantidad',
    nombre: ''
  };
}

return CONTACTOS.map(c => ({
  json: { phoneNumber: c.numero, nombre: c.nombre, imageUrl, caption }
}));
`;
      console.log('✅ Lista de Contactos: todos marcados (incluido admin)');
    }

    // Es Comando Cadena?: clear any existing order state for admin before sending cadena
    if (node.name === 'Es Comando Cadena?') {
      node.parameters.jsCode = `
const ADMIN = "${ADMIN}";
const item = $input.first().json;
const phone = item.phoneNumber;
const msg = (item.messageContent || "").toLowerCase().trim();
const esCadena = msg.includes("cadena");
const esAdmin = phone === ADMIN;

if (esAdmin && esCadena) {
  // Clear admin's own order state so cadena command works
  const staticData = $getWorkflowStaticData('global');
  delete staticData['pedido_' + ADMIN];
  return [{ json: { ...item, esCadena: true } }];
} else {
  return [];
}
`;
      console.log('✅ Es Comando Cadena?: limpia estado admin antes de enviar');
    }

    // Guardar Cantidad: save quantity, ask for NAME (not address)
    if (node.name === 'Guardar Cantidad') {
      node.parameters.jsCode = `
const route = $input.first().json._route;
if (route !== 'cantidad') return [];

const staticData = $getWorkflowStaticData('global');
const phone    = $input.first().json.phoneNumber;
const cantidad = $input.first().json.messageContent;

staticData['pedido_' + phone] = {
  estado: 'esperando_nombre',
  cantidad: cantidad
};

return [{ json: {
  phoneNumber: phone,
  respuesta: "\\u2705 Perfecto! *" + cantidad + "* de Arroz con Marisco anotado.\\n\\n\\u00bfCu\\u00e1l es tu *nombre*?"
}}];
`;
      console.log('✅ Guardar Cantidad: ahora pregunta nombre');
    }

    // Confirmar Pedido: now handles ADDRESS (final step)
    if (node.name === 'Confirmar Pedido') {
      node.parameters.jsCode = `
const route = $input.first().json._route;
if (route !== 'direccion') return [];

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

delete staticData['pedido_' + phone];

return [{ json: {
  phoneNumber: phone,
  respuesta: "\\ud83c\\udf89 *Pedido confirmado!*\\n\\n\\ud83d\\udc64 " + resumen.nombre + "\\n\\ud83d\\udce6 Cantidad: " + resumen.cantidad + "\\n\\ud83d\\udccd Direcci\\u00f3n: " + resumen.direccion + "\\n\\u23f1\\ufe0f En camino pronto!\\n\\nGracias por tu pedido! \\ud83d\\ude0a\\ud83d\\udef5",
  pedidoFinal: resumen
}}];
`;
      console.log('✅ Confirmar Pedido: paso final con dirección');
    }

    // Routear Pedido: add new state 'esperando_nombre'
    if (node.name === 'Routear Pedido') {
      node.parameters.jsCode = `
const estado = $input.first().json.estadoPedido;
const item = $input.first().json;
if (estado === 'esperando_cantidad') {
  return [{ json: { ...item, _route: 'cantidad' } }];
} else if (estado === 'esperando_nombre') {
  return [{ json: { ...item, _route: 'nombre' } }];
} else if (estado === 'esperando_direccion') {
  return [{ json: { ...item, _route: 'direccion' } }];
} else {
  return [{ json: { ...item, _route: 'normal' } }];
}
`;
      console.log('✅ Routear Pedido: agregado estado esperando_nombre');
    }
  }

  // Add new node: Guardar Nombre
  const existingNames = wf.nodes.map(n => n.name);
  if (!existingNames.includes('Guardar Nombre')) {
    wf.nodes.push({
      parameters: {
        jsCode: `
const route = $input.first().json._route;
if (route !== 'nombre') return [];

const staticData = $getWorkflowStaticData('global');
const phone  = $input.first().json.phoneNumber;
const nombre = $input.first().json.messageContent;
const pedido = staticData['pedido_' + phone] || {};

staticData['pedido_' + phone] = {
  estado: 'esperando_direccion',
  cantidad: pedido.cantidad || 'N/A',
  nombre: nombre
};

return [{ json: {
  phoneNumber: phone,
  respuesta: "Gracias " + nombre + "! \\ud83d\\udccd \\u00bfCu\\u00e1l es tu *direcci\\u00f3n de entrega*?"
}}];
`
      },
      id: 'order-name-001',
      name: 'Guardar Nombre',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1540, 200]
    });
    console.log('✅ Nodo agregado: Guardar Nombre');
  }

  // Update connections: Routear Pedido → all 4 destinations on output 0
  wf.connections['Routear Pedido'] = {
    main: [[
      { node: 'Menu del Negocio', type: 'main', index: 0 },
      { node: 'Guardar Cantidad', type: 'main', index: 0 },
      { node: 'Guardar Nombre', type: 'main', index: 0 },
      { node: 'Confirmar Pedido', type: 'main', index: 0 }
    ]]
  };

  // Guardar Nombre → Enviar Respuesta Pedido
  wf.connections['Guardar Nombre'] = {
    main: [[{ node: 'Enviar Respuesta Pedido', type: 'main', index: 0 }]]
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
    console.log('\nFLUJO DE PEDIDO:');
    console.log('  1. Cliente recibe imagen');
    console.log('  2. Responde "quiero 3" → Lola: "Perfecto! 3 de Arroz con Marisco. ¿Tu nombre?"');
    console.log('  3. Responde "Vladimir" → Lola: "Gracias Vladimir! ¿Tu dirección?"');
    console.log('  4. Responde dirección → Lola confirma + notifica admin');
  } else {
    console.log('Error:', JSON.stringify(result).substring(0, 300));
  }
}
main();
