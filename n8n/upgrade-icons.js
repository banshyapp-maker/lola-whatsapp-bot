/**
 * upgrade-icons.js
 *
 * Converts HTTP Request nodes to native WhatsApp nodes
 * so they show the proper WhatsApp icon in the n8n editor.
 */

const BASE = 'https://n8n.solucionesomicron.com/api/v1';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';
const WF_ID = '2EZ0PqE6jOX9NHwo';
const PHONE_ID = '1103393509513315';
const ADMIN = '50768384242';

async function apiCall(method, path, body) {
  const opts = {
    method,
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + path, opts);
  return r.json();
}

async function main() {
  console.log('=== Upgrade Icons ===\n');

  // 1. Create native WhatsApp credential
  console.log('1. Creating WhatsApp Business API credential...');
  const waCred = await apiCall('POST', '/credentials', {
    name: 'WhatsApp Business Cloud',
    type: 'whatsAppApi',
    data: {
      accessToken: 'PEGAR_TU_TOKEN_AQUI',
      businessAccountId: 'PEGAR_TU_BUSINESS_ACCOUNT_ID'
    }
  });
  console.log('   Created: id=' + waCred.id);
  const WA_CRED_ID = waCred.id;
  const WA_CRED_NAME = waCred.name;

  // 2. Fetch the current workflow
  console.log('\n2. Fetching workflow...');
  const wf = await apiCall('GET', '/workflows/' + WF_ID);
  console.log('   Nodes: ' + wf.nodes.length);

  // 3. Convert WhatsApp message-sending nodes to native type
  console.log('\n3. Converting nodes to native WhatsApp...');

  function makeNativeWA(node, params) {
    return {
      parameters: {
        resource: 'message',
        operation: 'send',
        phoneNumberId: PHONE_ID,
        ...params
      },
      id: node.id,
      name: node.name,
      type: 'n8n-nodes-base.whatsApp',
      typeVersion: 1.1,
      position: node.position,
      credentials: {
        whatsAppApi: {
          id: WA_CRED_ID,
          name: WA_CRED_NAME
        }
      }
    };
  }

  for (let i = 0; i < wf.nodes.length; i++) {
    const node = wf.nodes[i];

    // Enviar WhatsApp - text response to customer
    if (node.name === 'Enviar WhatsApp') {
      wf.nodes[i] = makeNativeWA(node, {
        recipientPhoneNumber: '={{ $json.phoneNumber }}',
        messageType: 'text',
        textBody: '={{ $json.responseText }}'
      });
      console.log('   ✅ Enviar WhatsApp → native (text)');
    }

    // Enviar Msg No Soportado - unsupported message response
    if (node.name === 'Enviar Msg No Soportado') {
      wf.nodes[i] = makeNativeWA(node, {
        recipientPhoneNumber: '={{ $json.phoneNumber }}',
        messageType: 'text',
        textBody: '={{ $json.responseText }}'
      });
      console.log('   ✅ Enviar Msg No Soportado → native (text)');
    }

    // Enviar Cadena - send promotional image
    if (node.name === 'Enviar Cadena') {
      wf.nodes[i] = makeNativeWA(node, {
        recipientPhoneNumber: '={{ $json.phoneNumber }}',
        messageType: 'image',
        mediaPath: 'useMediaLink',
        mediaLink: '={{ $json.imageUrl }}',
        mediaCaption: '={{ $json.caption }}'
      });
      console.log('   ✅ Enviar Cadena → native (image)');
    }

    // Confirmar Envio al Admin
    if (node.name === 'Confirmar Envio al Admin') {
      wf.nodes[i] = makeNativeWA(node, {
        recipientPhoneNumber: ADMIN,
        messageType: 'text',
        textBody: 'Cadena enviada a todos los contactos de la lista.'
      });
      console.log('   ✅ Confirmar Envio al Admin → native (text)');
    }

    // WhatsApp Notif Admin
    if (node.name === 'WhatsApp Notif Admin') {
      wf.nodes[i] = makeNativeWA(node, {
        recipientPhoneNumber: ADMIN,
        messageType: 'text',
        textBody: '={{ $json.mensaje }}'
      });
      console.log('   ✅ WhatsApp Notif Admin → native (text)');
    }

    // Enviar Respuesta Pedido
    if (node.name === 'Enviar Respuesta Pedido') {
      wf.nodes[i] = makeNativeWA(node, {
        recipientPhoneNumber: '={{ $json.phoneNumber }}',
        messageType: 'text',
        textBody: '={{ $json.respuesta }}'
      });
      console.log('   ✅ Enviar Respuesta Pedido → native (text)');
    }

    // Notif Admin Pedido (the direct HTTP one)
    if (node.name === 'Notif Admin Pedido') {
      wf.nodes[i] = makeNativeWA(node, {
        recipientPhoneNumber: ADMIN,
        messageType: 'text',
        textBody: '={{ "📋 *NUEVO PEDIDO*\\n👤 " + $json.pedidoFinal.nombre + " (" + $json.pedidoFinal.telefono + ")\\n📦 Cantidad: " + $json.pedidoFinal.cantidad + "\\n📍 Dirección: " + $json.pedidoFinal.direccion + "\\n🕐 " + $json.pedidoFinal.hora }}'
      });
      console.log('   ✅ Notif Admin Pedido → native (text)');
    }

    // Enviar Notif Admin WA
    if (node.name === 'Enviar Notif Admin WA') {
      wf.nodes[i] = makeNativeWA(node, {
        recipientPhoneNumber: '={{ $json.to }}',
        messageType: 'text',
        textBody: '={{ $json.body }}'
      });
      console.log('   ✅ Enviar Notif Admin WA → native (text)');
    }

    // Enviar Audio WhatsApp
    if (node.name === 'Enviar Audio WhatsApp') {
      wf.nodes[i] = makeNativeWA(node, {
        recipientPhoneNumber: '={{ $("Procesar Respuesta").first().json.phoneNumber }}',
        messageType: 'audio',
        mediaPath: 'useMediaId',
        mediaId: '={{ $json.id }}'
      });
      console.log('   ✅ Enviar Audio WhatsApp → native (audio)');
    }

    // Marcar como Leido - convert to mark-as-read (native node doesn't support this)
    // KEEP AS HTTP REQUEST - no native equivalent
  }

  // 4. Save the workflow
  console.log('\n4. Saving workflow...');
  const result = await apiCall('PUT', '/workflows/' + WF_ID, {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings,
    staticData: wf.staticData
  });

  if (result.id) {
    const nativeWA = result.nodes.filter(n => n.type === 'n8n-nodes-base.whatsApp').length;
    const httpReq = result.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest').length;
    console.log('\n🚀 ¡Guardado!');
    console.log('   Nodos WhatsApp nativos (con icono): ' + nativeWA);
    console.log('   Nodos HTTP Request restantes: ' + httpReq);
    console.log('   Total nodos: ' + result.nodes.length);

    console.log('\n⚠️  IMPORTANTE: Debes configurar la credencial en n8n:');
    console.log('   1. Ve a n8n → Credentials');
    console.log('   2. Abre "WhatsApp Business Cloud"');
    console.log('   3. Pega tu Access Token (el token permanente de Meta)');
    console.log('   4. Pega tu Business Account ID (de Meta Business Settings)');
    console.log('   5. Guarda');
  } else {
    console.log('Error:', JSON.stringify(result).substring(0, 500));
  }
}

main().catch(e => console.error('Error:', e.message));
