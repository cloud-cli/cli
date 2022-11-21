const test = {
  foo(params) {
    console.log('called foo with', params);
    return { foo: params };
  },
};

export default [
  ['foo', test],
  ['bar', test],
];
