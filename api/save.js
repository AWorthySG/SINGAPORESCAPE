// GET / PUT /api/save: the signed-in player's cloud save.
// See api/_lib/accounts.js for the logic and docs/accounts.md for the API.
import { makeSaveHandler } from './_lib/accounts.js';

export default makeSaveHandler();
