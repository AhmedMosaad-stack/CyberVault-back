/**
 * Integration test auth helper — login and return token utility.
 */

import supertest from 'supertest';
import app from '../setup/app.js';

const request = supertest(app);

/**
 * Login and return the access token + cookie.
 */
async function getAuthToken(bankUserId, password) {
  const res = await request
    .post('/api/v1/auth/login')
    .send({ bankUserId, password });

  if (res.status !== 200) {
    throw new Error(`Login failed for ${bankUserId}: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return {
    accessToken: res.body.data.accessToken,
    cookie: res.headers['set-cookie'],
  };
}

/**
 * Create an authenticated supertest agent with cookie jar.
 */
function createAgent() {
  return supertest.agent(app);
}

export { getAuthToken, createAgent, request };
