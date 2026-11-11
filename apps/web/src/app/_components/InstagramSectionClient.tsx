'use client';

import { useState } from 'react';

interface Post {
  id: string;
  handle: string;
  post_url: string;
  thumbnail_url: string | null;
  title: string | null;
}

function getEmbedUrl(postUrl: string): string | null {
  const match = postUrl.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (!match) return null;
  return `https://www.instagram.com/p/${match[1]}/embed/`;
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

export function InstagramSectionClient({ posts, firstHandle }: { posts: Post[]; firstHandle: string }) {
  const [active, setActive] = useState<Post | null>(null);

  return (
    <section className="bg-[#F9FAFB] border-t border-[#E5E7EB] px-6 lg:px-16 py-20 relative">
      <div className="max-w-[1380px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <InstagramIcon className="w-4 h-4 text-[#E1306C]" />
              <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest">Instagram</p>
            </div>
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-black text-[#111827] leading-[1.1]">
              See us in action.
            </h2>
          </div>
          <a
            href={`https://www.instagram.com/${firstHandle.replace(/^@/, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#6C55E8] hover:text-[#5A42D1] transition-colors whitespace-nowrap"
          >
            Follow on Instagram →
          </a>
        </div>

        {/* Grid + floating embed wrapper */}
        <div className="relative">
          {/* Cards grid */}
          <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 transition-all duration-300 ${active ? 'opacity-30 pointer-events-none' : ''}`}>
            {posts.map((post) => {
              const cleanHandle = post.handle.replace(/^@/, '');
              return (
                <button
                  key={post.id}
                  onClick={() => setActive(post)}
                  className="group relative block w-full overflow-hidden rounded-2xl bg-[#111827] aspect-[9/16] shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                  aria-label={post.title ?? `Instagram post by @${cleanHandle}`}
                >
                  {post.thumbnail_url ? (
                    <img
                      src={post.thumbnail_url}
                      alt={post.title ?? `Instagram post by @${cleanHandle}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCB045]">
                      <InstagramIcon className="w-10 h-10 text-white/60" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                      <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-lg bg-black/30 backdrop-blur-sm flex items-center justify-center">
                    <InstagramIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                  {post.title && (
                    <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-1 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <p className="text-white/60 text-[10px] font-medium">@{cleanHandle}</p>
                      <p className="text-white text-xs font-semibold mt-0.5 line-clamp-2">{post.title}</p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Floating embed — centered over grid */}
          {active && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="relative w-full max-w-xs">
                {/* Close */}
                <button
                  onClick={() => setActive(null)}
                  className="absolute -top-10 right-0 flex items-center gap-1.5 text-sm font-semibold text-[#6B7280] hover:text-[#111827] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Close
                </button>

                <div className="aspect-[9/16] w-full rounded-2xl overflow-hidden shadow-2xl bg-white border border-[#E5E7EB]">
                  {getEmbedUrl(active.post_url) ? (
                    <iframe
                      src={getEmbedUrl(active.post_url)!}
                      className="w-full h-full border-0"
                      allowFullScreen
                      scrolling="no"
                      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                      title={active.title ?? `Instagram post by @${active.handle}`}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#F9FAFB]">
                      <p className="text-sm text-[#6B7280]">Could not embed this post.</p>
                      <a href={active.post_url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#6C55E8]">
                        Open on Instagram →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
