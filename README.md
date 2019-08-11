# Cloudy

Cloudy is **a tiny REST API to deploy micro services** from GitHub repositories. It has **no dependencies**.

It works by receiving GitHub WebHook calls, cloning the source code and running it inside a Docker container.

> SEE ALSO:
>
> The companion node service [that builds the base cloud containers](https://github.com/homebots/cloudy-images) from a git repository.

## How it works

A push to a GitHub repo will trigger a webhook.

The service will then clone the source repository and deploy it to a Docker container, using one of the base images.

Then a Nginx configuration will be generated for that service under `/nginx`.

## How to run the Cloudy server

Start a new project:

```bash
mkdir cloud-server
cd cloud-server
cy init
```

Define the domain where the Cloudy service will run:

```
exports CLOUDY_DOMAIN='your-domain.com'
exports PORT=9999
```

Then just run `index.js` on a host machine with Docker. Use [`pm2`](https://www.npmjs.com/package/pm2) to allow the service to restart when updates are available.
E.g. `pm2 start --name cloudy npm start`

## Service configurations

Add a file called `service.json` to a GitHub repository, with any of the following options:

NOTE: They are all **optional**

```
{
  // one of "node" or "nginx". default is "node"
  "type": "node",

  // Defaults to [service-id].[cloudy-domain],
  // e.g. bc5a6b6.your-domain.com
  "domain": "abc.example.com",

  // container's http port. Defaults to a random port available at $PORT env variables
  "port": 80,

  // any env variables you need to set
  "env": {
    "FOO": "foo",
    "DEBUG": "true",
  },

  // incoming websockets support
  // In this example, traffic for websocket upgrades will be
  // redirected to 'http://localhost:{WEBSOCKET_PORT}/ws'
  webSocket: {
    "path": "/ws"
  }
}
```

## Environment variables

In addition to any variables provided by a service configuration, these will be set in every machine:

```
DATA_DIR          A folder where any files can be stored
PORT              port for http incoming traffic
WEBSOCKET_PORT    port for incoming WebSocket connections
```

## Auto update and the .key file

You can create a very long key hash in a file called `.key` (in the server root folder).
This key can be used in GitHub as the "Secret" input to add a WebHook for Cloudy updates.

Point a webhook to `https://cloudy-host:port/reload/` and every commit will automatically update the Cloudy instance.

## Adding a deploy Webhook

First we need to create a new deploy key.
Let's say we want to deploy a service from 'https://github.com/repository/name':

```
curl -X POST 'https://cloudy.example.com/create' --data 'repository/name'

>> 4de1f5aab51b969dace864d506ad88cd1bd4c5c710b6145ff2e196012f3d292f
```

> It goes without saying that is very important to keep this key secure!
> This key can be used to trigger service updates

Go to the `Repository Settings > Webhooks` and add a new webhook (https://github.com/{repository/name}/settings/hooks/new)

- URL: the domain where Cloudy is running + '/deploy', e.g. `https://cloudy.example.com/deploy`

- Content Type: application/json

- Secret: `4de1f5aab51b969dace864d506ad88cd1bd4c5c710b6145ff2e196012f3d292f` (from previous step)

And done! Now every commit will redeploy that repo in a Docker Container!

# Service Object

```
id:             string,
type:           'node' | 'nginx'
url:            'https://github.com/org/repo',
branch:         "master",
repository:     'org/repo',
webSocket:       { }
domains:        string[],
ports:          number[] | [number, number][]
env:            { "KEY": "value" },
memory:         50mb
```
