# Cloudy CLI

## What is cloudy?

Cloudy is a Node.JS module that works both as an API and a CLI tool, used to automate the deploy and configuration of multiple services on a remote machine.

## Concept

You install the CLI once, point it to a server that also has the tool running, and the available commands are driven by the server.

On the server side, you run the same tool as an HTTP API.

## Getting Started

You need a machine with [Node.js](https://nodejs.org/) installed.
Then you can install the Cloudy CLI and create a server.

### 1. Set up the server

```bash
# install Cloudy CLI
npm i -g @cloud-cli/cloudy

# generate a random key
head -c 5000 /dev/urandom | sha512sum
echo '[paste-the-generated-key-here]' > key
```

Next, let's create a configuration file called `cloudy.conf.mjs` on the server:

```ts
// import your plugins
import foo from 'foo';
import { init } from '@cloud-cli/cli';

function initialize() {
  // anything you need to run when the http server starts
}

// export commands from plugins
export default { foo, [init]: initialize };

// optional, change remote port
export const apiPort = 1234;
export const apiHost = '0.0.0.0';
```

And then we start the Cloudy server:

```bash
cy --serve
```

## 2. Set up the local CLI

On your local machine, install the CLI and create a configuration file again:

```bash
# install Cloudy CLI
npm i -g @cloud-cli/cloudy
```


```ts
// cloudy.conf.mjs
export default {};

// same port as the config on the server
export const apiPort = 1234;
export const remoteHost = 'your-server.com';
export const key = '[paste-the-generated-key-here]';
```

And that's it!

Now you can run `cy --help` to get a list of commands available.

## How it works

- A call to `cy foo.bar --option value` on localhost is converted to a POST request to `your-server.com/foo.bar` with a JSON body `{ "option": "value" }`.

- The server runs your command and sometimes returns an output

- The same commands can be executed with `cy` inside the server and in your local machine.

- And if you need to un the same but from a browser, the entire CLI is also an API
