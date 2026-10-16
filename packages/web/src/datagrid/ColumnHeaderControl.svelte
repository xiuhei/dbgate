<script>
  import FontIcon from '../icons/FontIcon.svelte';
  import DropDownButton from '../buttons/DropDownButton.svelte';
  import splitterDrag from '../utility/splitterDrag';
  import _ from 'lodash';

  import ColumnLabel from '../elements/ColumnLabel.svelte';

  import { openDatabaseObjectDetail } from '../appobj/DatabaseObjectAppObject.svelte';
  import { copyTextToClipboard } from '../utility/clipboard';

  export let column;
  export let conid = undefined;
  export let database = undefined;
  export let setSort = undefined;
  export let addToSort = undefined;
  export let clearSort = undefined;
  export let grouping = undefined;
  export let order = undefined;
  export let orderIndex = undefined;
  export let isSortDefined = false;
  export let allowDefineVirtualReferences = false;
  export let setGrouping;
  export let seachInColumns = '';
  export let onReload = undefined;
  export let driver = null;

  const openReferencedTable = () => {
    openDatabaseObjectDetail('TableDataTab', null, {
      schemaName: column.foreignKey.refSchemaName,
      pureName: column.foreignKey.refTableName,
      conid,
      database,
      objectTypeField: 'tables',
    });
  };

  function getMenu() {
    return [
      setSort && { onClick: () => setSort('ASC'), text: 'Sort ascending' },
      setSort && { onClick: () => setSort('DESC'), text: 'Sort descending' },
      isSortDefined && addToSort && !order && { onClick: () => addToSort('ASC'), text: 'Add to sort - ascending' },
      isSortDefined && addToSort && !order && { onClick: () => addToSort('DESC'), text: 'Add to sort - descending' },
      order && clearSort && { onClick: () => clearSort(), text: 'Clear sort criteria' },
      { onClick: () => copyTextToClipboard(column.columnName), text: 'Copy column name' },

      column.foreignKey && [{ divider: true }, { onClick: openReferencedTable, text: column.foreignKey.refTableName }],

      { divider: true },

    ];
  }
</script>

<div class="header">
  <div class="label">
    {#if grouping}
      <span class="grouping">
        {grouping == 'COUNT DISTINCT' ? 'distinct' : grouping.toLowerCase()}
      </span>
    {/if}
    <ColumnLabel {...column} filter={seachInColumns} />

    {#if _.isString(column.displayedDataType || column.dataType) && !order}
      <span class="data-type" title={column.dataType}>
        {(column.displayedDataType || column.dataType).toLowerCase()}
      </span>
    {/if}
  </div>
  {#if order == 'ASC'}
    <span class="icon">
      <FontIcon icon="img sort-asc" />
      {#if orderIndex >= 0}
        <span class="color-icon-green order-index">{orderIndex + 1}</span>
      {/if}
    </span>
  {/if}
  {#if order == 'DESC'}
    <span class="icon">
      <FontIcon icon="img sort-desc" />
      {#if orderIndex >= 0}
        <span class="color-icon-green order-index">{orderIndex + 1}</span>
      {/if}
    </span>
  {/if}
  <DropDownButton
    menu={getMenu}
    narrow
    data-testid={`ColumnHeaderControl_dropdown_${column?.uniqueName}`}
    circleHover
  />
  <div class="horizontal-split-handle resizeHandleControl" use:splitterDrag={'clientX'} on:resizeSplitter />
</div>

<style>
  .header {
    display: flex;
    flex-wrap: nowrap;
  }
  .order-index {
    font-size: 10pt;
    margin-left: -3px;
    margin-right: 2px;
    top: -1px;
    position: relative;
  }
  .label {
    flex: 1;
    min-width: 10px;
    padding: 2px;
    margin: auto;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .icon {
    margin-left: 3px;
    align-self: center;
    font-size: 18px;
  }
  .grouping {
    color: var(--theme-datagrid-cell-foreground-value-green);
    white-space: nowrap;
  }
  .data-type {
    color: var(--theme-generic-font-grayed);
  }
</style>
