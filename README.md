# Cloudy CLI

## What is cloudy?

Cloudy is a both an HTTP server and a CLI tool, used to run commands on a remote machine using plugins.

So what?

Well, not any commands... You write a script that exports a few functions in an object and Cloudy takes care of exposing it as an API.

Here's an example:

```js
export default {
  greeting: {
    sayHi() {
      return 'Hello!';
    }
  }
}
```

And here's what the CLI can do:

```bash
cy greeting.sayHi
> Hello!
```

## Concepts

You install the CLI locally, point it to a server and run remote commands.

On the server side, you run the same CLI, but as an HTTP API.

## Getting Started

You need a machine with [Node.js](https://nodejs.org/) installed.
Then you can install the Cloudy CLI and create a server.

### 1. Set up the server

> Tip: create an alias for Cloudy CLI. Add this to `~/.profile`: `alias cy="npx @cloud-cli/cli"`

```bash
# generate a random key
head -c 5000 /dev/urandom | sha512sum
echo '[paste-the-generated-key-here]' > key
```

Next, let's create a configuration file called `cloudy.conf.mjs` on the server:

```ts
// import your plugins
import foo from 'foo-plugin';
import { init } from '@cloud-cli/cli';

function initialize() {
  // anything you need to run when the command server starts
}

// export commands from plugins
export default { foo, [init]: initialize };

// optional, change remote port and host
export const apiPort = 1234;
export const apiHost = '0.0.0.0';
```

And then we start the Cloudy server:

```bash
npx @cloud-cli/cli --serve
```

## 2. Set up the local CLI

On your local machine, create a configuration file again:

```ts
// cloudy.conf.mjs
export default {};

// same port as the config on the server
export const apiPort = 1234;
export const remoteHost = 'your-server.com';
export const key = '[paste-the-generated-key-here]';
```

And that's it!

Now you can run `npx @cloud-cli/cli --help` to get a list of commands available.

## How it works

- A call to `cy foo.bar --option value` on localhost is converted to a POST request to `your-server.com/foo.bar` with a JSON body `{ "option": "value" }`.

- The server runs your command and sometimes returns an output

- The same commands can be executed with `cy` inside the server and in your local machine.

- And if you need to un the same but from a browser, the entire CLI is also an API
