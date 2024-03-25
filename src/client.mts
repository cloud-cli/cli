const baseURL = "__API_BASEURL__";
const headers = { Authorization: "" };
const cloud: CloudCommands = {};
const fetchOptions: any = { method: "POST", headers, mode: "cors" };

type Args = Record<string, string> | null;
type Commands = Record<string, string[]>;
type CloudCommands = Record<string, { [k: string]: (args?: Args) => Promise<unknown>; }>;

export async function run(command: string, args: Args = null) {
  const url = new URL(command, baseURL);
  const options = {
    ...fetchOptions,
    body: '{}',
  };

  if (args) {
    options.body = JSON.stringify(args);
  }

  const response = await fetch(url, options);

  if (response.ok) {
    return await response.json();
  }

  throw new Error(response.status + ": " + response.statusText);
}

export async function auth(key: string) {
  headers.Authorization = key;
  const request = await fetch(new URL(".help", baseURL), fetchOptions);

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
