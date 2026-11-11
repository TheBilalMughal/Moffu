import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { POSTS, getPost, getRelatedPosts, type ContentBlock } from '../posts';

export async function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `https://www.moffu.pro/blog/${post.slug}` },
    openGraph: {
      title: `${post.title} | Moffu`,
      description: post.excerpt,
      url: `https://www.moffu.pro/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.dateISO,
      authors: [post.author],
    },
  };
}

function renderBlock(block: ContentBlock, index: number) {
  switch (block.type) {
    case 'h2':
      return (
        <h2 key={index} className="text-xl font-black text-[#111827] mt-10 mb-4 leading-snug">
          {block.text}
        </h2>
      );
    case 'h3':
      return (
        <h3 key={index} className="text-base font-black text-[#111827] mt-7 mb-3 leading-snug">
          {block.text}
        </h3>
      );
    case 'p':
      return (
        <p key={index} className="text-[#374151] leading-[1.8] mb-5 text-[1rem]">
          {block.text}
        </p>
      );
    case 'ul':
      return (
        <ul key={index} className="mb-5 space-y-2 pl-0">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[#374151] text-[1rem] leading-[1.7]">
              <span className="mt-[0.4rem] w-4 h-4 rounded-full bg-[#EDE9FF] text-[#6C55E8] flex items-center justify-center flex-shrink-0">
                <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 8 8">
                  <circle cx="4" cy="4" r="2.5" />
                </svg>
              </span>
              {item}
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={index} className="mb-5 space-y-2 pl-0 counter-reset-item">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[#374151] text-[1rem] leading-[1.7]">
              <span className="mt-[0.25rem] w-5 h-5 rounded-full bg-[#111827] text-white flex items-center justify-center flex-shrink-0 text-[10px] font-black">
                {i + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      );
    case 'callout':
      return (
        <div key={index} className="my-8 bg-[#F5F3FF] border-l-4 border-[#6C55E8] rounded-r-xl px-6 py-5">
          <p className="text-[#111827] text-sm leading-[1.75] font-medium">{block.text}</p>
        </div>
      );
    default:
      return null;
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const related = getRelatedPosts(slug, 3);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.dateISO,
    author: { '@type': 'Organization', name: post.author },
    publisher: {
      '@type': 'Organization',
      name: 'Moffu',
      url: 'https://www.moffu.pro',
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://www.moffu.pro/blog/${post.slug}` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="min-h-screen bg-white">
        {/* White zone behind fixed navbar */}
        <div className="bg-white h-28" />

        {/* Article header */}
        <section className="px-6 lg:px-16 pt-10 pb-0">
          <div className="max-w-3xl mx-auto">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs text-[#9CA3AF] mb-8" aria-label="Breadcrumb">
              <Link href="/blog" className="hover:text-[#6C55E8] transition-colors font-medium">Blog</Link>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-[#6B7280]">{post.category}</span>
            </nav>

            {/* Category + meta */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className={`inline-block text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${post.categoryColor}`}>
                {post.category}
              </span>
              <span className="text-xs text-[#9CA3AF] font-medium">{post.date}</span>
              <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
              <span className="text-xs text-[#9CA3AF] font-medium">{post.readTime}</span>
            </div>

            {/* Title */}
            <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] font-black text-[#111827] leading-[1.1] mb-6">
              {post.title}
            </h1>

            {/* Excerpt */}
            <p className="text-lg text-[#6B7280] leading-relaxed mb-8 border-b border-[#E5E7EB] pb-10">
              {post.excerpt}
            </p>
          </div>
        </section>

        {/* Article body */}
        <section className="px-6 lg:px-16 py-10">
          <div className="max-w-3xl mx-auto">
            {post.content.map((block, i) => renderBlock(block, i))}
          </div>
        </section>

        {/* CTA box */}
        <section className="px-6 lg:px-16 pb-16">
          <div className="max-w-3xl mx-auto">
            <div className="bg-[#111827] rounded-2xl p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex-1">
                <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-2">Try Moffu</p>
                <p className="text-white font-black text-lg leading-snug">
                  Put this into practice. Moffu drafts replies in your brand voice.
                </p>
              </div>
              <a
                href={`${process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.moffu.pro'}/auth/signup`}
                className="flex-shrink-0 bg-[#6C55E8] text-white font-black text-sm px-6 py-3 rounded-lg hover:bg-[#5A42D1] hover:scale-105 active:scale-95 transition-all duration-150 whitespace-nowrap"
              >
                Start Free
              </a>
            </div>
          </div>
        </section>

        {/* Related posts */}
        {related.length > 0 && (
          <section className="bg-[#F9FAFB] border-t border-[#E5E7EB] px-6 lg:px-16 py-16">
            <div className="max-w-[1380px] mx-auto">
              <p className="text-xs font-semibold text-[#6C55E8] uppercase tracking-widest mb-3">Keep reading</p>
              <h2 className="text-xl font-black text-[#111827] mb-10">More from the blog</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {related.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/blog/${p.slug}`}
                    className="group bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-shadow duration-300 flex flex-col"
                  >
                    <div className={`${p.accentBg} h-20 flex items-center justify-center px-6`}>
                      <span className={`inline-block text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${p.categoryColor}`}>
                        {p.category}
                      </span>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="text-sm font-black text-[#111827] leading-snug mb-2 group-hover:text-[#6C55E8] transition-colors duration-200">
                        {p.title}
                      </h3>
                      <p className="text-xs text-[#9CA3AF] mt-auto">{p.date} · {p.readTime}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
