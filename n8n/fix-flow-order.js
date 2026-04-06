const API = 'https://n8n.solucionesomicron.com/api/v1/workflows/2EZ0PqE6jOX9NHwo';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';
const ADMIN = '50768384242';

async function main() {
  const r = await fetch(API, { headers: { 'X-N8N-API-KEY': KEY } });
  const wf = await r.json();

  // ── FIX 1: Restructure connections ──
  // BEFORE (broken):
  //   Solo Texto → Verificar Estado Pedido → Routear Pedido → Preparar Texto → Es Comando Cadena?
  //   Problem: "envía la cadena" gets caught as order before reaching cadena check
  //
  // AFTER (fixed):
  //   Solo Texto → Preparar Texto → Es Comando Cadena? → (cadena path)
  //                                 No Es Cadena → Verificar Estado Pedido → Routear Pedido → (order or Claude)

  // Solo Texto → Preparar Texto (restore original connection)
  wf.connections['Solo Texto'] = {
    main: [[{ node: 'Preparar Texto', type: 'main', index: 0 }]]
  };
  console.log('✅ Solo Texto → Preparar Texto (directo, sin pasar por pedidos)');

  // No Es Cadena → Verificar Estado Pedido (instead of going to Menu del Negocio)
  wf.connections['No Es Cadena'] = {
    main: [[{ node: 'Verificar Estado Pedido', type: 'main', index: 0 }]]
  };
  console.log('✅ No Es Cadena → Verificar Estado Pedido');

  // Routear Pedido → normal goes to Menu del Negocio (skipping Preparar Texto since it already ran)
  wf.connections['Routear Pedido'] = {
    main: [[
      { node: 'Menu del Negocio', type: 'main', index: 0 },
      { node: 'Guardar Cantidad', type: 'main', index: 0 },
      { node: 'Confirmar Pedido', type: 'main', index: 0 }
    ]]
  };
  console.log('✅ Routear Pedido → Menu del Negocio / Guardar Cantidad / Confirmar Pedido');

  // ── FIX 2: Preparar Texto - remove the _route guard ──
  for (const node of wf.nodes) {
    if (node.name === 'Preparar Texto') {
      // Remove the guard we added earlier since flow is now correct
      if (node.parameters.jsCode.includes('_route')) {
        node.parameters.jsCode = node.parameters.jsCode
          .replace(/\/\/ Guard: skip if this is an order flow message\n/, '')
          .replace(/const route = \$input\.first\(\)\.json\._route;\nif \(route && route !== 'normal'\) return \[\];\n\n/, '');
        console.log('✅ Preparar Texto: guard removido (ya no necesario)');
      }
    }

    // FIX 3: Guardar Cantidad - filter by _route AND handle text properly
    if (node.name === 'Guardar Cantidad') {
      node.parameters.jsCode = `
const route = $input.first().json._route;
if (route !== 'cantidad') return [];

const staticData = $getWorkflowStaticData('global');
const phone    = $input.first().json.phoneNumber;
const cantidad = $input.first().json.messageContent;
const nombre   = $input.first().json.nombreContacto || phone;

staticData['pedido_' + phone] = {
  estado: 'esperando_direccion',
  cantidad: cantidad,
  nombre: nombre
};

return [{ json: {
  phoneNumber: phone,
  respuesta: '\\u2705 *' + cantidad + '* anotado, ' + nombre + '! \\ud83d\\udcdd\\n\\n\\ud83d\\udccd \\u00bfCu\\u00e1l es tu *direcci\\u00f3n de entrega*?'
}}];
`;
    }

    // FIX 4: Menu del Negocio - add guard to skip if in order flow
    if (node.name === 'Menu del Negocio') {
      const currentCode = node.parameters.jsCode;
      if (!currentCode.includes('_route')) {
        node.parameters.jsCode = `
// Skip if this is an order flow (cantidad or direccion)
const route = $input.first().json._route;
if (route && route !== 'normal') return [];

` + currentCode;
        console.log('✅ Menu del Negocio: guard agregado para rutas de pedido');
      }
    }

    // FIX 5: Lista de Contactos - don't mark admin as esperando_cantidad
    if (node.name === 'Lista de Contactos') {
      node.parameters.jsCode = `
// ========== LISTA DE CONTACTOS ==========
const CONTACTOS = [
  { numero: "50769815135", nombre: "Vladimir" },
  { numero: "50768384242", nombre: "Veronica" },
];
// =========================================

const ADMIN = "${ADMIN}";
const imageUrl = $input.first().json.imageUrl;
const caption  = $input.first().json.caption;

const staticData = $getWorkflowStaticData('global');
for (const c of CONTACTOS) {
  // Don't mark admin as esperando_cantidad (admin sends commands, not orders)
  if (c.numero === ADMIN) continue;
  staticData['pedido_' + c.numero] = {
    estado: 'esperando_cantidad',
    nombre: c.nombre
  };
}

return CONTACTOS.map(c => ({
  json: { phoneNumber: c.numero, nombre: c.nombre, imageUrl, caption }
}));
`;
      console.log('✅ Lista de Contactos: admin excluido del flujo de pedidos');
    }
  }

  // ── SAVE ──
  const saveResp = await fetch(API, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await saveResp.json();
  if (result.id) {
    console.log('\n🚀 Workflow guardado! Nodos:', result.nodes.length);
    console.log('\nFLUJO CORREGIDO:');
    console.log('  Texto → Preparar Texto → ¿Es cadena?');
    console.log('    SÍ → Generar Cadena → Lista Contactos → Enviar imagen');
    console.log('    NO → Verificar Estado Pedido → Routear Pedido');
    console.log('           → normal: Claude responde');
    console.log('           → cantidad: guarda y pregunta dirección');
    console.log('           → dirección: confirma pedido');
  } else {
    console.log('Error:', JSON.stringify(result).substring(0, 300));
  }
}
main();
