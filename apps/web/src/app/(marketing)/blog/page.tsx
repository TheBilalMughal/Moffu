import type { Metadata } from 'next';
import Link from 'next/link';
import { POSTS } from './posts';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Practical guides for business owners on Google reviews, reputation management, and responding in your brand voice.',
  alternates: { canonical: 'https://www.moffu.pro/blog' },
  openGraph: {
    title: 'Blog | Moffu',
    description: 'Practical guides for business owners on Google reviews, reputation management, and responding in your brand voice.',
    url: 'https://www.moffu.pro/blog',
  },
};

const CATEGORIES = ['All', 'Review Management', 'Strategy', 'Google Business Profile', 'Customer Experience', 'Brand Brain'];

function CategoryBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-block text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${color}`}>
      {label}
    </span>
  );
}

function FeaturedPost({ post }: { post: (typeof POSTS)[number] }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-shadow duration-300"
    >
      <div className="grid lg:grid-cols-2">
        {/* Visual */}
        <div className={`${post.accentBg} flex items-center justify-center p-14 min-h-[280px] lg:min-h-[400px]`}>
          <div className="w-full max-w-xs space-y-3">
            {[
              { label: 'Tone', value: 'Warm and direct' },
              { label: '1-star rule', value: 'Empathise, resolve offline' },
              { label: '5-star rule', value: 'Thank, invite back' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/80 rounded-xl px-4 py-3 border border-white">
                <p className="text-[10px] font-black text-[#111827]/40 uppercase tracking-widest mb-0.5">{label}</p>
                <p className="text-sm text-[#111827] font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Content */}
        <div className="p-8 lg:p-12 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-5">
            <CategoryBadge label={post.category} color={post.categoryColor} />
            <span className="text-[11px] text-[#9CA3AF] font-medium">Featured</span>
          </div>
          <h2 className="text-[clamp(1.4rem,2.5vw,2rem)] font-black text-[#111827] leading-[1.15] mb-4 group-hover:text-[#6C55E8] transition-colors duration-200">
            {post.title}
          </h2>
          <p className="text-[#6B7280] leading-relaxed mb-6 text-sm">{post.excerpt}</p>
          <div className="flex items-center gap-4 text-xs text-[#9CA3AF] font-medium">
            <span>{post.date}</span>
            <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
            <span>{post.readTime}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function PostCard({ post }: { post: (typeof POSTS)[number] }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-shadow duration-300"
    >
      {/* Top accent */}
      <div className={`${post.accentBg} h-28 flex items-center justify-center px-6`}>
        <CategoryBadge label={post.category} color={post.categoryColor} />
      </div>
      {/* Body */}
      <div className="flex flex-col flex-1 p-6">
        <h3 className="text-base font-black text-[#111827] leading-snug mb-3 group-hover:text-[#6C55E8] transition-colors duration-200">
          {post.title}
        </h3>
        <p className="text-sm text-[#6B7280] leading-relaxed flex-1 mb-5">{post.excerpt}</p>
        <div className="flex items-center gap-3 text-xs text-[#9CA3AF] font-medium mt-auto">
          <span>{post.date}</span>
          <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
          <span>{post.readTime}</span>
        </div>
      </div>
    </Link>
  );
}

export default function BlogPage() {
  const featured = POSTS.find((p) => p.featured) ?? POSTS[0]!;
  const rest = POSTS.filter((p) => p.slug !== featured.slug);

  return (
    <main className="min-h-screen bg-white">
      {/* White zone behind fixed navbar */}
      <div className="bg-white h-28" />

      {/* Hero */}
      <section className="bg-[#F9FAFB] border-b border-[#E5E7EB] px-6 lg:px-16 py-16">
        <div className="max-w-[1380px] mx-auto">
          <p className="text-xs font-semibold text-[#6C55E8] uppercase tracking-widest mb-4">Blog</p>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-black text-[#111827] leading-[1.05] max-w-2xl">
              Guides for businesses that care about their reputation.
            </h1>
            <p className="text-[#6B7280] text-base leading-relaxed max-w-sm lg:text-right">
              Practical advice on Google reviews, reputation management, and responding in your brand voice.
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 lg:px-16 py-16">
        <div className="max-w-[1380px] mx-auto space-y-16">

          {/* Featured */}
          <div>
            <FeaturedPost post={featured} />
          </div>

          {/* Categories */}
          <div>
            <div className="flex flex-wrap gap-2 mb-10">
              {CATEGORIES.map((cat) => (
                <span
                  key={cat}
                  className={`text-xs font-semibold px-4 py-2 rounded-xl border transition-colors ${
                    cat === 'All'
                      ? 'bg-[#111827] text-white border-[#111827]'
                      : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#111827] hover:text-[#111827]'
                  }`}
                >
                  {cat}
                </span>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rest.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#D8CCFF] px-6 lg:px-16 py-20">
        <div className="max-w-[1380px] mx-auto text-center">
          <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-black text-[#111827] leading-[1.05] mb-4">
            Ready to put this into practice?
          </h2>
          <p className="text-[#111827]/60 text-base mb-8 max-w-md mx-auto">
            Moffu handles the replies so you can focus on running your business.
          </p>
          <a
            href={`${process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.moffu.pro'}/auth/signup`}
            className="inline-block bg-[#111827] text-white font-black text-sm px-8 py-4 rounded-lg hover:scale-105 active:scale-95 transition-transform duration-150"
          >
            Start Free
          </a>
        </div>
      </section>
    </main>
  );
}
