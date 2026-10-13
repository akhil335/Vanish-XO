import type * as Party from 'partykit/server';
import { GameRoomHandler } from './room';

export default class VanishXOServer implements Party.Server {
  private handler: GameRoomHandler;
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  constructor(readonly room: Party.Room) {
    this.handler = new GameRoomHandler(room.id);
    this.tickInterval = setInterval(() => {
      this.handler.tick(Date.now());
    }, 1000);
  }

  onConnect(conn: Party.Connection) {
    this.handler.handleConnection(conn.id, (msg: string) => {
      try {
        conn.send(msg);
      } catch {
        // Safe catch
      }
    });
  }

  onMessage(message: string | ArrayBuffer, sender: Party.Connection) {
    if (typeof message === 'string') {
      this.handler.handleMessage(sender.id, message, Date.now());
    }
  }

  onClose(conn: Party.Connection) {
    this.handler.handleDisconnection(conn.id, Date.now());
  }

  onError(conn: Party.Connection) {
    this.handler.handleDisconnection(conn.id, Date.now());
  }
}
