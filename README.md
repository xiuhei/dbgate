# DbGate 本地数据库工具

DbGate 是本地运行的数据库管理工具，使用 Electron、Svelte 4 和 Node.js。数据库连接、设置、SQL 文件和查询历史保存在本机。

支持 SQL 编辑与执行、数据浏览与修改、表结构管理、ER 图、文件导入导出、数据库备份恢复，以及 SSH 隧道和 TLS 连接。内置 MySQL、PostgreSQL、SQL Server、SQLite、DuckDB、MongoDB、Redis 等数据库驱动。

## 开发环境

- Node.js 24.x
- Yarn Classic 1.22.x
- Windows 原生模块构建需要 Python 和 Visual Studio C++ 桌面开发工具及 Windows SDK

```powershell
yarn install
yarn start
```

桌面开发需要在 `app` 目录安装 Electron 依赖，然后分别运行前端、库监听和桌面程序：

```powershell
yarn --cwd app install
yarn start:web
yarn lib
yarn start:app
```

## 桌面打包

```powershell
yarn install
yarn build:app
```

构建脚本准备数据库驱动和内置插件，编译前后端，并使用 electron-builder 生成当前平台的桌面程序。Windows 默认生成 x64 的 NSIS 安装包和 ZIP，输出到 `app/dist`。

下载 Electron 和打包工具时，命令行需要能够访问 GitHub。使用代理时，在当前 PowerShell 会话配置代理地址：

```powershell
$env:HTTP_PROXY = 'http://127.0.0.1:端口'
$env:HTTPS_PROXY = $env:HTTP_PROXY
$env:ELECTRON_GET_USE_PROXY = '1'
yarn build:app
```

## 测试

API 单元测试位于 `packages/api/src`，GUI 使用 `e2e-tests` 中的 Cypress 测试。本地工具的回归检查位于 `e2e-tests/cypress/e2e/local-tool.cy.js`。

```powershell
yarn test:local-api
yarn --cwd e2e-tests install
yarn --cwd e2e-tests test:local-tool
```

先完成桌面打包，再运行本地工具回归测试。测试命令使用已构建的 Electron 启动独立测试服务，监听 `127.0.0.1:3000`，并将测试数据写入临时目录。测试使用 SQLite，不需要安装外部数据库服务器。

## 数据与连接

默认数据目录是用户主目录下的 `.dbgate`。通过 `WORKSPACE_DIR` 可以指定独立的数据目录。数据库密码、SSH 和云数据库凭据仅用于用户配置的数据库连接。

本项目基于 [DbGate](https://github.com/dbgate/dbgate)，使用 GPL-3.0 许可证，参见 [LICENSE](LICENSE)。
