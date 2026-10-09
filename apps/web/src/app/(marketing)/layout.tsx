import { SiteNav } from '../_components/SiteNav';
import { SiteFooter } from '../_components/SiteFooter';
import { PageTransition } from '../_components/PageTransition';
import { ScrollAnimations } from '../_components/ScrollAnimations';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <ScrollAnimations />
      <PageTransition>{children}</PageTransition>
      <SiteFooter />
    </>
  );
}
