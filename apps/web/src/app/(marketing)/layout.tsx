import { SiteFooter } from '../_components/SiteFooter';
import { PageTransition } from '../_components/PageTransition';
import { ScrollAnimations } from '../_components/ScrollAnimations';
import { SiteNavbar } from '../_components/SiteNavbar';

const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.moffu.pro';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNavbar portalUrl={portalUrl} />
      <ScrollAnimations />
      <PageTransition>{children}</PageTransition>
      <SiteFooter portalUrl={portalUrl} />
    </>
  );
}
