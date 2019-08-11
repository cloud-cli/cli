import { get as getHttp, createServer, Server, IncomingMessage, RequestOptions, ServerResponse } from 'http';
import { get as getHttps } from 'https';
import { createHmac } from 'crypto';
import { Log, serializeError } from './log.js';
import { randomBytes } from 'crypto';

const sha1 = (secret: string, payload: string | Buffer) => createHmac('sha1', secret).update(payload).digest('hex');
const toJson = (x: any) => JSON.stringify(x, null, 2);
const logger = Log.create('http');

type Json = object;
type HttpSend = (status: any, body?: any) => void;

interface HttpRequest extends IncomingMessage {
  id: string;
  body?: string | Buffer | Json;
  bodyText?: string;
}

interface HttpResponse extends ServerResponse {
  id: string;
  request: HttpRequest;
  send: HttpSend;
}

interface FetchResponse {
  headers: IncomingMessage['headers'];
  body: any;
  status: number;
  ok: boolean;
}

type HttpHandler = (request: HttpRequest, response: HttpResponse) => void;
type HttpMatcher = (url: string) => boolean;

const tryToParseJson = (data: string) => {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

class HttpServer {
  routes: { method: string; handler: HttpHandler; match: HttpMatcher }[];
  server: Server;

  constructor() {
    this.routes = [];
    this.server = createServer((request, response) => this.dispatch(request, response));
  }

  createUrlMatcher(url: string | RegExp): HttpMatcher {
    if (typeof url === 'string') {
      return (candidateUrl: string) => candidateUrl === url;
    }

    return (candidateUrl: string) => url.test(candidateUrl);
  }

  when(method: string, url: string | RegExp, handler: HttpHandler) {
    const match = this.createUrlMatcher(url);
    this.routes.push({ method, handler, match });
  }

  listen(port: number, host: string) {
    this.server.listen(port, host);
  }

  checkProtectedRoute(request: HttpRequest, secret: string) {
    if (!secret) {
      logger.error(`No secret provided to check ${request.id}`);
      return false;
    }

    const requestSignature = request.headers['x-hub-signature'];
    const payloadSignature = 'sha1=' + sha1(secret, String(request.bodyText || request.body || ''));
    const valid = payloadSignature === requestSignature;

    if (!valid) {
      logger.error(`Invalid request ${request.id}, signature: ${requestSignature}, expected ${payloadSignature}`);
    }

    return valid;
  }

  async dispatch(_request: IncomingMessage, _response: ServerResponse) {
    const { method, url } = _request;
    const match = this.routes.filter((route) => route.method === method && route.match(String(url)));

    if (!match.length) {
      _response.writeHead(404);
      _response.end('');
      return;
    }

    const request = _request as HttpRequest;
    const response = _response as HttpResponse;

    request.id = response.id = randomBytes(16).toString('hex');
    response.request = request;

    this.augmentResponse(response);

    if (method === Post) {
      await readStreamBody(request);
    }

    const route = match[0];

    try {
      route.handler(request, response);
    } catch (error) {
      this.logError(request.id, error);
      response.send(500, { traceId: request.id });
    }
  }

  augmentResponse(response: HttpResponse) {
    const send = (value: string) => {
      if (typeof value !== 'string') {
        value = toJson(value);
      }

      response.end(value);
      this.logRequest(response.request, response, value);
    };

    const sendError = (error: Error) => {
      this.logError(response.id, error);
      response.writeHead(500);
      send(toJson({ traceId: response.id }));
    };

    response.send = function (status: Promise<any> | Error | number | Json | string, body = '') {
      if (status instanceof Promise) {
        status.then(send).catch(sendError);
        return;
      }

      if (status instanceof Error) {
        sendError(status);
        return;
      }

      if (arguments.length === 2 || typeof status === 'number') {
        response.writeHead(Number(status));
        send(body);
        return;
      }

      send(String(status));
    };
  }

  logError(traceId: any, error: any) {
    logger.error({ traceId, error: serializeError(error) });
  }

  logRequest(request: HttpRequest, response: HttpResponse, responseBody: any) {
    const { url, method, body, headers } = request;
    let bodyAsString = body || '';

    if (Buffer.isBuffer(body)) {
      bodyAsString = body.toString('utf8');
    } else if (typeof body === 'object') {
      bodyAsString = JSON.stringify(body);
    }

    logger.debug({
      request: { url, method, body: bodyAsString, headers },
      response: [response.statusCode, responseBody],
    });
  }

  fetch(url: string, requestOptions?: RequestOptions): Promise<FetchResponse> {
    return new Promise((resolve, reject) => {
      const urlObject = new URL(url);
      const request = (urlObject.protocol === 'https:' ? getHttps : getHttp)(urlObject, requestOptions!);
      const onError = (error: any) => reject({ error, ok: false });

      request.on('response', async (response) => {
        const body = await readStreamBody(<HttpRequest>response);

        response.on('error', onError);
        const status = Number(response.statusCode);
        resolve({
          headers: response.headers,
          body,
          status,
          ok: status < 400,
        });
      });

      request.on('error', onError);
      request.end();
    });
  }
}

function readStreamBody(stream: HttpRequest) {
  return new Promise((resolve) => {
    let body: any[] = [];
    const contentType = stream.headers['content-type'] || '';

    stream.on('data', (chunk: any) => body.push(chunk));
    stream.on('end', () => {
      stream.body = Buffer.concat(body);
      const isJson = contentType.startsWith('application/json');

      if (isJson || contentType.startsWith('text/')) {
        stream.body = stream.body.toString('utf8');
      }

      if (isJson) {
        stream.bodyText = String(stream.body);
        stream.body = tryToParseJson(String(stream.body));
      }

      resolve(stream.body);
    });
  });
}

export const Http = new HttpServer();
export const Get = 'GET';
export const Post = 'POST';
