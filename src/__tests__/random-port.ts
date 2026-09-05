import { createServer } from 'node:net';

export async function randomPort() {
  const server = createServer();

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as { port: number };
  await new Promise<void>((resolve) => server.close(() => resolve()));

  return port;
}
