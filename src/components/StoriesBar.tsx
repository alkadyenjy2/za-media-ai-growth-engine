import React, { useState } from 'react';
import { StoryItem } from '../types';
import { Flame, Clock, DollarSign, Sparkles, Bot, X, ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StoriesBarProps {
  stories: StoryItem[];
  onActionExecute?: (actionText: string) => void;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({ stories, onActionExecute }) => {
  const [activeStory, setActiveStory] = useState<StoryItem | null>(null);
  const [readStories, setReadStories] = useState<Set<string>>(new Set());
  const [actionDone, setActionDone] = useState<boolean>(false);

  const handleOpenStory = (story: StoryItem) => {
    setActiveStory(story);
    setActionDone(false);
    setReadStories(prev => new Set(prev).add(story.id));
  };

  const getCategoryIcon = (category: StoryItem['category']) => {
    switch (category) {
      case 'hot_lead': return <Flame className="w-3.5 h-3.5 text-rose-400" />;
      case 'followup': return <Clock className="w-3.5 h-3.5 text-amber-400" />;
      case 'revenue': return <DollarSign className="w-3.5 h-3.5 text-emerald-400" />;
      case 'content': return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
      case 'ai_insight': return <Bot className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Live AI Growth Stories
          </h2>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          Tap for real-time intel
        </span>
      </div>

      {/* Stories Carousel */}
      <div className="flex items-center gap-4 overflow-x-auto pb-2 pt-1 scrollbar-none scroll-smooth">
        {stories.map((story) => {
          const isRead = readStories.has(story.id);
          return (
            <motion.div
              key={story.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleOpenStory(story)}
              className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0 group"
            >
              <div 
                className={`relative p-[2.5px] rounded-full transition-all duration-300 ${
                  isRead 
                    ? 'bg-slate-800' 
                    : 'bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 shadow-lg shadow-rose-500/20 group-hover:shadow-indigo-500/30'
                }`}
              >
                <div className="bg-slate-950 p-[2px] rounded-full">
                  <img 
                    src={story.avatarUrl} 
                    alt={story.title} 
                    className="w-14 h-14 rounded-full object-cover group-hover:brightness-110 transition-all"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-slate-900 border border-slate-700 p-1 rounded-full shadow-md">
                  {getCategoryIcon(story.category)}
                </div>
              </div>
              <div className="text-center w-20">
                <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-white">
                  {story.title}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {story.subtitle}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Fullscreen / Popover Story Viewer */}
      <AnimatePresence>
        {activeStory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden"
            >
              {/* Story Top Progress Bar */}
              <div className="w-full bg-slate-800 h-1 rounded-full mb-4 overflow-hidden">
                <motion.div 
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 6, ease: 'linear' }}
                  className="bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500 h-full rounded-full"
                />
              </div>

              {/* Story Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative p-[2px] bg-gradient-to-tr from-amber-500 to-rose-500 rounded-full">
                    <img 
                      src={activeStory.avatarUrl} 
                      alt={activeStory.title} 
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      {activeStory.title}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {activeStory.badge}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">{activeStory.subtitle}</p>
                  </div>
                </div>

                <button 
                  onClick={() => setActiveStory(null)}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800/60 rounded-full hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Story Main Content Card */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 my-4 space-y-4 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    AI Growth Briefing
                  </span>
                  {activeStory.content.metrics && (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-full">
                      {activeStory.content.metrics}
                    </span>
                  )}
                </div>

                <h4 className="text-base font-bold text-white leading-snug">
                  {activeStory.content.headline}
                </h4>

                <div className="space-y-2 pt-2 border-t border-slate-800/60">
                  {activeStory.content.details.map((detail, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-indigo-400 mt-0.5">✦</span>
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    setActionDone(true);
                    if (onActionExecute) onActionExecute(activeStory.content.actionText);
                    setTimeout(() => setActiveStory(null), 1200);
                  }}
                  disabled={actionDone}
                  className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                    actionDone 
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gradient-to-r from-rose-600 via-indigo-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white shadow-indigo-500/25'
                  }`}
                >
                  {actionDone ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Executed via n8n Engine
                    </>
                  ) : (
                    <>
                      <span>{activeStory.content.actionText}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
