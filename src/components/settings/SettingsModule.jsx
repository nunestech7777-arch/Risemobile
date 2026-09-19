import React from 'react';
import { ResetDataCard } from './ResetDataCard';

export const SettingsModule = ({ onResetData }) => (
  <div className="space-y-6 animate-fade-in pb-12">
    <div>
      <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Configurações do Sistema</h2>
      <p className="text-xs text-slate-400">Ações administrativas da base de dados</p>
    </div>

    <ResetDataCard onResetData={onResetData} />
  </div>
);
