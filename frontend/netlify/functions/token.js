import { AccessToken } from 'livekit-server-sdk';

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

  const LIVEKIT_URL = (process.env.LIVEKIT_URL || process.env.VITE_LIVEKIT_URL || '').trim();
  const LIVEKIT_API_KEY = (process.env.LIVEKIT_API_KEY || '').trim();
  const LIVEKIT_API_SECRET = (process.env.LIVEKIT_API_SECRET || '').trim();

  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        detail: 'LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in Netlify Environment Variables.'
      })
    };
  }

  let body;
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
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: identity,
      ttl: '2h'
    });

    at.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: role === 'teacher'
    });

    const token = await at.toJwt();

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
