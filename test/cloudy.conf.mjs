const foo = {
  test(params) {
    console.log('called foo with', params);
    return { foo: params };
  },
};

export default {
  foo,
};

export const apiPort = 8080;
