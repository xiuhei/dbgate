// Regression tests for token issuance by auth providers.
//
// The provider whose login() runs is chosen by the client through its amoid (auth/login,
// connections/dblogin-auth, ...). AuthProviderBase.login used to sign a session token without
// checking anything, and every provider that did not override it inherited that - so
// `POST /auth/login {"amoid":"superadmin"}` returned a superadmin token, and OAuth / Google /
// MS Entra logins could be skipped by asking for a token directly.

jest.mock('dbgate-tools', () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  extractErrorLogData: jest.fn(),
  getPredefinedPermissions: jest.fn(() => []),
  sortPermissionsFromTheSameLevel: jest.fn(x => x),
  getConnectionLabel: jest.fn(),
  runQueryFmt: jest.fn(),
}));
jest.mock('activedirectory2', () => ({ promiseWrapper: class {} }));
jest.mock('axios', () => ({ default: { post: jest.fn(), get: jest.fn() } }));
jest.mock('google-auth-library', () => ({ GoogleAuth: class {}, OAuth2Client: class {}, JWT: class {} }));

jest.mock('../utility/authProxy', () => ({ authProxyGetTokenFromCode: jest.fn(), authProxyGetRedirectUrl: jest.fn() }));
jest.mock('../utility/crypting', () => ({ decryptUser: jest.fn(x => x), decryptPasswordString: jest.fn(x => x) }));
jest.mock('../utility/auditlog', () => ({ sendToAuditLog: jest.fn() }));

jest.mock('./authConfigTools', () => ({ isEnabledConfigValue: jest.fn(() => true) }));
jest.mock('../controllers/storage', () => ({ readConfig: jest.fn(async () => ({})) }));

jest.mock('../utility/socket', () => ({
  ...jest.requireActual('../utility/socket'),
  emit: jest.fn(),
  emitChanged: jest.fn(),
}));

const jwt = require('jsonwebtoken');

const AUTH_ENV_KEYS = ['AUTH_PROVIDER', 'STORAGE_DATABASE', 'OAUTH_AUTH', 'AD_URL', 'LOGIN', 'PASSWORD', 'BASIC_AUTH'];

// Providers read the auth env variables both when the module is loaded and when login() runs,
// so the variables stay set until the test finishes.
let savedEnv = null;

