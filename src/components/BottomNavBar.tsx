import React from 'react';
import { Home, UserCheck, PlusCircle, MessageSquare, BarChart3, Bot } from 'lucide-react';
import { motion } from 'motion/react';

interface BottomNavBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenIntake: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  setActiveTab,
  onOpenIntake
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Feed', icon: Home },
    { id: 'team_leader', label: 'AI Team', icon: Bot },
    { id: 'create', label: 'Create', icon: PlusCircle, isAction: true },
    { id: 'digital_products', label: 'Products', icon: MessageSquare },
    { id: 'bi', label: 'BI', icon: BarChart3 },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800 px-4 py-2 flex items-center justify-around shadow-2xl md:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        if (item.isAction) {
          return (
            <button
              key={item.id}
              onClick={onOpenIntake}
              className="flex flex-col items-center justify-center p-2 rounded-2xl bg-gradient-to-tr from-rose-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 transform hover:scale-105 transition-all"
            >
              <PlusCircle className="w-6 h-6" />
            </button>
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center p-2 transition-all relative ${
              isActive ? 'text-indigo-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] mt-1">{item.label}</span>

            {isActive && (
              <motion.div
                layoutId="bottomNavIndicator"
                className="absolute -top-1 w-8 h-1 bg-gradient-to-r from-rose-500 to-indigo-500 rounded-full"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
