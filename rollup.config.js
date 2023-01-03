import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';

export default {
  input: 'src/index.ts',
  external: ['@homebots/injector', 'rxjs'],
  output: {
    dir: '.',
    format: 'es',
  },
  plugins: [json(), typescript({ module: 'esnext' }), resolve(), commonjs({ extensions: ['.js', '.ts'] })],
};
