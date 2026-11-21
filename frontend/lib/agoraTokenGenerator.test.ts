import { generateAgoraRtcToken } from './agoraTokenGenerator';
// @ts-ignore
const { AccessToken2 } = require('agora-token/src/AccessToken2');

describe('agoraTokenGenerator', () => {
  const testAppId = 'eabe6cf2f8404a7e8a17a58b1665c52b';
  const testCert = '53e6e5d10b15455399a1634f64307b48';
  const testChannel = 'mslb_live_test_channel';

  it('generates a valid Token007 AccessToken2', () => {
    const token = generateAgoraRtcToken({
      appId: testAppId,
      appCertificate: testCert,
      channelName: testChannel,
      uid: 1001,
      expireSeconds: 3600,
    });

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.startsWith('007')).toBe(true);

    // Verify against official Agora AccessToken2 parser
    const parsed = new AccessToken2();
    const parseResult = parsed.from_string(token);
    expect(parseResult).toBe(true);
    expect(parsed.verifySignature(testCert)).toBe(true);
    expect(parsed.services.length).toBe(1);
    expect(parsed.services[0].__channel_name.toString()).toBe(testChannel);
    expect(parsed.services[0].__uid.toString()).toBe('1001');
  });

  it('supports uid = 0 (Agora wildcard / dynamic uid)', () => {
    const token = generateAgoraRtcToken({
      appId: testAppId,
      appCertificate: testCert,
      channelName: testChannel,
      uid: 0,
    });

    expect(token.startsWith('007')).toBe(true);
    const parsed = new AccessToken2();
    expect(parsed.from_string(token)).toBe(true);
    expect(parsed.verifySignature(testCert)).toBe(true);
    expect(parsed.services[0].__uid.toString()).toBe('');
  });

  it('returns empty string if missing required parameters', () => {
    expect(
      generateAgoraRtcToken({
        appId: '',
        appCertificate: testCert,
        channelName: testChannel,
      })
    ).toBe('');

    expect(
      generateAgoraRtcToken({
        appId: testAppId,
        appCertificate: '',
        channelName: testChannel,
      })
    ).toBe('');

    expect(
      generateAgoraRtcToken({
        appId: testAppId,
        appCertificate: testCert,
        channelName: '',
      })
    ).toBe('');
  });
});
