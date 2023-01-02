const foo = {
  test(params) {
    console.log('foo was called with', params);
    return { foo: params };
  },
};

export default {
  foo,
};

export const apiPort = 8888;
export const apiHost = 'localhost';
export const remoteHost = 'localhost';
