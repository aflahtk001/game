import { WebSocket } from 'ws';

const BASE_HTTP = 'http://localhost:3001';
const BASE_WS = 'ws://localhost:3001';

function waitForMessage(client, eventType, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for event '${eventType}'`));
    }, timeoutMs);

    const onMsg = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.event === eventType) {
          clearTimeout(timer);
          client.off('message', onMsg);
          resolve(msg);
        }
      } catch (err) {
        // ignore malformed
      }
    };

    client.on('message', onMsg);
  });
}

async function request(path, options = {}) {
  const url = `${BASE_HTTP}${path}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function runTests() {
  console.log('--- STARTING MULTIPLAYER BACKEND TEST SUITE WITH SUPABASE ---');

  // 1. Test Health Endpoint
  console.log('\n[1] Testing Health Endpoint...');
  const health = await request('/health');
  console.log('Health Response:', health.data);
  if (health.status !== 200 || health.data.status !== 'ok') {
    throw new Error('Health check failed');
  }
  console.log('✓ Health check passed');

  // 2. Test REST API Session Lifecycle in Supabase
  console.log('\n[2] Testing REST API Session Creation & Status in Supabase...');
  const createRes = await request('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ displayName: 'RestHost', maxCapacity: 4 }),
  });
  console.log('Create Session Result:', createRes.data);
  if (createRes.status !== 201 || !createRes.data.session?.id) {
    throw new Error('REST Session creation failed');
  }
  const restSessionId = createRes.data.session.id;

  const getRes = await request(`/api/sessions/${restSessionId}`);
  console.log('Get Session Result:', getRes.data);
  if (getRes.status !== 200 || getRes.data.session.id !== restSessionId) {
    throw new Error('REST Get session failed');
  }

  const joinRes = await request(`/api/sessions/${restSessionId}/join`, {
    method: 'POST',
    body: JSON.stringify({ playerId: '00000000-0000-4000-8000-000000000002', displayName: 'RestPlayer2' }),
  });
  console.log('Join Session Result:', joinRes.data);
  if (joinRes.status !== 200 || joinRes.data.session.activePlayerCount !== 2) {
    throw new Error('REST Join session failed');
  }

  const leaveRes = await request(`/api/sessions/${restSessionId}/leave`, {
    method: 'POST',
    body: JSON.stringify({ playerId: '00000000-0000-4000-8000-000000000002' }),
  });
  console.log('Leave Session Result:', leaveRes.data);
  if (leaveRes.status !== 200 || leaveRes.data.session.activePlayerCount !== 1) {
    throw new Error('REST Leave session failed');
  }
  console.log('✓ REST API session lifecycle tests passed');

  // 3. Test Real-time WebSocket Protocol & Multi-client session sync
  console.log('\n[3] Testing Real-time WebSocket Multi-Client Flow...');
  
  const clientA = new WebSocket(BASE_WS);
  const clientB = new WebSocket(BASE_WS);

  await Promise.all([
    new Promise((resolve) => clientA.on('open', resolve)),
    new Promise((resolve) => clientB.on('open', resolve)),
  ]);
  console.log('✓ Both WebSocket clients connected');

  // Identify Client A
  const pAIdentify = waitForMessage(clientA, 'IDENTIFIED');
  clientA.send(JSON.stringify({
    action: 'IDENTIFY',
    payload: { displayName: 'SpeedyRacer' },
  }));
  const identifiedA = await pAIdentify;
  console.log('✓ Player A identified in Supabase:', identifiedA.payload.player.displayName, `(${identifiedA.payload.player.id})`);

  // Identify Client B
  const pBIdentify = waitForMessage(clientB, 'IDENTIFIED');
  clientB.send(JSON.stringify({
    action: 'IDENTIFY',
    payload: { displayName: 'DriftKing' },
  }));
  const identifiedB = await pBIdentify;
  console.log('✓ Player B identified in Supabase:', identifiedB.payload.player.displayName, `(${identifiedB.payload.player.id})`);

  // Client A creates a session
  const pACreated = waitForMessage(clientA, 'SESSION_CREATED');
  clientA.send(JSON.stringify({
    action: 'CREATE_SESSION',
    payload: { maxCapacity: 4 },
  }));
  const sessionCreated = await pACreated;
  const wsSessionId = sessionCreated.payload.session.id;
  console.log(`✓ Session created over WebSocket with ID: ${wsSessionId}`);

  // Client B joins Client A's session & Client A receives broadcast
  const pBJoined = waitForMessage(clientB, 'SESSION_JOINED');
  const pABroadcastJoin = waitForMessage(clientA, 'PLAYER_JOINED');

  clientB.send(JSON.stringify({
    action: 'JOIN_SESSION',
    payload: { sessionId: wsSessionId },
  }));

  const [sessionJoinedB, playerJoinedBroadcast] = await Promise.all([pBJoined, pABroadcastJoin]);
  console.log('✓ Client B received SESSION_JOINED');
  console.log('✓ Client A received real-time broadcast PLAYER_JOINED for:', playerJoinedBroadcast.payload.player.displayName);

  // Test Heartbeat Ping/Pong
  const pAPong = waitForMessage(clientA, 'PONG');
  clientA.send(JSON.stringify({
    action: 'PING',
    payload: { timestamp: 12345 },
  }));
  const pong = await pAPong;
  if (pong.payload.timestamp !== 12345) {
    throw new Error('Pong timestamp mismatch');
  }
  console.log('✓ WebSocket heartbeat Ping/Pong verified');

  // Client B leaves session & Client A receives broadcast
  const pBLeft = waitForMessage(clientB, 'SESSION_LEFT');
  const pABroadcastLeave = waitForMessage(clientA, 'PLAYER_LEFT');

  clientB.send(JSON.stringify({
    action: 'LEAVE_SESSION',
    payload: { sessionId: wsSessionId },
  }));

  await Promise.all([pBLeft, pABroadcastLeave]);
  console.log('✓ Client B left session and Client A received PLAYER_LEFT broadcast');

  // Cleanup
  clientA.close();
  clientB.close();

  console.log('\n====================================================');
  console.log(' ALL BACKEND & SUPABASE TESTS PASSED SUCCESSFULLY! ');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
