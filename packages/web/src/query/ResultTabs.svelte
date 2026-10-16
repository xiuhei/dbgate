<script lang="ts">
  import _ from 'lodash';

  import { onMount, tick } from 'svelte';

  import JslDataGrid from '../datagrid/JslDataGrid.svelte';
  import TabControl from '../elements/TabControl.svelte';
  import { allResultsInOneTabDefault } from '../stores';
  import { apiCall, apiOff, apiOn } from '../utility/api';
  import useEffect from '../utility/useEffect';
  import AllResultsTab from './AllResultsTab.svelte';

  import { _t } from '../translations';
  import createUndoReducer from '../utility/createUndoReducer';
  import ToolStripButton from '../buttons/ToolStripButton.svelte';
  import {
    changeSetChangedCount,
    changeSetContainsChanges,
    changeSetToSql,
    createChangeSet,
    createQueryResultSaveChangeSet,
  } from 'dbgate-datalib';
  import { scriptToSql } from 'dbgate-sqltree';

  export let tabs = [];
  export let sessionId;
  export let executeNumber;
  export let driver;
  export let conid = null;
  export let database = null;
  export let dbinfo = null;
  export let autoCommit = false;
  export let onQueryResultChanges = null;
  export let onSaveQueryResult = null;

  export let resultCount;

  onMount(() => {
    allResultsInOneTab = $allResultsInOneTabDefault;
  });

  let allResultsInOneTab = null;
  let resultInfos = [];

  let domTabs;
  let changeSetStates = {};
  let changeSetDispatchers = {};
  let changeSetUnsubscribers = {};
  let queryResultInfos = {};
  let lastResetExecuteNumber = null;
  let changedResultJslids = [];

  $: queryResultEditingEnabled = true;
  $: resultCount = resultInfos.length;
  $: changedResultJslids = resultInfos
    .map(info => info.jslid)
    .filter(jslid => changeSetContainsChanges(changeSetStates[jslid]?.value));
  $: onQueryResultChanges?.(
    _.sum(Object.values(changeSetStates).map((state: any) => (state?.value ? changeSetChangedCount(state.value) : 0)))
  );

  const handleResultSet = async props => {
    const { jslid, resultIndex } = props;
    if (queryResultEditingEnabled) {
      const [changeSetStore, dispatchChangeSet] = createUndoReducer(createChangeSet());
      changeSetDispatchers = { ...changeSetDispatchers, [jslid]: dispatchChangeSet };
      changeSetUnsubscribers[jslid] = changeSetStore.subscribe(value => {
        changeSetStates = { ...changeSetStates, [jslid]: value };
      });
    }
    resultInfos = [...resultInfos, { jslid, resultIndex }];
    await tick();
    const currentTab = allTabs[domTabs.getValue()];
    if (!currentTab?.isResult) domTabs.setValue(_.findIndex(allTabs, x => x.isResult));
  };

  $: oneTab = allResultsInOneTab ?? $allResultsInOneTabDefault;

  $: allTabs = [
    ...tabs,

    ...(oneTab && resultInfos.length > 0
      ? [
          {
            label: _t('resultTabs.results', { defaultMessage: 'Results' }),
            isResult: true,
            component: AllResultsTab,
            props: {
              resultInfos,
              driver,
              dbinfo,
              changeSetStates,
              changeSetDispatchers,
              queryResultEditing: queryResultEditingEnabled,
              onQueryResultInfoLoaded: handleQueryResultInfoLoaded,
            },
          },
        ]
      : resultInfos.map((info, index) => ({
          label: _t('resultTabs.resultNumber', { defaultMessage: 'Result {number}', values: { number: index + 1 } }),
          isResult: true,
          component: JslDataGrid,
          resultIndex: info.resultIndex,
          props: {
            jslid: info.jslid,
            driver,
            dbinfo,
            queryResultEditing: queryResultEditingEnabled,
            changeSetState: queryResultEditingEnabled ? changeSetStates[info.jslid] : null,
            dispatchChangeSet: queryResultEditingEnabled ? changeSetDispatchers[info.jslid] : null,
            onQueryResultInfoLoaded: value => handleQueryResultInfoLoaded(info.jslid, value),

          },
        }))),

  ];

  function resetResultState() {
    resultInfos = [];

    for (const unsubscribe of Object.values(changeSetUnsubscribers) as any[]) unsubscribe?.();
    changeSetStates = {};
    changeSetDispatchers = {};
    changeSetUnsubscribers = {};
    queryResultInfos = {};
    changedResultJslids = [];
    if (domTabs) domTabs.setValue(0);
  }

  $: if (executeNumber >= 0 && executeNumber != lastResetExecuteNumber) {
    lastResetExecuteNumber = executeNumber;
    resetResultState();
  }

  $: effect = useEffect(() => {
    return onSession(sessionId);
  });
  function onSession(sid) {
    if (sid) {
      apiOn(`session-recordset-${sid}`, handleResultSet);

      return () => {
        apiOff(`session-recordset-${sid}`, handleResultSet);

      };
    }
    return () => {};
  }
  $: $effect;

  function setOneTabValue(value) {
    allResultsInOneTab = value;
    $allResultsInOneTabDefault = value;
  }

  function handleQueryResultInfoLoaded(jslid, info) {
    queryResultInfos = { ...queryResultInfos, [jslid]: info };
  }

  function getChangedResultJslids() {
    return changedResultJslids;
  }

  function getActiveResultJslid() {
    const currentTab = allTabs[domTabs?.getValue?.()];
    if (!currentTab?.isResult || currentTab.resultIndex == null) return null;
    return resultInfos.find(info => info.resultIndex == currentTab.resultIndex)?.jslid;
  }

  function getSaveTargetJslids() {
    const changedJslids = getChangedResultJslids();
    if (oneTab) return changedJslids;
    const activeJslid = getActiveResultJslid();
    if (activeJslid && changedJslids.includes(activeJslid)) return [activeJslid];
    return changedJslids;
  }

  export function canSaveQueryResult() {
    if (!queryResultEditingEnabled) return false;
    return getChangedResultJslids().length > 0;
  }

  export function getQueryResultSaveInfo() {
    if (!queryResultEditingEnabled) return null;
    const targetJslids = getSaveTargetJslids();
    const changeSets = targetJslids
      .map(jslid => createQueryResultSaveChangeSet(changeSetStates[jslid]?.value, queryResultInfos[jslid]))
      .filter(changeSetContainsChanges);
    const changeSet = {
      ...createChangeSet(),
      updates: _.flatten(changeSets.map(changeSet => changeSet.updates)),
    };
    if (!changeSetContainsChanges(changeSet)) return null;
    const script = driver.createSaveChangeSetScript(changeSet, dbinfo, () =>
      changeSetToSql(changeSet, dbinfo, driver.dialect)
    );
    return {
      targetJslids,
      changeSet,
      sql: scriptToSql(driver, script),
      engine: driver.engine,
    };
  }

  export async function saveQueryResult(saveInfo, sql) {
    if (!queryResultEditingEnabled) return { state: 'ok', savedCount: 0 };
    const targetJslids = saveInfo?.targetJslids || [];
    const changeSet = saveInfo?.changeSet;
    if (!changeSetContainsChanges(changeSet)) return { state: 'ok', savedCount: 0 };
    const res = driver?.singleConnectionOnly
      ? await apiCall('database-connections/save-query-result-data', { conid, database, changeSet, sql })
      : await apiCall('sessions/save-query-result-data', { sesid: sessionId, changeSet, sql, autoCommit });
    if (res?.errorMessage) return res;
    for (const jslid of targetJslids) {
      changeSetDispatchers[jslid]?.({ type: 'reset', value: createChangeSet() });
    }
    return { state: 'ok', savedCount: targetJslids.length };
  }

  export function revertQueryResultChanges() {
    if (!queryResultEditingEnabled) return;
    for (const jslid of getSaveTargetJslids()) {
      changeSetDispatchers[jslid]?.({ type: 'reset', value: createChangeSet() });
    }
  }

