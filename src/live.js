// WebSocket links for the connect-code companion feature.
// Host: the VR/3D ops room broadcasting its swarm session.
// Companion: a phone at /connect watching and steering the same session.

function wsUrl(query) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws?${query}`;
}

export function createHostLink() {
  let socket = null;
  let closed = false;
  const link = {
    code: null,
    onCode: null,
    onRequest: null,
    send(message) {
      if (socket?.readyState === 1) {
        try { socket.send(JSON.stringify(message)); } catch {}
      }
    },
    close() {
      closed = true;
      socket?.close();
    }
  };
  function connect() {
    try { socket = new WebSocket(wsUrl('role=host')); } catch { return; }
    socket.onmessage = e => {
      let message;
      try { message = JSON.parse(e.data); } catch { return; }
      if (message.type === 'code') { link.code = message.code; link.onCode?.(message.code); }
      else if (message.type === 'request') link.onRequest?.(message);
    };
    socket.onclose = () => { if (!closed) setTimeout(connect, 3000); };
    socket.onerror = () => {};
  }
  connect();
  return link;
}

export function createCompanionLink(code, handlers) {
  let socket = null;
  let closed = false;
  let everConnected = false;
  const link = {
    sendRequest(to, text) {
      if (socket?.readyState === 1) {
        try { socket.send(JSON.stringify({ type: 'request', to, text })); return true; } catch {}
      }
      return false;
    },
    close() {
      closed = true;
      socket?.close();
    }
  };
  function connect() {
    try { socket = new WebSocket(wsUrl(`role=companion&code=${encodeURIComponent(code)}`)); } catch {
      handlers.onError?.('Could not open a connection');
      return;
    }
    socket.onopen = () => { everConnected = true; handlers.onOpen?.(); };
    socket.onmessage = e => {
      let message;
      try { message = JSON.parse(e.data); } catch { return; }
      handlers.onMessage?.(message);
    };
    socket.onclose = () => {
      if (closed) return;
      // First-attempt rejection (bad code) should not silently retry forever.
      if (!everConnected) return;
      handlers.onReconnecting?.();
      setTimeout(connect, 2500);
    };
    socket.onerror = () => {};
  }
  connect();
  return link;
}
