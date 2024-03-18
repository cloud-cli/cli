const baseURL = "__API_BASEURL__";
const headers = { authorization: "" };
const cloud: CloudCommands = {};

type Args = Record<string, string> | null;
type Commands = Record<string, string[]>;
type CloudCommands = Record<string, { [k: string]: (args?: Args) => Promise<unknown>; }>;

export async function run(command: string, args: Args = null) {
  const url = new URL(command, baseURL);

  if (args) {
    Object.entries(args).forEach(([key, value]) =>
      url.searchParams.set(key, value)
    );
  }

  const response = await fetch(url, { method: "POST", headers });

  if (response.ok) {
    return await response.json();
  }

  throw new Error(response.status + ": " + response.statusText);
}

export async function auth(key: string) {
  headers.authorization = "Bearer " + key;
  const request = await fetch(new URL(".help", baseURL), { method: "POST", headers });

  if (!request.ok) {
    throw new Error("Unauthorized");
  }

  const commands = (await request.json()) as Commands;
  const list = Object.entries(commands);

  for (const [root, leaves] of list) {
    cloud[root] = {};
    for (const leaf of leaves) {
      cloud[root][leaf] = run.bind(null, root + "." + leaf);
    }
  }
}

export default cloud;
