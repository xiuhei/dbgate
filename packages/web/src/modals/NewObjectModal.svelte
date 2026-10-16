<script lang="ts">
  import NewObjectButton from '../buttons/NewObjectButton.svelte';
  import runCommand from '../commands/runCommand';
  import newQuery from '../query/newQuery';
  import { commandsCustomized, selectedWidget } from '../stores';
  import hasPermission from '../utility/hasPermission';

  import ModalBase from './ModalBase.svelte';
  import { closeCurrentModal } from './modalTools';
  import { _t } from '../translations';

  export let multiTabIndex = undefined;

  let NEW_ITEMS = [
    {
      icon: 'icon sql-file',
      colorClass: 'color-icon-blue',
      title: _t('common.query', { defaultMessage: 'Query' }),
      description: _t('common.queryEditor', { defaultMessage: 'SQL query editor' }),
      action: () => {
        newQuery({ multiTabIndex });
      },
      testid: 'NewObjectModal_query',
      testEnabled: () => hasPermission('dbops/query'),
    },
    {
      icon: 'icon connection',
      colorClass: 'color-icon-yellow',
      title: _t('common.connection', { defaultMessage: 'Connection' }),
      description: _t('newObject.connectionLocal', { defaultMessage: 'Database connection stored locally' }),
      command: 'new.connection',
      changeWidget: 'database',
      testid: 'NewObjectModal_connection',
      disabledMessage: _t('newObject.connectionLocalDisabled', {
        defaultMessage: 'You are not allowed to create new connections',
      }),
    },

    {
      icon: 'icon diagram',
      colorClass: 'color-icon-blue',
      title: _t('common.erDiagram', { defaultMessage: 'ER Diagram' }),
      description: _t('newObject.erDiagramDescription', { defaultMessage: 'Visualize database structure' }),
      command: 'new.diagram',
      testid: 'NewObjectModal_diagram',
      disabledMessage: _t('newObject.erDiagramDisabled', {
        defaultMessage: 'ER Diagram is not available for current database',
      }),
    },

    {
      icon: 'icon table',
      colorClass: 'color-icon-blue',
      title: _t('common.table', { defaultMessage: 'Table' }),
      description: _t('newObject.tableDescription', { defaultMessage: 'Create table in the current database' }),
      command: 'new.table',
      testid: 'NewObjectModal_table',
      disabledMessage: _t('newObject.tableDisabled', {
        defaultMessage: 'Table creation is not available for current database',
      }),
    },
    {
      icon: 'icon sql-generator',
      colorClass: 'color-icon-green',
      title: _t('common.sqlGenerator', { defaultMessage: 'SQL Generator' }),
      description: _t('newObject.sqlGeneratorDescription', {
        defaultMessage: 'Generate SQL scripts for database objects',
      }),
      command: 'sql.generator',
      testid: 'NewObjectModal_sqlGenerator',
      disabledMessage: _t('newObject.sqlGeneratorDisabled', {
        defaultMessage: 'SQL Generator is not available for current database',
      }),
    },
    {
      icon: 'icon export',
      colorClass: 'color-icon-green',
      title: _t('common.exportDatabase', { defaultMessage: 'Export database' }),
      description: _t('newObject.exportDescription', {
        defaultMessage: 'Export to file like CSV, JSON, Excel, or other DB',
      }),
      command: 'database.export',
      testid: 'NewObjectModal_databaseExport',
      disabledMessage: _t('newObject.exportDisabled', {
        defaultMessage: 'Export is not available for current database',
      }),
    },

  ];
</script>

<ModalBase simplefix {...$$restProps}>
  <div class="create-header">{_t('common.createNew', { defaultMessage: 'Create new' })}</div>
  <div class="wrapper">
    {#each NEW_ITEMS as item}
      {@const enabled = item.command
        ? $commandsCustomized[item.command]?.enabled
        : item.testEnabled
          ? item.testEnabled()
          : true}
      <NewObjectButton
        icon={item.icon}
        title={item.title}
        description={item.description}
        {enabled}
        colorClass={item.colorClass}
        data-testid={item.testid}
        disabledMessage={item.disabledMessage}
        on:click={() => {
          if (!enabled) return;
          closeCurrentModal();
          if (item.action) {
            item.action();
          } else if (item.command) {
            runCommand(item.command);
          }
          if (item.changeWidget) {
            $selectedWidget = item.changeWidget;
          }
        }}
      />
    {/each}
  </div>
</ModalBase>

<style>
  .wrapper {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
    padding: 16px;
    max-width: 820px;
    margin: 0 auto;
  }

  .create-header {
    font-size: 150%;
    text-transform: uppercase;
    color: var(--theme-generic-font-grayed);
    text-align: center;
    margin: 12px 0 4px;
  }
</style>
