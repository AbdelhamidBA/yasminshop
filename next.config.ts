import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Skew protection. A tab left open across a deploy keeps the previous
  // build's JavaScript, whose server-action IDs no longer exist on the
  // server — the next submit fails with "Server Reference ID did not match"
  // and the user has to refresh by hand. Stamping the build lets Next detect
  // that mismatch and recover instead of erroring.
  //
  // Set at build AND runtime (deploy.sh exports the commit sha); when unset
  // the option is simply inert, so local dev is unaffected.
  deploymentId: process.env.NEXT_DEPLOYMENT_ID
};

export default withNextIntl(nextConfig);
