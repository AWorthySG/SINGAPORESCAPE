// POST /api/auth: sign up, log in, recover a password, and "who am I".
// See api/_lib/accounts.js for the logic and docs/accounts.md for the API.
import { makeAuthHandler } from './_lib/accounts.js';

export default makeAuthHandler();