</script>

<TabControl
  bind:this={domTabs}
  tabs={allTabs}
  menu={resultInfos.length > 0 && [
    oneTab
      ? { text: _t('resultTabs.everyResultInSingleTab', { defaultMessage: 'Every result in single tab' }), onClick: () => setOneTabValue(false) }
      : { text: _t('resultTabs.allResultsInOneTab', { defaultMessage: 'All results in one tab' }), onClick: () => setOneTabValue(true) },
  ]}
>
  <slot name="0" slot="0" />
  <slot name="1" slot="1" />
  <slot name="2" slot="2" />
  <slot name="3" slot="3" />
  <slot name="4" slot="4" />
  <slot name="5" slot="5" />
  <slot name="6" slot="6" />
  <slot name="7" slot="7" />
  <svelte:fragment slot="tab-actions">
    {#if queryResultEditingEnabled && changedResultJslids.length > 0}
      <ToolStripButton
        icon="icon save"
        title={_t('command.query.saveResult', { defaultMessage: 'Save result changes' })}
        data-testid="ResultTabs_saveResult"
        on:click={() => onSaveQueryResult?.()}
      >
        {_t('common.save', { defaultMessage: 'Save' })}
      </ToolStripButton>
      <ToolStripButton
        icon="icon undo"
        title={_t('command.datagrid.revertAllChanges', { defaultMessage: 'Revert all changes' })}
        data-testid="ResultTabs_revertResult"
        on:click={revertQueryResultChanges}
      >
        {_t('command.datagrid.revertAllChanges.toolbar', { defaultMessage: 'Revert all' })}
      </ToolStripButton>
    {/if}
  </svelte:fragment>
</TabControl>
