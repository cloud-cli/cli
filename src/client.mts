const baseURL = "__API_BASEURL__";
const headers = { authorization: "" };
const cloud = {};

type Args = Record<string, string> | null;
type Commands = Record<string, string[]>;

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
  const request = await fetch(".help", { method: "POST", headers });

  if (!request.ok) {
    throw new Error("Unauthorized");
  }

  const commands: Commands = await request.json();
  const list = Object.entries(commands);

  for (const [root, leaves] of list) {
    cloud[root] = {};
    for (const leaf of leaves) {
      cloud[root][leaf] = run.bind(null, root + "." + leaf);
    }
  }
}

export default cloud;
