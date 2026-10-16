const baseUrl = 'http://localhost:3000';
let accessToken;
const headers = () => ({ Authorization: `Bearer ${accessToken}` });
const api = (route, body = {}) => cy.request({ method: 'POST', url: `${baseUrl}/${route}`, body, headers: headers() }).its('body');

function readRows(jslid, attempts = 30) {
  return api('jsldata/get-rows', { jslid, offset: 0, limit: 10 }).then(rows => {
    if (rows.length) return rows;
    expect(attempts, 'query completes').to.be.greaterThan(0);
    return cy.wait(100).then(() => readRows(jslid, attempts - 1));
  });
}

describe('Local database tool', () => {
  beforeEach(() => {
    cy.request('POST', `${baseUrl}/auth/login`, { amoid: 'none' }).its('body.accessToken').then(token => {
      expect(token).to.be.a('string');
      accessToken = token;
    });
  });
  it('starts without account, upgrade, cloud or AI controls', () => {
    cy.visit(baseUrl);
    cy.viewport(1200, 900);
    cy.get('[data-testid="WidgetIconPanel_database"]').should('be.visible');
    for (const id of ['WidgetIconPanel_cloudAccount', 'WidgetIconPanel_cloud-public', 'WidgetIconPanel_cloud-private', 'WidgetIconPanel_premium', 'TabsPanel_buttonUpgrade']) {
      cy.get(`[data-testid="${id}"]`).should('not.exist');
    }
    cy.get('[data-testid="WidgetIconPanel_addButton"]').click();
    cy.get('[data-testid="NewObjectModal_query"]').should('be.visible');
    cy.get('[data-testid="NewObjectModal_connection"]').should('be.visible');
    for (const id of ['NewObjectModal_connectionOnCloud', 'NewObjectModal_databaseChat', 'NewObjectModal_graphqlChat']) {
      cy.get(`[data-testid="${id}"]`).should('not.exist');
    }
  });

  it('keeps local settings without subscriptions or telemetry', () => {
    cy.visit(baseUrl);
    cy.viewport(1200, 900);
    cy.get('[data-testid="WidgetIconPanel_settings"]').click();
    cy.get('[data-testid="settings-general"]').should('be.visible');
    for (const id of ['settings-license', 'settings-ai', 'GeneralSettings_usageAnalytics']) {
      cy.get(`[data-testid="${id}"]`).should('not.exist');
    }
    cy.get('[name="app.autoUpdateMode"]').should('not.exist');
    api('config/get').then(config => {
      for (const key of ['checkedLicense', 'isLicenseValid', 'trialDaysLeft', 'allowPrivateCloud', 'usageAnalyticsConsentOverride']) {
        expect(config).not.to.have.property(key);
      }
    });
  });

  it('does not expose removed service endpoints', () => {
    for (const route of ['cloud/refresh-public-files', 'auth/create-cloud-login-session', 'codex/status', 'usage-analytics/send', 'config/start-trial', 'config/save-license-key', 'plugins/upgrade', 'mcp', 'server-connections/chat-databases', 'server-connections/query-data', 'database-connections/text-to-sql']) {
      cy.request({ method: 'POST', url: `${baseUrl}/${route}`, body: {}, headers: headers(), failOnStatusCode: false }).its('status').should('eq', 404);
    }
  });

  it('keeps edit, delete and duplicate actions for local connections', () => {
    api('connections/new-sqlite-database', { file: 'local-tool-menu' }).then(connection => {
      cy.visit(baseUrl);
      cy.viewport(1200, 900);
      cy.get(`[data-testid="ConnectionAppObject_${connection._id}"]`).rightclick();
      for (const action of ['edit', 'delete', 'duplicate']) {
        cy.get(`[data-testid="ConnectionAppObject_${action}"]`).should('be.visible');
      }
      cy.get('[data-testid="ConnectionAppObject_edit"]').click();
      cy.get('[data-testid="ConnectionTab_buttonSave"]').should('be.visible');
    });
  });

  it('creates a local SQLite connection, queries data and saves a file', () => {
    api('connections/new-sqlite-database', { file: 'local-tool-regression' }).then(connection => {
      expect(connection.engine).to.eq('sqlite@dbgate-plugin-sqlite');
      api('connections/test', { connection }).then(result => {
        expect(result).not.to.have.property('apiErrorMessage');
        expect(result).not.to.have.property('error');
      });
      api('sessions/execute-reader', { conid: connection._id, database: connection.defaultDatabase, sql: 'SELECT 42 AS answer' }).then(result => {
        expect(result.jslid).to.be.a('string');
        readRows(result.jslid).then(rows => expect(rows[0].answer).to.eq(42));
      });
    });
    api('files/save', { folder: 'sql', file: 'local-tool-regression', data: 'SELECT 42 AS answer', format: 'text' });
    api('files/load', { folder: 'sql', file: 'local-tool-regression', format: 'text' }).should('eq', 'SELECT 42 AS answer');
  });
});
