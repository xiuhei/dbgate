<script lang="ts">
  import FormStyledButton from '../buttons/FormStyledButton.svelte';

  import FormProviderCore from '../forms/FormProviderCore.svelte';
  import FormSubmit from '../forms/FormSubmit.svelte';
  import FormTextField from '../forms/FormTextField.svelte';
  import { getCurrentConfig } from '../stores';
  import { _t } from '../translations';
  import { apiCall } from '../utility/api';
  import { writable } from 'svelte/store';

  import getElectron from '../utility/getElectron';
  import ModalBase from './ModalBase.svelte';
  import { closeCurrentModal } from './modalTools';

  import FormCheckboxField from '../forms/FormCheckboxField.svelte';
  import { useConfig, useTeamFolders } from '../utility/metadataLoaders';
  import { showSnackbarError } from '../utility/snackbar';
  import FormTeamFolderSelect from '../forms/FormTeamFolderSelect.svelte';

  export let data;
  export let name;
  export let folder;
  export let format;
  export let fileExtension;
  export let filePath;
  export let onSave = undefined;

  export let defaultTeamFolder = false;
  // export let cntid;

  const teamFolders = useTeamFolders();
  $: writableTeamFolderIds = ($teamFolders || [])
    .filter(folder => folder.allowCreate || folder.allowWrite)
    .map(folder => folder.teamFolderId?.toString());
  $: enabledTeamFolders = writableTeamFolderIds.length > 0;

  const configValue = useConfig();

  const values = writable({
    name,

    saveToTeamFolder: !!(getCurrentConfig()?.storageDatabase && defaultTeamFolder),
    teamFolderId: '-1',
  });

  const electron = getElectron();

  $: if (
    $values.saveToTeamFolder &&
    enabledTeamFolders &&
    !writableTeamFolderIds.includes($values.teamFolderId?.toString())
  ) {
    values.update(current => ({
      ...current,
      teamFolderId: writableTeamFolderIds[0],
    }));
  }

  const handleSubmit = async e => {
    const { name, teamFolderId, saveToTeamFolder } = e.detail;
    if (saveToTeamFolder && enabledTeamFolders) {
      const selectedTeamFolderId = writableTeamFolderIds.includes(teamFolderId?.toString())
        ? teamFolderId
        : writableTeamFolderIds[0];
      const resp = await apiCall('team-files/create-new', {
        fileType: folder,
        file: name,
        data,
        teamFolderId: selectedTeamFolderId,
      });
      if (resp?.apiErrorMessage) {
        showSnackbarError(resp.apiErrorMessage);
      } else if (resp?.teamFileId) {
        closeCurrentModal();
        if (onSave) {
          onSave(name, {
            savedFile: name,
            savedFolder: folder,
            savedFilePath: null,

            savedTeamFileId: resp.teamFileId,
          });
        }
      } else {
        showSnackbarError('Failed to save to team folder.');
      }
    } else {
      await apiCall('files/save', { folder, file: name, data, format });
      closeCurrentModal();
      if (onSave) {
        onSave(name, {
          savedFile: name,
          savedFolder: folder,
          savedFilePath: null,

          savedTeamFileId: null,
        });
      }
    }
  };

  const handleSaveToDisk = async filePath => {
    const path = window.require('path');
    const parsed = path.parse(filePath);
    // if (!parsed.ext) filePath += `.${fileExtension}`;

    await apiCall('files/save-as', { filePath, data, format });
    closeCurrentModal();

    if (onSave) {
      onSave(parsed.name, {
        savedFile: null,
        savedFolder: null,
        savedFilePath: filePath,

        savedTeamFileId: null,
      });
    }
  };
</script>

<FormProviderCore {values}>
  <ModalBase {...$$restProps}>
    <svelte:fragment slot="header">Save file</svelte:fragment>
    <FormTextField label="File name" name="name" focused />

    {#if $configValue?.storageDatabase && enabledTeamFolders}
      <FormCheckboxField
        label={_t('files.saveToTeamFolder', { defaultMessage: 'Save to team folder' })}
        name="saveToTeamFolder"
      />
      {#if $values.saveToTeamFolder}
        <FormTeamFolderSelect
          isNative
          data-testid="SaveFileModal_teamFolderSelect"
          label={_t('files.chooseTeamFolder', { defaultMessage: 'Choose team folder' })}
          name="teamFolderId"
          folderFilter={folder => folder.allowCreate || folder.allowWrite}
        />
      {/if}
    {/if}

    <svelte:fragment slot="footer">
      <FormSubmit value={_t('common.save', { defaultMessage: 'Save' })} on:click={handleSubmit} />
      {#if electron}
        <FormStyledButton
          type="button"
          value={_t('common.saveToDisk', { defaultMessage: 'Save to disk' })}
          on:click={async () => {
            const file = await electron.showSaveDialog({
              filters: [
                {
                  name: _t('common.fileType', {
                    defaultMessage: '{extension} files',
                    values: { extension: fileExtension.toUpperCase() },
                  }),
                  extensions: [fileExtension],
                },
                { name: _t('common.allFiles', { defaultMessage: 'All files' }), extensions: ['*'] },
              ],
              defaultPath: filePath || `${name}.${fileExtension}`,
              properties: ['showOverwriteConfirmation'],
            });
            if (file) {
              handleSaveToDisk(file);
            }
          }}
        />
      {/if}
    </svelte:fragment>
  </ModalBase>
</FormProviderCore>
