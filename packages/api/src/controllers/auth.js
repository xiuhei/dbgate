
const jwt = require('jsonwebtoken');
const getExpressPath = require('../utility/getExpressPath');
const { getLogger, extractErrorLogData } = require('dbgate-tools');

const { getTokenSecret, getTokenLifetime, isBasicAuthActive } = require('../auth/authCommon');
const {
  getAuthProviderFromReq,
  getAuthProviders,
  getDefaultAuthProvider,
  getAuthProviderById,
} = require('../auth/authProvider');
const storage = require('./storage');
const { decryptPasswordString } = require('../utility/crypting');

const { sendToAuditLog } = require('../utility/auditlog');

const logger = getLogger('auth');

function unauthorizedResponse(req, res, text) {
  // if (req.path == getExpressPath('/config/get-settings')) {
  //   return res.json({});
  // }
  // if (req.path == getExpressPath('/connections/list')) {
  //   return res.json([]);
  // }

  return res.status(401).send(text);
}

async function authMiddleware(req, res, next) {

  const SKIP_AUTH_PATHS = [
    '/config/get',
    '/config/logout',
    '/config/get-settings',
    '/auth/oauth-token',
    '/auth/login',
    '/auth/redirect',
    '/redirect',
    '/stream',
    '/storage/get-connections-for-login-page',
    '/storage/set-admin-password',
    '/storage/request-password-reset',
    '/storage/reset-password',
    '/auth/get-providers',
    '/connections/dblogin-web',
    '/connections/dblogin-app',
    '/connections/dblogin-auth',
    '/connections/dblogin-auth-token',
    '/health',
    '/__health',
  ];

  // console.log('********************* getAuthProvider()', getAuthProvider());

  // const isAdminPage = req.headers['x-is-admin-page'] == 'true';

  if (process.env.SKIP_ALL_AUTH) {
    // API is not authorized for basic auth
    return next();
  }

  if (isBasicAuthActive()) {
    // API is not authorized for basic auth
    return next();
  }

  let skipAuth = !!SKIP_AUTH_PATHS.find(x => req.path == getExpressPath(x));

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    if (skipAuth) {
      return next();
    }
    return unauthorizedResponse(req, res, 'missing authorization header');
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getTokenSecret());
    // Session tokens never carry tokenUse. Anything that does was minted for a narrower
    // purpose (such as an autoExecute team file) and must not be accepted here
    // as proof of an API session.
    if (decoded.tokenUse) {
      throw new Error(`Token issued for ${decoded.tokenUse} cannot be used for the DbGate API`);
    }
    req.user = decoded;

    return next();
  } catch (err) {
    if (skipAuth) {
      req.isInvalidToken = true;
      return next();
    }

    logger.error(extractErrorLogData(err), 'DBGM-00098 Sending invalid token error');

    return unauthorizedResponse(req, res, 'invalid token');
  }
}

module.exports = {
  oauthToken_meta: true,
  async oauthToken(params, req) {
    const { amoid } = params;
    return getAuthProviderById(amoid).oauthToken(params, req);
  },
  login_meta: true,
  async login(params, req) {
    const { amoid, login, password, isAdminPage } = params;

    if (isAdminPage) {
      let adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword) {
        const adminConfig = await storage.readConfig({ group: 'admin' });
        adminPassword = decryptPasswordString(adminConfig?.adminPassword);
      }
      if (adminPassword && adminPassword == password) {

        sendToAuditLog(req, {
          category: 'auth',
          component: 'AuthController',
          action: 'login',
          event: 'login.admin',
          severity: 'info',
          message: 'Administration login successful',
        });

        const licenseUid = `superadmin`;
        const accessToken = jwt.sign(
          {
            login: 'superadmin',
            roleId: -3,
            licenseUid,
            amoid: 'superadmin',
          },
          getTokenSecret(),
          {
            expiresIn: getTokenLifetime(),
          }
        );

        return {
          accessToken,
        };
      }

      sendToAuditLog(req, {
        category: 'auth',
        component: 'AuthController',
        action: 'loginFail',
        event: 'login.adminFailed',
        severity: 'warn',
        message: 'Administraton login failed',
      });

      return { error: 'Login failed' };
    }

    const authProvider = getAuthProviderById(amoid);
    if (!authProvider) {
      return { error: 'Login failed' };
    }
    return authProvider.login(login, password, undefined, req);
  },

  getProviders_meta: true,
  getProviders() {
    return {
      providers: getAuthProviders()
        .filter(x => !x.skipInList)
        .map(x => x.toJson()),
      default: getDefaultAuthProvider()?.amoid,
    };
  },

  redirect_meta: true,
  async redirect(params) {
    const { amoid } = params;
    return getAuthProviderById(amoid).redirect(params);
  },

  authMiddleware,
};
