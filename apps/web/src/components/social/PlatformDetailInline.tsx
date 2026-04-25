import { useState } from "react";
import { Loader2, Eye, Heart, MessageCircle, Repeat2, BarChart3, X, Clock, ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { type ConnectedPlatform } from "@/hooks/social/useSocialConnections";
import { usePlatformData } from "@/hooks/social/usePlatformData";
import { DynamicIcon } from "./DynamicIcon";
import { formatNumber } from "./utils";
import { PostingHeatmap } from "./PostingHeatmap";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const POSTS_PER_PAGE = 3;

export function PlatformDetailInline({ platform, onClose }: { platform: ConnectedPlatform; onClose: () => void }) {
  const { profile, posts, isLoading } = usePlatformData(platform.id, platform.connected);
  const [postPage, setPostPage] = useState(0);

  const postChartData = (posts ?? [])
    .filter(p => (p.likes ?? 0) > 0 || (p.comments ?? 0) > 0 || (p.shares ?? 0) > 0)
    .slice(0, 10)
    .map((p, i) => ({
      name: p.content?.slice(0, 15) || `Post ${i + 1}`,
      likes: p.likes ?? 0,
      comments: p.comments ?? 0,
      shares: p.shares ?? 0,
      total: (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0),
    }))
    .reverse();

  const hasPostChart = postChartData.length > 2;

  // Stats summary
  const totalLikes = (posts ?? []).reduce((s, p) => s + (p.likes ?? 0), 0);
  const totalComments = (posts ?? []).reduce((s, p) => s + (p.comments ?? 0), 0);
  const totalShares = (posts ?? []).reduce((s, p) => s + (p.shares ?? 0), 0);
  const hasStats = totalLikes > 0 || totalComments > 0 || totalShares > 0;

  return (
    <div
      className="rounded-2xl border-2 bg-foreground/[0.02] overflow-hidden animate-in slide-in-from-top-2 fade-in duration-300"
      style={{ borderColor: `${platform.color}25` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{ background: `linear-gradient(135deg, ${platform.color}08, transparent)` }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: `${platform.color}15` }}>
            <DynamicIcon name={platform.icon} className="w-5 h-5" color={platform.color} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{platform.name}</h3>
            {platform.email && <p className="text-[11px] text-muted-foreground">{platform.email}</p>}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-foreground/10" onClick={onClose}>
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      <div className="border-t border-foreground/5" />

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Carregando dados...</span>
        </div>
      ) : (
        <div className="p-5 space-y-5">
          {/* Quick Stats Bar */}
          {hasStats && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Curtidas", value: totalLikes, icon: <Heart className="w-3.5 h-3.5" />, color: "#ef4444" },
                { label: "Comentários", value: totalComments, icon: <MessageCircle className="w-3.5 h-3.5" />, color: "#3b82f6" },
                { label: "Compartilhamentos", value: totalShares, icon: <Repeat2 className="w-3.5 h-3.5" />, color: "#22c55e" },
              ].map(stat => (
                <div key={stat.label} className="flex items-center gap-2.5 p-3 rounded-xl bg-foreground/[0.03] border border-foreground/5">
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${stat.color}15` }}>
                    <span style={{ color: stat.color }}>{stat.icon}</span>
                  </div>
                  <div>
                    <p className="text-base font-bold text-foreground tabular-nums">{formatNumber(stat.value)}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Grid: profile left, chart right */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            {/* Left column */}
            <div className="space-y-4 flex flex-col">
              {profile && (
                <div className="p-4 rounded-xl bg-foreground/[0.03] border border-foreground/5 space-y-3">
                  <div className="flex items-center gap-3">
                    {profile.avatarUrl ? (
                      <img src={profile.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover" style={{ boxShadow: `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${platform.color}30` }} />
                    ) : (
                      <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: `${platform.color}15` }}>
                        <DynamicIcon name={platform.icon} className="w-6 h-6" color={platform.color} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {profile.name && <p className="text-sm font-semibold text-foreground truncate">{profile.name}</p>}
                      {profile.username && <p className="text-xs text-muted-foreground">@{profile.username}</p>}
                    </div>
                    {profile.followers != null && profile.followers > 0 && (
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold text-foreground tabular-nums">{formatNumber(profile.followers)}</p>
                        <p className="text-[10px] text-muted-foreground">seguidores</p>
                      </div>
                    )}
                  </div>
                  {profile.bio && <p className="text-xs text-muted-foreground leading-relaxed border-t border-foreground/5 pt-3">{profile.bio}</p>}
                </div>
              )}

              {/* Posts list */}
              {(posts ?? []).length > 0 && (() => {
                const allPosts = posts ?? [];
                const totalPages = Math.ceil(allPosts.length / POSTS_PER_PAGE);
                const paginatedPosts = allPosts.slice(postPage * POSTS_PER_PAGE, (postPage + 1) * POSTS_PER_PAGE);

                return (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-3 h-3" /> Posts Recentes
                      </h4>
                      {totalPages > 1 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setPostPage(p => Math.max(0, p - 1))}
                            disabled={postPage === 0}
                            className="p-1 rounded-md hover:bg-foreground/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {postPage + 1}/{totalPages}
                          </span>
                          <button
                            onClick={() => setPostPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={postPage >= totalPages - 1}
                            className="p-1 rounded-md hover:bg-foreground/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2.5 flex-1">
                      {paginatedPosts.map((post) => (
                        <div key={post.id} className="rounded-xl bg-foreground/[0.03] border border-foreground/5 hover:bg-foreground/[0.05] transition-colors duration-200 overflow-hidden">
                          {post.mediaUrl && (
                            <div className="w-full h-36 overflow-hidden">
                              <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                            </div>
                          )}
                          <div className="p-3 space-y-2">
                            {post.content && (
                              <p className="text-sm text-foreground line-clamp-3 leading-relaxed">{post.content}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {(post.likes ?? 0) > 0 && (
                                <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-400" />{formatNumber(post.likes!)}</span>
                              )}
                              {(post.comments ?? 0) > 0 && (
                                <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3 text-blue-400" />{formatNumber(post.comments!)}</span>
                              )}
                              {(post.shares ?? 0) > 0 && (
                                <span className="flex items-center gap-1"><Repeat2 className="w-3 h-3 text-green-400" />{formatNumber(post.shares!)}</span>
                              )}
                              {post.timestamp && (
                                <span className="ml-auto text-[10px] flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {new Date(post.timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Right column: charts */}
            <div className="space-y-4">
              {hasPostChart && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <BarChart3 className="w-3 h-3" /> Performance por Post
                  </h4>
                  <div className="p-4 rounded-xl bg-foreground/[0.03] border border-foreground/5">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={postChartData} barSize={14}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis dataKey="name" tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={40} />
                          <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '11px' }}
                            formatter={(value: number, name: string) => [formatNumber(value), name === 'likes' ? '❤️ Likes' : name === 'comments' ? '💬 Comentários' : '🔄 Compartilhamentos']}
                          />
                          <Bar dataKey="likes" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} opacity={0.8} />
                          <Bar dataKey="comments" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} opacity={0.8} />
                          <Bar dataKey="shares" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} opacity={0.8} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-center gap-5 mt-3 pt-3 border-t border-foreground/5">
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-red-500/80" /><span className="text-[10px] text-muted-foreground">Likes</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-blue-500/80" /><span className="text-[10px] text-muted-foreground">Comentários</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-green-500/80" /><span className="text-[10px] text-muted-foreground">Compartilhamentos</span></div>
                    </div>
                  </div>
                </div>
              )}

              {(posts ?? []).length > 3 && (
                <PostingHeatmap posts={posts ?? []} />
              )}
            </div>
          </div>

          {!profile && (posts ?? []).length === 0 && !isLoading && (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-foreground/[0.04] flex items-center justify-center mx-auto mb-3">
                <Eye className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nenhum dado disponível ainda</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Os dados aparecerão após a primeira sincronização.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
