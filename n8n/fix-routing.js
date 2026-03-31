const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';
const WF_ID = '2EZ0PqE6jOX9NHwo';

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
      res.on('end', () => resolve(JSON.parse(chunks.join(''))));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const wf = await apiCall('GET', '/workflows/' + WF_ID);
  console.log('Got workflow with', wf.nodes.length, 'nodes');

  // Replace "Es Texto?" If node with a Code node that filters
  const esTexto = wf.nodes.find(n => n.name === 'Es Texto?');
  esTexto.type = 'n8n-nodes-base.code';
  esTexto.typeVersion = 2;
  esTexto.name = 'Solo Texto';
  esTexto.parameters = {
    jsCode: `const item = $('Extraer Datos').first().json;
if (item.messageType === 'text') {
  return [{ json: item }];
}
return [];`
  };
  delete esTexto.options;

  // Replace "Es Audio?" If node with a Code node
  const esAudio = wf.nodes.find(n => n.name === 'Es Audio?');
  esAudio.type = 'n8n-nodes-base.code';
  esAudio.typeVersion = 2;
  esAudio.name = 'Solo Audio';
  esAudio.parameters = {
    jsCode: `const item = $('Extraer Datos').first().json;
if (item.messageType === 'audio') {
  return [{ json: item }];
}
return [];`
  };
  delete esAudio.options;

  // Replace "Es Imagen?" If node with a Code node
  const esImagen = wf.nodes.find(n => n.name === 'Es Imagen?');
  esImagen.type = 'n8n-nodes-base.code';
  esImagen.typeVersion = 2;
  esImagen.name = 'Solo Imagen';
  esImagen.parameters = {
    jsCode: `const item = $('Extraer Datos').first().json;
if (item.messageType === 'image') {
  return [{ json: item }];
}
return [];`
  };
  delete esImagen.options;

  // Also add an unsupported route code node - replace Msg No Soportado to also filter
  const msgNoSoportado = wf.nodes.find(n => n.name === 'Msg No Soportado');
  msgNoSoportado.parameters.jsCode = `const item = $('Extraer Datos').first().json;
if (item.messageType !== 'text' && item.messageType !== 'audio' && item.messageType !== 'image') {
  return [{
    json: {
      phoneNumber: item.phoneNumber,
      responseText: 'Hola! \\ud83d\\ude0a Por ahora puedo leer mensajes de texto, notas de voz e imagenes. Escribeme o mandame un audio con lo que necesites!'
    }
  }];
}
return [];`;

  // Fix connections - Code nodes have only 1 output (main[0]), not 2 like If nodes
  const conn = wf.connections;

  // Solo Texto -> Preparar Texto (single output)
  conn['Solo Texto'] = {
    main: [[{ node: 'Preparar Texto', type: 'main', index: 0 }]]
  };

  // Solo Audio -> Obtener URL Audio (single output, no false branch)
  conn['Solo Audio'] = {
    main: [[{ node: 'Obtener URL Audio', type: 'main', index: 0 }]]
  };

  // Solo Imagen -> Obtener URL Imagen (single output)
  conn['Solo Imagen'] = {
    main: [[{ node: 'Obtener URL Imagen', type: 'main', index: 0 }]]
  };

  // Detectar Tipo -> all 4 routes
  conn['Detectar Tipo'] = {
    main: [[
      { node: 'Solo Texto', type: 'main', index: 0 },
      { node: 'Solo Audio', type: 'main', index: 0 },
      { node: 'Solo Imagen', type: 'main', index: 0 },
      { node: 'Msg No Soportado', type: 'main', index: 0 }
    ]]
  };

  // Msg No Soportado -> Enviar Msg No Soportado
  conn['Msg No Soportado'] = {
    main: [[{ node: 'Enviar Msg No Soportado', type: 'main', index: 0 }]]
  };

  // Remove old If node connections
  delete conn['Es Texto?'];
  delete conn['Es Audio?'];
  delete conn['Es Imagen?'];

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: conn,
    settings: wf.settings,
    staticData: wf.staticData
  };

  const result = await apiCall('PUT', '/workflows/' + WF_ID, payload);

  if (result.id) {
    console.log('Workflow updated successfully');
    console.log('Active:', result.active);
    const nodeNames = result.nodes.map(n => n.name);
    console.log('Nodes:', nodeNames.join(', '));

    // Verify routing nodes are Code type
    result.nodes.forEach(n => {
      if (n.name.startsWith('Solo')) {
        console.log(n.name, '- type:', n.type, '- has filter:', n.parameters.jsCode.includes('return [];'));
      }
    });
  } else {
    console.log('Error:', JSON.stringify(result).substring(0, 500));
  }
}

main().catch(e => console.error(e));
