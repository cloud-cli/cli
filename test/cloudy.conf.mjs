import { init } from '@cloud-cli/cli';

const foo = {
  [init]() {
    console.log('initializer called');
  },

  test(params) {
    console.log('foo was called with', params);
    return { foo: params };
  },
};

export default {
  foo,
};

export const apiPort = 8888;
export const apiHost = '127.0.0.1';
export const remoteHost = 'http://127.0.0.1';
