import React, { useState, useEffect } from 'react';
import { ContentPost, ContentStatus } from '../types';
import { 
  generateContentWithAi, 
  getContentPosts, 
  createContentPost, 
  updateContentPostStatus, 
  deleteContentPost 
} from '../services/content';
import { 
  Sparkles, 
  FileText, 
  Copy, 
  Check, 
  Trash2, 
  RefreshCw, 
  Send, 
  Layers, 
  Tag, 
  Target, 
  ImageIcon, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Megaphone,
  Building2,
  Wand2
} from 'lucide-react';

export const ContentGenerator: React.FC = () => {
  // Input Form State
  const [niche, setNiche] = useState<string>('Roofing & Exterior Services');
  const [goal, setGoal] = useState<string>('Lead Generation & Free Inspection Quotes');
  const [targetAudience, setTargetAudience] = useState<string>('Homeowners aged 30-65 needing roof replacement or storm repairs');
  const [tone, setTone] = useState<string>('High-converting & Direct');
  const [customPrompt, setCustomPrompt] = useState<string>('');

  // Generation & History State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [activePost, setActivePost] = useState<ContentPost | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load history from Supabase on mount
  useEffect(() => {
    loadContentHistory();
  }, []);

  const loadContentHistory = async () => {
    setIsLoadingHistory(true);
    setError(null);
    try {
      const data = await getContentPosts();
      if (data) {
        setPosts(data);
        if (data.length > 0 && !activePost) {
          setActivePost(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load content posts:', err);
      setError('Could not fetch posts from Supabase database.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Handle AI Post Generation
  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const generated = await generateContentWithAi({
        niche,
        goal,
        targetAudience,
        tone,
        customPrompt
      });

      const newPost: ContentPost = {
        id: `post-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...generated,
        createdAt: new Date().toISOString()
      };

      // Save to Supabase
      const saved = await createContentPost(newPost);
      if (!saved) {
        console.warn('Note: Post displayed locally, Supabase table sync fallback engaged.');
      }

      setPosts(prev => [newPost, ...prev]);
      setActivePost(newPost);
    } catch (err: any) {
      console.error('Content generation error:', err);
      setError('Failed to generate post. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Status Change Handler
  const handleStatusChange = async (postId: string, newStatus: ContentStatus) => {
    const updatedPosts = posts.map(p => p.id === postId ? { ...p, status: newStatus } : p);
    setPosts(updatedPosts);
    if (activePost?.id === postId) {
      setActivePost({ ...activePost, status: newStatus });
    }
    await updateContentPostStatus(postId, newStatus);
  };

  // Delete Handler
  const handleDelete = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this generated post?')) return;
    const remaining = posts.filter(p => p.id !== postId);
    setPosts(remaining);
    if (activePost?.id === postId) {
      setActivePost(remaining.length > 0 ? remaining[0] : null);
    }
    await deleteContentPost(postId);
  };

  // Copy Full Post or Specific Field
  const handleCopy = (text: string, id: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedId(null);
      setCopiedField(null);
    }, 2000);
  };

  const filteredPosts = posts.filter(p => statusFilter === 'All' || p.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900/40 via-indigo-900/40 to-slate-900 border border-purple-800/40 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-700/50 text-purple-300 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" /> AI Marketing Engine • Content Agent v1
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Facebook Content Generator
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Generate high-converting Facebook post campaigns tailored for roofing and home service companies. Powered by Gemini AI models and integrated with Supabase storage.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-slate-950/80 border border-slate-800 px-3.5 py-2 rounded-xl text-right">
              <span className="block text-[10px] text-slate-400 uppercase font-mono tracking-wider">Posts Saved</span>
              <span className="text-lg font-black text-purple-400">{posts.length}</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 px-3.5 py-2 rounded-xl text-right">
              <span className="block text-[10px] text-slate-400 uppercase font-mono tracking-wider">Approved</span>
              <span className="text-lg font-black text-emerald-400">
                {posts.filter(p => p.status === 'Approved' || p.status === 'Published').length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/60 border border-rose-800 text-rose-200 px-4 py-3 rounded-xl text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            {error}
          </span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white font-bold">Dismiss</button>
        </div>
      )}

      {/* Main Grid: Form Left, Preview & History Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Generator Configuration Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-purple-400" />
                Campaign Generator Parameters
              </h2>
              <span className="text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded">
                Gemini 3.6 Flash
              </span>
            </div>

            {/* Niche Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" /> Industry / Niche
              </label>
              <select
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
              >
                <option value="Roofing & Exterior Services">Roofing & Exterior Services</option>
                <option value="Solar Installation & Energy">Solar Installation & Energy</option>
                <option value="HVAC & Home Climate Control">HVAC & Home Climate Control</option>
                <option value="Plumbing & Emergency Repairs">Plumbing & Emergency Repairs</option>
                <option value="B2B Marketing & Growth Agency">B2B Marketing & Growth Agency</option>
                <option value="General Contracting & Remodeling">General Contracting & Remodeling</option>
              </select>
            </div>

            {/* Campaign Goal */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-amber-400" /> Campaign Goal
              </label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
              >
                <option value="Lead Generation & Free Inspection Quotes">Lead Generation & Free Inspection Quotes</option>
                <option value="Customer Case Study & Before/After Proof">Customer Case Study & Before/After Proof</option>
                <option value="Storm Damage Urgent Response">Storm Damage Urgent Response</option>
                <option value="Seasonal Discount & Financing Promo">Seasonal Discount & Financing Promo</option>
                <option value="Educational Roof Maintenance Tips">Educational Roof Maintenance Tips</option>
              </select>
            </div>

            {/* Target Audience */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-rose-400" /> Target Audience
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. Homeowners aged 30-65"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Tone Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-cyan-400" /> Brand Tone
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'High-converting & Direct',
                  'Professional & Trustworthy',
                  'Urgent & Offer-Driven',
                  'Storytelling & Local'
                ].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border text-left truncate transition-all ${
                      tone === t
                        ? 'bg-purple-950 border-purple-500 text-purple-200 font-semibold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Guidelines */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Additional Instructions (Optional)
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. Highlight 0% APR financing for 12 months, mention GAF certified installers..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors resize-none"
              />
            </div>

            {/* Action Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-200" />
                  Crafting Campaign with Gemini AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
                  Generate Facebook Post Campaign
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Display Active Post Details & History List */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Active Generated Post Card */}
          {activePost ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl relative">
              
              {/* Header Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-purple-400" />
                    {activePost.niche}
                  </span>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                    activePost.status === 'Published' 
                      ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300' 
                      : activePost.status === 'Approved'
                      ? 'bg-blue-950/80 border-blue-700/60 text-blue-300'
                      : 'bg-amber-950/80 border-amber-700/60 text-amber-300'
                  }`}>
                    {activePost.status}
                  </span>
                </div>

                {/* Status Toggle & Quick Actions */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-950 rounded-xl p-1 border border-slate-800 text-xs">
                    {(['Draft', 'Approved', 'Published'] as ContentStatus[]).map((st) => (
                      <button
                        key={st}
                        onClick={() => handleStatusChange(activePost.id, st)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          activePost.status === st
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleDelete(activePost.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg border border-slate-800 transition-colors"
                    title="Delete Post"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Headline */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>CAMPAIGN HEADLINE</span>
                  <button
                    onClick={() => handleCopy(activePost.headline, activePost.id, 'headline')}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    {copiedId === activePost.id && copiedField === 'headline' ? (
                      <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Copied</span>
                    ) : (
                      <span className="flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</span>
                    )}
                  </button>
                </div>
                <h3 className="text-base font-extrabold text-white leading-snug p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                  {activePost.headline}
                </h3>
              </div>

              {/* Post Body */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>FACEBOOK POST COPY</span>
                  <button
                    onClick={() => handleCopy(activePost.post, activePost.id, 'post')}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    {copiedId === activePost.id && copiedField === 'post' ? (
                      <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Copied</span>
                    ) : (
                      <span className="flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</span>
                    )}
                  </button>
                </div>
                <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {activePost.post}
                </div>
              </div>

              {/* Call to Action */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 font-mono block">CALL TO ACTION (CTA)</span>
                <div className="p-3 bg-purple-950/40 border border-purple-800/50 rounded-xl text-xs font-bold text-purple-200 flex items-center justify-between">
                  <span>{activePost.cta}</span>
                  <button
                    onClick={() => handleCopy(activePost.cta, activePost.id, 'cta')}
                    className="text-purple-300 hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Target Audience & Image Prompt */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 block flex items-center gap-1">
                    <Target className="w-3 h-3 text-rose-400" /> TARGET AUDIENCE
                  </span>
                  <p className="text-xs text-slate-300 font-medium">{activePost.targetAudience}</p>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <ImageIcon className="w-3 h-3 text-cyan-400" /> AI IMAGE PROMPT
                    </span>
                    <button
                      onClick={() => handleCopy(activePost.imagePrompt, activePost.id, 'imgPrompt')}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-300 italic line-clamp-2">{activePost.imagePrompt}</p>
                </div>
              </div>

              {/* Hashtags */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 font-mono block">HASHTAGS</span>
                <div className="flex flex-wrap gap-1.5">
                  {activePost.hashtags.map((tag, idx) => (
                    <span key={idx} className="text-[11px] font-mono text-indigo-300 bg-indigo-950/60 border border-indigo-800/50 px-2.5 py-1 rounded-lg">
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              </div>

              {/* Copy Entire Campaign Package */}
              <div className="pt-2 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => {
                    const fullText = `${activePost.headline}\n\n${activePost.post}\n\n${activePost.cta}\n\n${activePost.hashtags.join(' ')}`;
                    handleCopy(fullText, activePost.id, 'full');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {copiedId === activePost.id && copiedField === 'full' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      Full Post Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Entire Post Package
                    </>
                  )}
                </button>
              </div>

            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-950 border border-purple-800 text-purple-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">No Active Post Selected</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Fill out the campaign parameters on the left and click "Generate Facebook Post Campaign" to create your first post.
              </p>
            </div>
          )}

          {/* Content History List Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Content Database History ({filteredPosts.length})
              </h3>

              {/* Status Filter Tabs */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                {['All', 'Draft', 'Approved', 'Published'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      statusFilter === f
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {isLoadingHistory ? (
              <div className="text-center py-8 text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                Loading saved posts from Supabase...
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No saved content matching filter "{statusFilter}".
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {filteredPosts.map((post) => {
                  const isSelected = activePost?.id === post.id;
                  return (
                    <div
                      key={post.id}
                      onClick={() => setActivePost(post)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected 
                          ? 'bg-purple-950/40 border-purple-600/80 shadow-md' 
                          : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="space-y-1 truncate pr-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            post.status === 'Published' 
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                              : post.status === 'Approved'
                              ? 'bg-blue-950 text-blue-300 border-blue-800'
                              : 'bg-amber-950 text-amber-300 border-amber-800'
                          }`}>
                            {post.status}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-white truncate">{post.headline}</h4>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(post.id);
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
