import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLocalConnectionRequest } from '../src/lib/local-request';
test('accepts local browser origins despite Next URL normalization', () => {
  assert.equal(isLocalConnectionRequest('http://127.0.0.1:3000','127.0.0.1:3000'),true);
  assert.equal(isLocalConnectionRequest('http://127.0.0.1:3000','localhost:3000'),true);
  assert.equal(isLocalConnectionRequest('http://localhost:3000','127.0.0.1:3000'),true);
  assert.equal(isLocalConnectionRequest('http://[::1]:3000','[::1]:3000'),true);
});
test('rejects cross-site, wrong-port, absent and malformed origins', () => {
  for (const origin of ['https://evil.example','http://localhost.evil.example:3000','http://127.0.0.1:4000','null',null,'bad']) {
    assert.equal(isLocalConnectionRequest(origin,'127.0.0.1:3000'),false);
  }
  assert.equal(isLocalConnectionRequest('http://127.0.0.1:3000','evil.example:3000'),false);
  assert.equal(isLocalConnectionRequest('http://127.0.0.1:3000',null),false);
});
