# Cloudy

Cloudy is **a tiny REST API to automate the deploy and configuration of multiple services on a remote machine**.

## Getting Started

You need a machine with these installed:

- [Docker](https://www.docker.com/)
- [Node.js](https://nodejs.org/)

Then you can install the Cloudy CLI and create a server.

Do this on the server side:

```bash
# install Cloudy CLI
npm i -g @cloud-cli/cloudy

# generate a random key
head -c 5000 /dev/urandom | sha512sum
echo '[paste-the-generated-key-here]' > key
```

Now repeat the installation in your local machine and copy the key generated above:

```bash
# install Cloudy CLI
npm i -g @cloud-cli/cloudy
echo '[paste-the-generated-key-here]' > key
```

Next, let's create a configuration file called `cloudy.conf.mjs` on the server:

```ts
// import your plugins
import foo from 'foo';

// export commands from plugins
export default { foo };

// optional, change remote port
export const apiPort = 1234;
export const remoteHost = 'localhost';
```

And then we start the Cloudy server:

```bash
cy --serve
```

Finally, from you local machine, create another configuration file with the same name:

```ts
export default {};

// same port as the config on the server
export const apiPort = 1234;
export const remoteHost = 'your-server.com';
```

And that's it!

From the same folder as your config file and key, you can always run `cy --help` to get a list of commands available.

## How it works

- A call to `cy foo.bar --option value` on localhost is converted to a POST request to `your-server.com/foo.bar`
with a JSON body `{ "option": "value" }`.

- The server runs your command and sometimes returns an output

- The same commands can be executed with `cy` inside the server and in your local machine.