function loadAuthProviderModule(env = {}) {
  savedEnv = {};
  for (const key of AUTH_ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  Object.assign(process.env, env);
  let mod;
  jest.isolateModules(() => {
    mod = require('./authProvider');
  });
  return mod;
}

afterEach(() => {
  if (!savedEnv) return;
  for (const key of AUTH_ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  savedEnv = null;
});

describe('env auth providers', () => {
  test('AuthProviderBase.login does not issue a token', async () => {
    const { AuthProviderBase } = loadAuthProviderModule();
    const resp = await new AuthProviderBase().login('user', 'password');
    expect(resp.accessToken).toBeUndefined();
    expect(resp.error).toBeTruthy();
  });

  test('without configured authentication, the anonymous provider still logs everybody in', async () => {
    const { getDefaultAuthProvider } = loadAuthProviderModule();
    const provider = getDefaultAuthProvider();
    expect(provider.amoid).toBe('none');
    expect(provider.toJson().workflowType).toBe('anonymous');

    const resp = await provider.login(undefined, undefined);
    expect(resp.accessToken).toBeTruthy();
    expect(jwt.decode(resp.accessToken).amoid).toBe('none');
  });

  test('AUTH_PROVIDER=none logs everybody in anonymously', async () => {
    const { getDefaultAuthProvider } = loadAuthProviderModule({ AUTH_PROVIDER: 'none' });
    const provider = getDefaultAuthProvider();
    expect(provider.amoid).toBe('none');
    expect((await provider.login(undefined, undefined)).accessToken).toBeTruthy();
  });

  test('an unknown AUTH_PROVIDER denies all logins instead of falling back to anonymous', async () => {
    const { getDefaultAuthProvider } = loadAuthProviderModule({ AUTH_PROVIDER: 'oatuh' });
    const provider = getDefaultAuthProvider();
    expect(provider.amoid).toBe('deny');

    const resp = await provider.login('admin', 'secret');
    expect(resp.accessToken).toBeUndefined();
    expect(resp.error).toBeTruthy();
  });

  test('the env OAuth provider cannot be logged into without the OAuth flow', async () => {
    const { getDefaultAuthProvider } = loadAuthProviderModule({ OAUTH_AUTH: 'https://idp.example/authorize' });
    const provider = getDefaultAuthProvider();
    expect(provider.amoid).toBe('oauth');

    const resp = await provider.login(undefined, undefined);
    expect(resp.accessToken).toBeUndefined();
  });

  test('the env logins provider still rejects wrong credentials and accepts correct ones', async () => {
    const { getDefaultAuthProvider } = loadAuthProviderModule({ LOGIN: 'admin', PASSWORD: 'secret' });
    const provider = getDefaultAuthProvider();
    expect(provider.amoid).toBe('logins');

    expect((await provider.login('admin', 'wrong')).accessToken).toBeUndefined();
    expect((await provider.login('admin', undefined)).accessToken).toBeUndefined();
    expect((await provider.login('admin', 'secret')).accessToken).toBeTruthy();
  });
});

describe('auth/login', () => {
  const { setAuthProviders, AnonymousAuthProvider, AuthProviderBase } = require('./authProvider');
  const authController = require('../controllers/auth');

  beforeEach(() => {
    const oauth = new AuthProviderBase();
    oauth.amoid = 'oauth-1';
    const superadmin = new AuthProviderBase();
    superadmin.amoid = 'superadmin';
    setAuthProviders([oauth, superadmin], oauth);
  });

  test('a superadmin token cannot be obtained by naming the superadmin provider', async () => {
    const resp = await authController.login({ amoid: 'superadmin' }, {});
    expect(resp.accessToken).toBeUndefined();
  });

  test('a redirect-based provider cannot be logged into directly', async () => {
    const resp = await authController.login({ amoid: 'oauth-1' }, {});
    expect(resp.accessToken).toBeUndefined();
  });

  test('an unknown provider is rejected instead of throwing', async () => {
    const resp = await authController.login({ amoid: 'no-such-provider' }, {});
    expect(resp.accessToken).toBeUndefined();
    expect(resp.error).toBeTruthy();
  });

  test('the anonymous provider keeps working when it is the configured one', async () => {
    setAuthProviders([new AnonymousAuthProvider()]);
    const resp = await authController.login({ amoid: 'none' }, {});
    expect(resp.accessToken).toBeTruthy();
  });
});

describe('authMiddleware with BASIC_AUTH', () => {
  const { authMiddleware } = require('../controllers/auth');

  let savedBasicAuth, savedStorageDatabase;
  beforeEach(() => {
    savedBasicAuth = process.env.BASIC_AUTH;
    savedStorageDatabase = process.env.STORAGE_DATABASE;
  });
  afterEach(() => {
    if (savedBasicAuth === undefined) delete process.env.BASIC_AUTH;
    else process.env.BASIC_AUTH = savedBasicAuth;
    if (savedStorageDatabase === undefined) delete process.env.STORAGE_DATABASE;
    else process.env.STORAGE_DATABASE = savedStorageDatabase;
  });

  async function callProtectedRoute() {
    const req = { path: '/connections/list', headers: {} };
    const res = { status: jest.fn(() => res), send: jest.fn(() => res), setHeader: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    return { res, next };
  }

  test('basic auth alone leaves the token check to the basic auth middleware', async () => {
    process.env.BASIC_AUTH = '1';
    delete process.env.STORAGE_DATABASE;
    const { next } = await callProtectedRoute();
    expect(next).toHaveBeenCalled();
  });

  // main.js does not install basic auth when storage is used, so skipping the token check here
  // used to leave the whole API unauthenticated.
  test('with BASIC_AUTH and STORAGE_DATABASE both set, requests still need a token', async () => {
    process.env.BASIC_AUTH = '1';
    process.env.STORAGE_DATABASE = 'dbgate';
    const { res, next } = await callProtectedRoute();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
