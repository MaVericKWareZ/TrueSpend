import { MongoMemoryServer } from 'mongodb-memory-server';

let server: MongoMemoryServer | undefined;

export async function startInMemoryMongo(dbName?: string): Promise<string> {
  if (!server) {
    server = await MongoMemoryServer.create();
  }
  return dbName ? server.getUri(dbName) : server.getUri();
}

export async function stopInMemoryMongo(): Promise<void> {
  if (server) {
    await server.stop();
    server = undefined;
  }
}
