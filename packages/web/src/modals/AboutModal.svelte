<script lang="ts">
  import FormStyledButton from '../buttons/FormStyledButton.svelte';
  import { useConfig } from '../utility/metadataLoaders';
  import moment from 'moment';

  import ModalBase from './ModalBase.svelte';
  import { closeCurrentModal } from './modalTools';
  import Link from '../elements/Link.svelte';
  import FontIcon from '../icons/FontIcon.svelte';

  import { _t } from '../translations';

  const config = useConfig();
  $: version = $config?.version;
  $: buildTime = $config?.buildTime;
</script>

<ModalBase {...$$restProps}>
  <svelte:fragment slot="header">{_t('aboutModal.aboutDbGate', { defaultMessage: 'About DbGate' })}</svelte:fragment>
  <div class="flex">
    <img src="logo192.png" />
    <div class="ml-4">
      <div>
        {_t('aboutModal.version', { defaultMessage: 'Version' })}: <span>{version}</span>
      </div>
      <div>
        {_t('aboutModal.buildDate', { defaultMessage: 'Build date' })}: <span>{moment(buildTime).format('YYYY-MM-DD')}</span>
      </div>

      <div class="mt-2">
        <FontIcon icon="mdi mdi-web color-icon-blue" /> {_t('aboutModal.web', { defaultMessage: 'Web' })}: <Link href="https://www.dbgate.io">dbgate.io</Link>
      </div>

      <div class="mt-2">
        {_t('aboutModal.sourceCodes', { defaultMessage: 'Source codes' })}: <Link href="https://github.com/dbgate/dbgate/">GitHub</Link>
      </div>

      <div class="mt-2">
        {_t('aboutModal.producedBy', { defaultMessage: 'Produced by' })}: <span>Sprinx System a.s.</span>
      </div>
    </div>
  </div>

  <svelte:fragment slot="footer">
    <FormStyledButton value={_t('common.close', { defaultMessage: 'Close' })} on:click={closeCurrentModal} />
  </svelte:fragment>
</ModalBase>

<style>
  span {
    font-weight: bold;
  }
</style>
