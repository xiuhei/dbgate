<script lang="ts">

  import { useConfig } from './utility/metadataLoaders';
  import ErrorInfo from './elements/ErrorInfo.svelte';
  import Link from './elements/Link.svelte';
  import { internalRedirectTo } from './clientAuth';
  import SpecialPageLayout from './widgets/SpecialPageLayout.svelte';

  const config = useConfig();

  const params = new URLSearchParams(location.search);
  const error = params.get('error');
</script>

<SpecialPageLayout>
  <div class="heading">Configuration error</div>

  {#if $config?.configurationError}
    <ErrorInfo message={$config?.configurationError} />
  {:else if error}
    <ErrorInfo message={error} />
  {:else}
    <ErrorInfo message="No error found, try to open app again" />
    <div class="m-2">
      <Link onClick={() => internalRedirectTo('/')}>Back to app</Link>
    </div>
  {/if}
</SpecialPageLayout>

<style>
  .heading {
    text-align: center;
    margin: 1em;
    font-size: xx-large;
  }
</style>
