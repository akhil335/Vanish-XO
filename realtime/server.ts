import { routePartykitRequest } from 'partyserver';
import { Main } from './room';
import { Lobby } from './lobby';

export { Main, Lobby };

export interface Env {
  Main: DurableObjectNamespace<Main>;
  Lobby: DurableObjectNamespace<Lobby>;
}

export default {
  async fetch(req: Request, env: Env) {
    return (
      (await routePartykitRequest(req, env)) ||
      new Response('Not found', { status: 404 })
    );
  },
};
