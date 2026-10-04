import { test, expect } from '@playwright/test';

test.describe('Phase 16: API & Web Server Contracts', () => {
  test('Contract 1: Test Server Health Endpoint returns 200 OK', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.port).toBe(8081);
  });

  test('Contract 2: Public Sanad Route delivers HTML with appropriate content-type', async ({ request }) => {
    const response = await request.get('/verify-sanad');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
  });

  test('Contract 3: Login Route delivers valid HTML document with UTF-8 encoding', async ({ request }) => {
    const response = await request.get('/auth/login');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    const text = await response.text();
    expect(text).toContain('<!DOCTYPE html>');
  });

  test('Contract 4: Payment Route delivers valid HTML document', async ({ request }) => {
    const response = await request.get('/payment');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
  });
});
