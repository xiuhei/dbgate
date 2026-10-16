<script lang="ts">
  import { visibleSelectedWidget } from '../stores';
  import ArchiveWidget from './ArchiveWidget.svelte';
  import DatabaseWidget from './DatabaseWidget.svelte';
  import FilesWidget from './FilesWidget.svelte';

  import HistoryWidget from './HistoryWidget.svelte';
  import AdminMenuWidget from './AdminMenuWidget.svelte';

  import hasPermission from '../utility/hasPermission';

  import OpenedTabsWidget from './OpenedTabsWidget.svelte';
</script>

{#if hasPermission('widgets/database')}
  <DatabaseWidget hidden={$visibleSelectedWidget != 'database'} />
{/if}
{#if $visibleSelectedWidget == 'file' && hasPermission('widgets/file')}
  <FilesWidget />
{/if}
{#if $visibleSelectedWidget == 'history' && hasPermission('widgets/history')}
  <HistoryWidget />
{/if}
{#if $visibleSelectedWidget == 'opened-tabs' && hasPermission('widgets/opened-tabs')}
  <OpenedTabsWidget />
{/if}

{#if $visibleSelectedWidget == 'admin' && hasPermission('widgets/admin')}
  <AdminMenuWidget />
{/if}
