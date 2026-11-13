import crypto from 'node:crypto';

function base64Url(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createLiveKitToken(apiKey, apiSecret, identity, room, isTeacher) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    sub: identity,
    name: identity,
    nbf: now,
    exp: now + 7200, // 2 hours
    video: {
      roomJoin: true,
      room: room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isTeacher
    }
  };

  const headerB64 = base64Url(JSON.stringify(header));
  const payloadB64 = base64Url(JSON.stringify(payload));
  const data = headerB64 + '.' + payloadB64;
  const signature = crypto.createHmac('sha256', apiSecret).update(data).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return data + '.' + signature;
}

export const handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ detail: 'Method not allowed' })
    };
  }

  const LIVEKIT_URL = (process.env.LIVEKIT_URL || process.env.VITE_LIVEKIT_URL || 'wss://accessible-stem-classroom-k1ds8afk.livekit.cloud').trim();
  const LIVEKIT_API_KEY = (process.env.LIVEKIT_API_KEY || 'APIzUkMEvo54h3p').trim();
  const LIVEKIT_API_SECRET = (process.env.LIVEKIT_API_SECRET || '0s4ROAsV6YlXvezCwlmLsWTvWeq6lGJN9jWuLfvoIK8B').trim();

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ detail: 'Invalid JSON payload' })
    };
  }

  const rawRoom = (body.room || '').trim();
  const rawIdentity = (body.identity || '').trim();
  const role = body.role === 'teacher' ? 'teacher' : 'student';

  const room = rawRoom.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
  const identity = rawIdentity.replace(/[^a-zA-Z0-9_.-]/g, '-').replace(/^-+|-+$/g, '');

  if (!room || !identity) {
    return {
      statusCode: 422,
      headers,
      body: JSON.stringify({ detail: 'Room and display name must contain letters or numbers.' })
    };
  }

  try {
    const token = createLiveKitToken(
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      identity,
      room,
      role === 'teacher'
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        token,
        serverUrl: LIVEKIT_URL,
        room,
        identity
      })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ detail: e.message || 'Token generation failed.' })
    };
  }
};
