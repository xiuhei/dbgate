<script lang="ts" context="module">
  export const extractKey = data => data.name;
  export const createMatcher = filter => data => filterName(filter, data.name);
</script>

<script lang="ts">
  import _ from 'lodash';
  import { extractPackageName, filterName } from 'dbgate-tools';

  import { currentArchive, currentDatabase } from '../stores';

  import openNewTab from '../utility/openNewTab';
  import AppObjectCore from './AppObjectCore.svelte';
  import newQuery from '../query/newQuery';
  import { showModal } from '../modals/modalTools';
  import ConfirmModal from '../modals/ConfirmModal.svelte';
  import InputTextModal from '../modals/InputTextModal.svelte';
  import ErrorMessageModal from '../modals/ErrorMessageModal.svelte';
  import { apiCall } from '../utility/api';
  import hasPermission from '../utility/hasPermission';

  import { extractShellConnection } from '../impexp/createImpExpScript';
  import { saveFileToDisk } from '../utility/exportFileTools';
  import { _t } from '../translations';

  export let data;

  const handleDelete = () => {

    showModal(ConfirmModal, {
      message: data.name.endsWith('.link')
        ? _t('archiveFolder.deleteLinkConfirm', { defaultMessage: 'Really delete link to folder {folderName}? Folder content remains untouched.', values: { folderName: data.name } })
        : _t('archiveFolder.deleteFolderConfirm', { defaultMessage: 'Really delete folder {folderName}?', values: { folderName: data.name } }),
      onConfirm: () => {
        apiCall('archive/delete-folder', { folder: data.name });
      },
    });
  };

  const handleRename = () => {

    const isLink = data.name.endsWith('.link');
    const name = isLink ? data.name.slice(0, -5) : data.name;
    const suffix = isLink ? '.link' : '';

    showModal(InputTextModal, {
      value: name,
      label: _t('archiveFolder.newFolderName', { defaultMessage: 'New folder name' }),
      header: _t('archiveFolder.renameFolder', { defaultMessage: 'Rename folder' }),
      onConfirm: async newFolder => {
        await apiCall('archive/rename-folder', {
          folder: data.name,
          newFolder: newFolder + suffix,
        });
        if ($currentArchive == data.name) {
          $currentArchive = newFolder + suffix;
        }
      },
    });
  };

  const handleGenerateDeployScript = () => {

    openNewTab(
      {
        title: 'Shell #',
        icon: 'img shell',
        tabComponent: 'ShellTab',
      },
      {
        editor: `// @require ${extractPackageName($currentDatabase.connection.engine)}

await dbgateApi.deployDb(${JSON.stringify(
          {
            connection: extractShellConnection($currentDatabase.connection, $currentDatabase.name),
            modelFolder: `archive:${data.name}`,
          },
          undefined,
          2
        )})`,
      }
    );
  };

  const handleGenerateDeploySql = async () => {

    const resp = await apiCall('database-connections/generate-deploy-sql', {
      conid: $currentDatabase.connection._id,
      database: $currentDatabase.name,
      archiveFolder: data.name,
    });

    if (resp.errorMessage) {
      showModal(ErrorMessageModal, { message: resp.errorMessage });
    } else {
      newQuery({ initialData: resp.sql });
    }
  };

  function createMenu() {
    return [
      data.name != 'default' && { text: _t('common.delete', { defaultMessage: 'Delete' }), onClick: handleDelete },
      data.name != 'default' && { text: _t('common.rename', { defaultMessage: 'Rename' }), onClick: handleRename },

      $currentDatabase && [
        { text: _t('archiveFolder.generateDeployDbSql', { defaultMessage: 'Generate deploy DB SQL' }), onClick: handleGenerateDeploySql },
        hasPermission(`run-shell-script`) && { text: _t('archiveFolder.shellDeployDb', { defaultMessage: 'Shell: Deploy DB' }), onClick: handleGenerateDeployScript },
      ],

    ];
  }
</script>

<AppObjectCore
  {...$$restProps}
  {data}
  title={data.name.endsWith('.link') ? data.name.slice(0, -5) : data.name}
  icon={data.name.endsWith('.link') ? 'img link' : data.name.endsWith('.zip') ? 'img zipfile' : 'img archive-folder'}
  isBold={data.name == $currentArchive}
  on:click={() => ($currentArchive = data.name)}
  menu={createMenu}
/>
