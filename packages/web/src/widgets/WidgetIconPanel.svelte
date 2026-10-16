<script lang="ts">
  import FontIcon from '../icons/FontIcon.svelte';
  import { currentDropDownMenu, selectedWidget, visibleSelectedWidget, visibleWidgetSideBar, visibleHamburgerMenuWidget } from '../stores';
  import mainMenuDefinition from '../../../../app/src/mainMenuDefinition';
  import hasPermission from '../utility/hasPermission';
  import { showModal } from '../modals/modalTools';
  import NewObjectModal from '../modals/NewObjectModal.svelte';
  import openNewTab from '../utility/openNewTab';
  import { _t, getCurrentTranslations } from '../translations';

  let domMainMenu;
  const widgets = [
    { icon: 'icon database', name: 'database', title: _t('widgets.databaseConnections', { defaultMessage: 'Database connections' }) },
    { icon: 'icon opened-tabs', name: 'opened-tabs', title: _t('widgets.openedTabs', { defaultMessage: 'Opened tabs' }) },
    { icon: 'icon file', name: 'file', title: _t('widgets.favoritesAndSavedFiles', { defaultMessage: 'Favorites & Saved files' }) },
    { icon: 'icon history', name: 'history', title: _t('widgets.queryHistoryAndClosedTabs', { defaultMessage: 'Query history & Closed tabs' }) },
  ];

  function handleChangeWidget(name) {
    if ($visibleSelectedWidget == name) $visibleWidgetSideBar = false;
    else { $selectedWidget = name; $visibleWidgetSideBar = true; }
  }
  function handleMainMenu() {
    const rect = domMainMenu.getBoundingClientRect();
    currentDropDownMenu.set({ left: rect.right, top: rect.top, items: mainMenuDefinition({ editMenu: false }, getCurrentTranslations()) });
  }
  function handleSettingsMenu() {
    openNewTab({ title: 'Settings', icon: 'icon settings', tabComponent: 'SettingsTab', props: {} });
  }
</script>

<div class="main">
  {#if $visibleHamburgerMenuWidget}
    <div class="wrapper mb-3" on:click={handleMainMenu} bind:this={domMainMenu} data-testid="WidgetIconPanel_menu"><FontIcon icon="icon menu" /></div>
  {/if}
  {#each widgets.filter(x => hasPermission(`widgets/${x.name}`)) as item}
    <div class="wrapper" class:selected={item.name == $visibleSelectedWidget} data-testid={`WidgetIconPanel_${item.name}`} on:click={() => handleChangeWidget(item.name)}><FontIcon icon={item.icon} title={item.title} /></div>
  {/each}
  <div class="wrapper" on:click={() => showModal(NewObjectModal)} data-testid="WidgetIconPanel_addButton" title={_t('widgets.addNew', { defaultMessage: 'Add New' })}><FontIcon icon="icon add" /></div>
  <div class="flex1">&nbsp;</div>
  <div class="wrapper" on:click={handleSettingsMenu} data-testid="WidgetIconPanel_settings"><FontIcon icon="icon settings" /></div>
</div>

<style>
  .wrapper {
    font-size: 20pt;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-widget-panel-foreground);
    position: relative;
    transition: var(--theme-widget-icon-transition);
    cursor: pointer;
  }
  .wrapper:hover {
    color: var(--theme-widget-icon-foreground-hover);
  }
  .wrapper.selected {
    color: var(--theme-widget-icon-foreground-active);
    background: var(--theme-widget-icon-background-active);
    border-left: var(--theme-widget-icon-border-active);
  }
  .main {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  :global(.widget-icon-panel-rounded) {
    border-top-left-radius: 10px;
    border-top-right-radius: 10px;
  }
</style>
