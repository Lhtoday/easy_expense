import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createHash, randomUUID } from 'node:crypto';
import * as http from 'node:http';
import * as https from 'node:https';
import { Readable } from 'node:stream';

type RequestResult = {
  headers: http.IncomingHttpHeaders;
  stream: Readable;
};

@Injectable()
export class MinioStorageService {
  private bucketReady = false;

  constructor(private readonly config: ConfigService) {}

  async putExpenseAttachment(reportId: string, file: { originalname: string; mimetype: string; buffer: Buffer }) {
    const bucket = this.bucket();
    const storageKey = this.attachmentKey(reportId, file.originalname);
    await this.ensureBucket(bucket);
    await this.signedRequest('PUT', `/${bucket}/${storageKey}`, file.buffer, {
      'content-type': file.mimetype,
    });
    return { storageBucket: bucket, storageKey };
  }

  async getObject(bucket: string, key: string) {
    return this.signedRequest('GET', `/${bucket}/${key}`);
  }

  private async ensureBucket(bucket: string) {
    if (this.bucketReady) {
      return;
    }

    const head = await this.signedRequest('HEAD', `/${bucket}`, undefined, undefined, [200, 404]);
    if (head.headers.statusCode === '404') {
      await this.signedRequest('PUT', `/${bucket}`);
    }
    this.bucketReady = true;
  }

  private async signedRequest(method: string, path: string, body?: Buffer, extraHeaders?: Record<string, string>, okStatuses = [200]) {
    const endpoint = this.config.get<string>('MINIO_ENDPOINT') ?? 'localhost';
    const port = this.config.get<number>('MINIO_PORT') ?? 9000;
    const useSsl = this.config.get<string>('MINIO_USE_SSL') === 'true';
    const payloadHash = createHash('sha256').update(body ?? Buffer.alloc(0)).digest('hex');
    const amzDate = this.amzDate(new Date());
    const dateStamp = amzDate.slice(0, 8);
    const host = `${endpoint}:${port}`;
    const headers = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...(body ? { 'content-length': String(body.length) } : {}),
      ...extraHeaders,
    };
    const signedHeaders = Object.keys(headers)
      .map((key) => key.toLowerCase())
      .sort()
      .join(';');
    const canonicalHeaders = Object.entries(headers)
      .map(([key, value]) => [key.toLowerCase(), value] as const)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}:${String(value).trim()}\n`)
      .join('');
    const credentialScope = `${dateStamp}/us-east-1/s3/aws4_request`;
    const canonicalRequest = [method, this.canonicalPath(path), '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, this.sha256(canonicalRequest)].join('\n');
    const signature = this.hmac(this.signingKey(dateStamp), stringToSign).toString('hex');
    const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKey()}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return new Promise<RequestResult>((resolve, reject) => {
      const client = useSsl ? https : http;
      const request = client.request(
        {
          method,
          host: endpoint,
          port,
          path: this.canonicalPath(path),
          headers: { ...headers, authorization },
        },
        (response) => {
          const statusCode = response.statusCode ?? 0;
          if (!okStatuses.includes(statusCode)) {
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () => reject(new Error(`MinIO ${method} ${path} failed with ${statusCode}: ${Buffer.concat(chunks).toString('utf8')}`)));
            return;
          }
          resolve({ headers: { ...response.headers, statusCode: String(statusCode) }, stream: response });
        },
      );
      request.on('error', reject);
      if (body) {
        request.write(body);
      }
      request.end();
    });
  }

  private attachmentKey(reportId: string, fileName: string) {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'attachment';
    return `expense-reports/${reportId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
  }

  private bucket() {
    return this.config.get<string>('MINIO_BUCKET') ?? 'expenseflow-files';
  }

  private accessKey() {
    return this.config.get<string>('MINIO_ACCESS_KEY') ?? 'expenseflow';
  }

  private secretKey() {
    return this.config.get<string>('MINIO_SECRET_KEY') ?? 'expenseflow-secret';
  }

  private canonicalPath(path: string) {
    return path
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
  }

  private amzDate(date: Date) {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  }

  private sha256(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private hmac(key: Buffer | string, value: string) {
    return createHmac('sha256', key).update(value).digest();
  }

  private signingKey(dateStamp: string) {
    const dateKey = this.hmac(`AWS4${this.secretKey()}`, dateStamp);
    const regionKey = this.hmac(dateKey, 'us-east-1');
    const serviceKey = this.hmac(regionKey, 's3');
    return this.hmac(serviceKey, 'aws4_request');
  }
}
