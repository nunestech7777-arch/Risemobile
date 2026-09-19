import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Award, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  DollarSign, 
  Users, 
  Building2, 
  Calendar, 
  Receipt, 
  FileText, 
  ExternalLink, 
  ChevronRight, 
  ChevronDown, 
  Check, 
  Filter, 
  X,
  Key,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  Copy,
  Lock,
  Eye,
  EyeOff,
  Send,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, Select, CurrencyInput } from '../ui/Input';
import { Table, TableRow, TableCell } from '../ui/Table';
import { IPhoneIcon } from '../common/IPhoneIcon';
import { Modal, Drawer } from '../ui/Modal';
import { formatUSD, formatDate } from '../../lib/formatters';

export const CommissionsModule = ({
  orders = [],
  retailers = [],
  retailerReferrals = [],
  commissionAgents = [],
  onSaveReferral,
  onDeleteReferral,
  onSaveCommissionAgent,
  onSetCommissionAgentStatus,
  onResetCommissionAgentPassword,
  onDeleteCommissionAgent
}) => {
  // Sub-Tab Switcher: 'referrals' | 'agent_logins'
  const [activeSubTab, setActiveSubTab] = useState('referrals');

  const [searchQuery, setSearchQuery] = useState('');
  const [agentsSearchQuery, setAgentsSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('all'); // all, today, yesterday, this_week, this_month, last_month, last_7_days, last_20_days, last_30_days, this_year, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const periodDropdownRef = useRef(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReferral, setEditingReferral] = useState(null);
  const [detailReferral, setDetailReferral] = useState(null);

  // Estados dos Modais de Gestão de Acessos
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [agentFormData, setAgentFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    is_active: true
  });
  const [agentFormError, setAgentFormError] = useState('');

  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [selectedAgentForReset, setSelectedAgentForReset] = useState(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedAgentForShare, setSelectedAgentForShare] = useState(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Form State da Indicação
  const [formData, setFormData] = useState({
    referrer_name: '',
    agent_id: '',
    retailer_id: '',
    commission_per_unit_usd: '1.00',
    notes: '',
    status: 'Ativo'
  });

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target)) {
        setIsPeriodDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lista de Opções Rápidas de Período
  const PERIOD_OPTIONS = [
    { id: 'all', label: 'Todo o período' },
    { id: 'today', label: 'Hoje' },
    { id: 'yesterday', label: 'Ontem' },
    { id: 'this_week', label: 'Esta semana' },
    { id: 'this_month', label: 'Este mês' },
    { id: 'last_month', label: 'Mês anterior' },
    { id: 'last_7_days', label: 'Últimos 7 dias' },
    { id: 'last_20_days', label: 'Últimos 20 dias' },
    { id: 'last_30_days', label: 'Últimos 30 dias' },
    { id: 'this_year', label: 'Este ano' },
    { id: 'custom', label: 'Período personalizado' }
  ];

  // Função auxiliar de normalização de data local (YYYY-MM-DD)
  const getLocalDateString = (d) => {
    if (!d || isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Label formatado do período ativo
  const activePeriodLabel = useMemo(() => {
    if (selectedPeriod === 'custom') {
      if (customStartDate && customEndDate) {
        const startFormatted = customStartDate.split('-').reverse().join('/');
        const endFormatted = customEndDate.split('-').reverse().join('/');
        return `${startFormatted} — ${endFormatted}`;
      }
      if (customStartDate) return `A partir de ${customStartDate.split('-').reverse().join('/')}`;
      if (customEndDate) return `Até ${customEndDate.split('-').reverse().join('/')}`;
      return 'Período personalizado';
    }
    const opt = PERIOD_OPTIONS.find(o => o.id === selectedPeriod);
    return opt ? opt.label : 'Todo o período';
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Função para testar se um pedido finalizado está no período selecionado
  const isOrderInPeriod = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = getLocalDateString(today);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    return (order) => {
      // Regra 1: Somente vendas com status "Finalizado" são válidas
      if (order.status !== 'Finalizado') return false;

      // Regra 2: "all" inclui todo o histórico
      if (selectedPeriod === 'all') return true;

      const orderDate = new Date(order.finalized_at || order.created_at);
      if (isNaN(orderDate.getTime())) return false;
      const orderDateStr = getLocalDateString(orderDate);

      if (selectedPeriod === 'custom') {
        if (customStartDate && orderDateStr < customStartDate) return false;
        if (customEndDate && orderDateStr > customEndDate) return false;
        return true;
      }

      switch (selectedPeriod) {
        case 'today':
          return orderDateStr === todayStr;

        case 'yesterday':
          return orderDateStr === yesterdayStr;

        case 'this_week': {
          const firstDayOfWeek = new Date(today);
          firstDayOfWeek.setDate(today.getDate() - today.getDay());
          return orderDate >= firstDayOfWeek;
        }

        case 'this_month': {
          const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return orderDate >= firstDayOfMonth;
        }

        case 'last_month': {
          const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
          return orderDate >= firstDayOfLastMonth && orderDate <= lastDayOfLastMonth;
        }

        case 'last_7_days': {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(today.getDate() - 7);
          return orderDate >= sevenDaysAgo;
        }

        case 'last_20_days': {
          const twentyDaysAgo = new Date(today);
          twentyDaysAgo.setDate(today.getDate() - 20);
          return orderDate >= twentyDaysAgo;
        }

        case 'last_30_days': {
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(today.getDate() - 30);
          return orderDate >= thirtyDaysAgo;
        }

        case 'this_year': {
          const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
          return orderDate >= firstDayOfYear;
        }

        default:
          return true;
      }
    };
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Vendas Concluídas Válidas no Período Selecionado
  const validCompletedOrders = useMemo(() => {
    return orders.filter(isOrderInPeriod);
  }, [orders, isOrderInPeriod]);

  // Cálculo de Peças e Comissão por Indicação de Lojista com Suporte a Snapshot
  const calculatedReferrals = useMemo(() => {
    return retailerReferrals.map(ref => {
      // Vendas válidas deste lojista no período filtrado
      const matchingOrders = validCompletedOrders.filter(o => o.retailer_id === ref.retailer_id);

      // Soma das peças e cálculo de comissão com base no valor snapshot da venda ou taxa atual
      let totalPieces = 0;
      let totalCommission = 0;
      const salesBreakdown = [];

      matchingOrders.forEach(order => {
        const units = order.allocated_devices?.length || 0;
        // Snapshot histórico preserva o valor aplicado no momento da venda
        const rateApplied = typeof order.commission_per_unit_snapshot === 'number'
          ? order.commission_per_unit_snapshot
          : (parseFloat(ref.commission_per_unit_usd) || 0);

        const orderCommission = units * rateApplied;
        totalPieces += units;
        totalCommission += orderCommission;

        salesBreakdown.push({
          order_id: order.id,
          order_number: order.order_number,
          units,
          rateApplied,
          orderCommission,
          finalized_at: order.finalized_at || order.created_at
        });
      });

      // Ordena extrato da mais recente para a mais antiga
      salesBreakdown.sort((a, b) => new Date(b.finalized_at) - new Date(a.finalized_at));

      return {
        ...ref,
        unitsCount: totalPieces,
        totalCommission,
        currentRate: parseFloat(ref.commission_per_unit_usd) || 0,
        salesBreakdown
      };
    });
  }, [retailerReferrals, validCompletedOrders]);

  // Filtro de Busca combinado com os dados calculados do período
  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return calculatedReferrals;
    return calculatedReferrals.filter(r => 
      r.referrer_name?.toLowerCase().includes(q) ||
      r.retailer_name?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q)
    );
  }, [calculatedReferrals, searchQuery]);

  // Totais dos Indicadores do Topo (Respeitam o Período Selecionado)
  const totalCommissionedPieces = useMemo(() => {
    return calculatedReferrals.reduce((sum, r) => sum + r.unitsCount, 0);
  }, [calculatedReferrals]);

  const totalCommissionsAmount = useMemo(() => {
    return calculatedReferrals.reduce((sum, r) => sum + r.totalCommission, 0);
  }, [calculatedReferrals]);

  const activeReferralsCount = useMemo(() => {
    return retailerReferrals.filter(r => r.status === 'Ativo').length;
  }, [retailerReferrals]);

  // Lojistas disponíveis para cadastro (impede dois indicadores ativos para o mesmo lojista)
  const availableRetailersForCreate = useMemo(() => {
    const usedRetailerIds = new Set(
      retailerReferrals
        .filter(r => r.status === 'Ativo' && (!editingReferral || r.id !== editingReferral.id))
        .map(r => r.retailer_id)
    );
    return retailers.filter(ret => !usedRetailerIds.has(ret.id));
  }, [retailers, retailerReferrals, editingReferral]);

  // Sincroniza dados do extrato aberto com as alterações de período
  const activeDetailData = useMemo(() => {
    if (!detailReferral) return null;
    return calculatedReferrals.find(r => r.id === detailReferral.id) || detailReferral;
  }, [detailReferral, calculatedReferrals]);

  // Abrir Modal para Cadastro
  const handleOpenCreateModal = () => {
    setEditingReferral(null);
    setFormData({
      referrer_name: '',
      agent_id: '',
      retailer_id: availableRetailersForCreate[0]?.id || '',
      commission_per_unit_usd: '1.00',
      notes: '',
      status: 'Ativo'
    });
    setIsModalOpen(true);
  };

  // Vincular um lojista a um comissionado já cadastrado (abre o formulário de indicação
  // com o indicador preenchido e travado no comissionado escolhido)
  const handleOpenLinkRetailerModal = (agent, e) => {
    e?.stopPropagation();
    setEditingReferral(null);
    setFormData({
      referrer_name: agent.name,
      agent_id: agent.id,
      retailer_id: availableRetailersForCreate[0]?.id || '',
      commission_per_unit_usd: '1.00',
      notes: '',
      status: 'Ativo'
    });
    setIsModalOpen(true);
  };

  // Abrir Modal para Edição
  const handleOpenEditModal = (ref, e) => {
    e?.stopPropagation();
    setEditingReferral(ref);
    setFormData({
      referrer_name: ref.referrer_name || '',
      agent_id: ref.agent_id || '',
      retailer_id: ref.retailer_id || '',
      commission_per_unit_usd: String(ref.commission_per_unit_usd || '1.00'),
      notes: ref.notes || '',
      status: ref.status || 'Ativo'
    });
    setIsModalOpen(true);
  };

  // Salvar Indicação
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.referrer_name.trim()) {
      alert('Informe o nome da pessoa que indicou.');
      return;
    }
    if (!formData.retailer_id) {
      alert('Selecione o lojista indicado.');
      return;
    }

    const ret = retailers.find(r => r.id === formData.retailer_id);

    const payload = {
      ...(editingReferral ? { id: editingReferral.id } : {}),
      referrer_name: formData.referrer_name.trim(),
      ...(formData.agent_id ? { agent_id: formData.agent_id } : {}),
      retailer_id: formData.retailer_id,
      retailer_name: ret?.store_name || formData.retailer_name || 'Lojista',
      commission_per_unit_usd: parseFloat(formData.commission_per_unit_usd) || 0,
      notes: formData.notes.trim(),
      status: formData.status
    };

    try {
      if (onSaveReferral) {
        await onSaveReferral(payload);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert(err.message || 'Não foi possível salvar a indicação.');
    }
  };

  const handleDelete = async (id, name, e) => {
    e?.stopPropagation();
    if (window.confirm(`Deseja remover a indicação de ${name}?`)) {
      if (onDeleteReferral) {
        await onDeleteReferral(id);
      }
      if (detailReferral?.id === id) {
        setDetailReferral(null);
      }
    }
  };

  // Helper para buscar o login do comissionado vinculado ao nome do indicador
  const getAgentForReferrer = (name) => {
    if (!name) return null;
    return commissionAgents.find(a => a.name?.toLowerCase() === name.trim().toLowerCase());
  };

  const generateRandomPassword = () => {
    const chars = '23456789abcdefghjkmnpqrstuvwxyz';
    let pass = 'Rise@';
    for (let i = 0; i < 4; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  // Handlers para Gestão de Acessos
  const handleOpenCreateAgentModal = () => {
    setEditingAgent(null);
    setAgentFormData({
      name: '',
      email: '',
      phone: '',
      password: generateRandomPassword(),
      is_active: true
    });
    setAgentFormError('');
    setIsAgentModalOpen(true);
  };

  const handleOpenCreateAgentFromReferral = (referrerName, e) => {
    e?.stopPropagation();
    setEditingAgent(null);
    const cleanName = (referrerName || '').trim();
    const suggestedEmail = cleanName
      ? `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@parceiro.com`
      : '';
    setAgentFormData({
      name: cleanName,
      email: suggestedEmail,
      phone: '',
      password: generateRandomPassword(),
      is_active: true
    });
    setAgentFormError('');
    setIsAgentModalOpen(true);
  };

  const handleOpenEditAgentModal = (agent, e) => {
    e?.stopPropagation();
    setEditingAgent(agent);
    setAgentFormData({
      name: agent.name || '',
      email: agent.email || '',
      phone: agent.phone || '',
      password: agent.password || '',
      is_active: agent.is_active !== undefined ? agent.is_active : true
    });
    setAgentFormError('');
    setIsAgentModalOpen(true);
  };

  const handleSaveAgentSubmit = async (e) => {
    e.preventDefault();
    if (!agentFormData.name.trim()) {
      setAgentFormError('Informe o nome do comissionado.');
      return;
    }
    if (!agentFormData.email.trim()) {
      setAgentFormError('Informe o e-mail de acesso do comissionado.');
      return;
    }
    if (!editingAgent && !agentFormData.password) {
      setAgentFormError('Defina uma senha inicial de acesso.');
      return;
    }

    try {
      if (onSaveCommissionAgent) {
        const saved = await onSaveCommissionAgent({
          ...(editingAgent ? { id: editingAgent.id } : {}),
          ...agentFormData
        });
        setIsAgentModalOpen(false);
        // Abre o modal de compartilhamento com a credencial criada
        if (!editingAgent && saved) {
          setSelectedAgentForShare(saved);
          setIsShareModalOpen(true);
          setCopiedNotification(false);
        }
      }
    } catch (err) {
      setAgentFormError(err.message || 'Erro ao salvar acesso do comissionado.');
    }
  };

  const handleToggleAgentStatus = async (agent, e) => {
    e?.stopPropagation();
    if (onSetCommissionAgentStatus) {
      try {
        await onSetCommissionAgentStatus(agent.id, !agent.is_active);
      } catch (err) {
        alert(err.message || 'Erro ao alterar status do comissionado.');
      }
    }
  };

  const handleOpenResetPasswordModal = (agent, e) => {
    e?.stopPropagation();
    setSelectedAgentForReset(agent);
    setNewPasswordValue(generateRandomPassword());
    setResetPasswordError('');
    setIsResetPasswordModalOpen(true);
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPasswordValue || newPasswordValue.length < 4) {
      setResetPasswordError('A nova senha deve ter no mínimo 4 caracteres.');
      return;
    }
    if (onResetCommissionAgentPassword && selectedAgentForReset) {
      try {
        const resetResult = await onResetCommissionAgentPassword(selectedAgentForReset.id, newPasswordValue);
        setIsResetPasswordModalOpen(false);
        // Modo Supabase: a senha é redefinida por e-mail (nada para compartilhar)
        if (resetResult?.mode === 'email') {
          alert(resetResult.message);
          return;
        }
        // Abrir compartilhamento
        setSelectedAgentForShare({
          ...selectedAgentForReset,
          password: newPasswordValue
        });
        setIsShareModalOpen(true);
        setCopiedNotification(false);
      } catch (err) {
        setResetPasswordError(err.message || 'Erro ao redefinir senha.');
      }
    }
  };

  const handleDeleteAgent = async (agent, e) => {
    e?.stopPropagation();
    if (window.confirm(`Deseja realmente excluir o acesso de "${agent.name}"? O parceiro não conseguirá mais logar no portal.`)) {
      if (onDeleteCommissionAgent) {
        try {
          await onDeleteCommissionAgent(agent.id);
        } catch (err) {
          alert(err.message || 'Erro ao excluir comissionado.');
        }
      }
    }
  };

  const handleShareCredentials = (agent, e) => {
    e?.stopPropagation();
    setSelectedAgentForShare(agent);
    setIsShareModalOpen(true);
    setCopiedNotification(false);
  };

  const copyShareTextToClipboard = () => {
    if (!selectedAgentForShare) return;
    const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}` : 'https://app.risemobile.com';
    const text = `🌟 *Acesso ao Portal do Comissionado — RiseMobile*\n\nOlá *${selectedAgentForShare.name}*, seu acesso exclusivo para acompanhar suas comissões já está ativo!\n\n🔗 *Link de Acesso:* ${portalUrl}\n👤 *E-mail:* ${selectedAgentForShare.email}\n🔑 *Senha:* ${selectedAgentForShare.password || '(a senha definida no cadastro; se esquecer, use "Esqueci minha senha" na tela de login)'}\n\nNo portal você acompanha em tempo real suas peças vendidas, valores e extrato das lojas indicadas. Qualquer dúvida estamos à disposição!`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 3000);
    });
  };

  // Filtragem dos Comissionados na Sub-aba
  const filteredAgents = useMemo(() => {
    const q = agentsSearchQuery.toLowerCase().trim();
    if (!q) return commissionAgents;
    return commissionAgents.filter(a => 
      a.name?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q) ||
      a.phone?.toLowerCase().includes(q)
    );
  }, [commissionAgents, agentsSearchQuery]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header & Sub-Tabs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Award className="w-6 h-6 text-slate-800 dark:text-slate-200" />
            Comissões & Parceiros Indicadores
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
            Gestão de comissões por indicação de lojistas e controle de acessos ao portal exclusivo
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sub-tab Pill Switcher */}
          <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 text-xs">
            <button
              onClick={() => setActiveSubTab('referrals')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                activeSubTab === 'referrals'
                  ? 'bg-white dark:bg-[#111827] text-slate-950 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Indicações & Lojistas</span>
            </button>
            <button
              onClick={() => setActiveSubTab('agent_logins')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                activeSubTab === 'agent_logins'
                  ? 'bg-white dark:bg-[#111827] text-slate-950 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Logins dos Comissionados</span>
              {commissionAgents.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-extrabold">
                  {commissionAgents.length}
                </span>
              )}
            </button>
          </div>

          {activeSubTab === 'referrals' ? (
            <Button 
              variant="primary" 
              size="md" 
              onClick={handleOpenCreateModal} 
              icon={Plus}
            >
              Nova Indicação
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenCreateAgentModal}
              icon={UserPlus}
            >
              Novo Login
            </Button>
          )}
        </div>
      </div>

      {/* ABA 1: INDICAÇÕES & LOJISTAS */}
      {activeSubTab === 'referrals' && (
        <div className="space-y-6">
          {/* 3 Indicadores Minimalistas do Topo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Peças Comissionadas */}
            <div className="p-5 rounded-none bg-white dark:bg-[#0B1220]/90 dark:backdrop-blur-xl border border-slate-200/80 dark:border-white/12 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Total de Peças Comissionadas
                </span>
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-cyan-300">
                  <IPhoneIcon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
                {totalCommissionedPieces} <span className="text-sm font-semibold text-slate-500 dark:text-slate-300">un.</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-300 mt-1">
                <span>Período:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{activePeriodLabel}</span>
              </div>
            </div>

            {/* Total de Comissões */}
            <div className="p-5 rounded-none bg-white dark:bg-[#0B1220]/90 dark:backdrop-blur-xl border border-slate-200/80 dark:border-white/12 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Total de Comissões
                </span>
                <div className="p-2 rounded-lg bg-[#111418] text-white dark:bg-emerald-500/20 dark:text-emerald-300 dark:border dark:border-emerald-500/30">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
                {formatUSD(totalCommissionsAmount)}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-300 mt-1">
                <span>Período:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{activePeriodLabel}</span>
              </div>
            </div>

            {/* Indicações Ativas */}
            <div className="p-5 rounded-none bg-white dark:bg-[#0B1220]/90 dark:backdrop-blur-xl border border-slate-200/80 dark:border-white/12 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Indicações Ativas
                </span>
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-purple-300">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
                {activeReferralsCount} <span className="text-sm font-semibold text-slate-500 dark:text-slate-300">lojistas</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-300 mt-1">Relações indicador $\rightarrow$ lojista</span>
            </div>
          </div>

          {/* Tabela Principal de Indicações de Lojistas */}
          <Card className="p-6">
            {/* Cabeçalho da Tabela com Filtro de Data e Busca Integrados */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Indicações e Comissões Acumuladas
                </h3>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-xs text-slate-400">
                    Fórmula: Peças Compradas pelo Lojista × Valor Fixo por Peça
                  </p>
                  <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-md">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {activePeriodLabel}
                  </span>
                </div>
              </div>

              {/* Controles de Ação: Filtro de Período + Campo de Busca */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Popover / Dropdown do Filtro de Período */}
                <div className="relative" ref={periodDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
                    className={`flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all w-full sm:w-auto ${
                      selectedPeriod !== 'all'
                        ? 'bg-[#111418] text-white border-[#111418] dark:bg-white/20 dark:border-white/30 dark:text-white shadow-xs'
                        : 'bg-white dark:bg-white/[0.05] text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 shadow-xs'
                    }`}
                    title="Filtrar compras por período"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 opacity-80" />
                      <span className="truncate max-w-[160px]">{activePeriodLabel}</span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform ${isPeriodDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Menu Flutuante de Períodos */}
                  {isPeriodDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-[#0D121D]/95 dark:backdrop-blur-2xl border border-slate-200 dark:border-white/15 rounded-2xl shadow-modal dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-50 p-3 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-white/10">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Filtrar Comissões por Período
                        </span>
                        {selectedPeriod !== 'all' && (
                          <button
                            onClick={() => {
                              setSelectedPeriod('all');
                              setCustomStartDate('');
                              setCustomEndDate('');
                            }}
                            className="text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                          >
                            Limpar Filtro
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                        {PERIOD_OPTIONS.filter(o => o.id !== 'custom').map(opt => {
                          const isSelected = selectedPeriod === opt.id;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => {
                                setSelectedPeriod(opt.id);
                                setIsPeriodDropdownOpen(false);
                              }}
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                                isSelected
                                  ? 'bg-[#111418] text-white dark:bg-white/20 dark:text-white font-bold'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08]'
                              }`}
                            >
                              <span className="truncate">{opt.label}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 ml-1 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>

                      {/* Opção de Período Personalizado */}
                      <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-white/10">
                        <button
                          onClick={() => setSelectedPeriod('custom')}
                          className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            selectedPeriod === 'custom'
                              ? 'bg-[#111418] text-white dark:bg-white/20 dark:text-white'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08]'
                          }`}
                        >
                          <span>Período personalizado</span>
                          {selectedPeriod === 'custom' && <Check className="w-3.5 h-3.5 ml-1 shrink-0" />}
                        </button>

                        {selectedPeriod === 'custom' && (
                          <div className="mt-2.5 space-y-2 p-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/10 animate-in fade-in">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 block mb-1">
                                  Data inicial
                                </label>
                                <input
                                  type="date"
                                  value={customStartDate}
                                  onChange={(e) => setCustomStartDate(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 block mb-1">
                                  Data final
                                </label>
                                <input
                                  type="date"
                                  value={customEndDate}
                                  onChange={(e) => setCustomEndDate(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => setIsPeriodDropdownOpen(false)}
                                className="px-3 py-1 bg-[#111418] text-white dark:bg-white dark:text-slate-900 text-[11px] font-bold rounded-lg hover:opacity-90 transition-opacity"
                              >
                                Aplicar Período
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Campo de Busca por Indicador ou Lojista */}
                <div className="w-full sm:w-64">
                  <Input
                    icon={Search}
                    placeholder="Buscar indicador ou lojista..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {filteredList.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                Nenhuma indicação encontrada para a busca "{searchQuery}" no período selecionado.
              </div>
            ) : (
              <Table headers={['Pessoa que Indicou', 'Lojista Indicado', 'Comissão / Peça', 'Peças Compradas', 'Comissão Acumulada', 'Acesso ao Portal', 'Status', 'Ações']}>
                {filteredList.map((ref) => {
                  const agent = getAgentForReferrer(ref.referrer_name);

                  return (
                    <TableRow 
                      key={ref.id} 
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      onClick={() => setDetailReferral(ref)}
                    >
                      <TableCell className="font-extrabold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#111418] text-white flex items-center justify-center text-xs font-black shrink-0">
                            {ref.referrer_name.charAt(0)}
                          </div>
                          <div>
                            <div>{ref.referrer_name}</div>
                            {ref.notes && <div className="text-[11px] text-slate-400 font-normal">{ref.notes}</div>}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="font-semibold text-slate-800 dark:text-slate-200">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {ref.retailer_name}
                        </span>
                      </TableCell>

                      <TableCell className="font-bold text-slate-800 dark:text-slate-200">
                        {formatUSD(ref.currentRate)} <span className="text-xs font-normal text-slate-400">/ peça</span>
                      </TableCell>

                      <TableCell className="font-bold text-slate-600 dark:text-slate-300">
                        {ref.unitsCount} un.
                      </TableCell>

                      <TableCell className="font-black text-slate-900 dark:text-white text-base">
                        {formatUSD(ref.totalCommission)}
                      </TableCell>

                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {agent ? (
                          <div className="flex items-center gap-1.5">
                            <Badge variant={agent.is_active ? 'success' : 'neutral'} size="sm">
                              {agent.is_active ? 'Acesso Ativo' : 'Acesso Inativo'}
                            </Badge>
                            <button
                              onClick={(e) => handleShareCredentials(agent, e)}
                              title="Copiar dados de acesso para WhatsApp"
                              className="p-1 rounded-lg text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-white/[0.08]"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={(e) => handleOpenCreateAgentFromReferral(ref.referrer_name, e)}
                            icon={UserPlus}
                            className="text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-[11px]"
                          >
                            Criar Acesso
                          </Button>
                        )}
                      </TableCell>

                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${
                          ref.status === 'Ativo'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}>
                          {ref.status}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailReferral(ref)}
                            icon={FileText}
                            title="Ver compras e extrato do período"
                          >
                            Extrato
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleOpenEditModal(ref, e)}
                            icon={Edit3}
                            title="Editar indicação"
                          >
                            Editar
                          </Button>
                          <button
                            onClick={(e) => handleDelete(ref.id, ref.referrer_name, e)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title="Excluir indicação"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* ABA 2: GESTÃO DE ACESSOS DOS COMISSIONADOS */}
      {activeSubTab === 'agent_logins' && (
        <div className="space-y-6">
          {/* 3 Métricas dos Acessos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-none bg-white dark:bg-[#0B1220]/90 dark:backdrop-blur-xl border border-slate-200/80 dark:border-white/12 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Total de Comissionados
                </span>
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-cyan-300">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
                {commissionAgents.length} <span className="text-sm font-semibold text-slate-500">usuários</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1">Parceiros com login próprio no portal</span>
            </div>

            <div className="p-5 rounded-none bg-white dark:bg-[#0B1220]/90 dark:backdrop-blur-xl border border-slate-200/80 dark:border-white/12 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Acessos Ativos
                </span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-3">
                {commissionAgents.filter(a => a.is_active).length}
              </div>
              <span className="text-[11px] text-slate-400 mt-1">Acesso liberado ao painel em tempo real</span>
            </div>

            <div className="p-5 rounded-none bg-white dark:bg-[#0B1220]/90 dark:backdrop-blur-xl border border-slate-200/80 dark:border-white/12 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Acessos Inativos
                </span>
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/[0.08] text-slate-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-500 dark:text-slate-400 mt-3">
                {commissionAgents.filter(a => !a.is_active).length}
              </div>
              <span className="text-[11px] text-slate-400 mt-1">Acesso bloqueado temporariamente</span>
            </div>
          </div>

          {/* Tabela de Gestão de Comissionados */}
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Controle de Logins dos Comissionados
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Crie acessos, ative/desative contas e envie credenciais prontas para o WhatsApp
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou e-mail..."
                    value={agentsSearchQuery}
                    onChange={(e) => setAgentsSearchQuery(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 border border-slate-200 dark:border-white/10 text-xs rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-1 focus:ring-purple-500 w-64"
                  />
                </div>
              </div>
            </div>

            {filteredAgents.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                Nenhum comissionado cadastrado. Clique em "Novo Login" acima para liberar acesso a um parceiro.
              </div>
            ) : (
              <Table headers={['Comissionado / Indicador', 'E-mail de Login', 'Lojas Vinculadas', 'Status do Acesso', 'Ações']}>
                {filteredAgents.map((agent) => {
                  const linkedStores = retailerReferrals.filter(r => 
                    r.agent_id === agent.id || 
                    (r.referrer_name && r.referrer_name.trim().toLowerCase() === agent.name.trim().toLowerCase())
                  );

                  return (
                    <TableRow key={agent.id}>
                      <TableCell className="font-bold text-slate-900 dark:text-white">
                        <div>
                          <span>{agent.name}</span>
                          {agent.phone && (
                            <p className="text-[11px] text-slate-400 font-normal">{agent.phone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300">
                        {agent.email}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-semibold text-purple-600 dark:text-purple-400">
                          {linkedStores.length} {linkedStores.length === 1 ? 'loja' : 'lojas'}
                        </span>
                        {linkedStores.length > 0 && (
                          <p className="text-[11px] text-slate-400 font-normal max-w-[220px] truncate" title={linkedStores.map(r => r.retailer_name).join(', ')}>
                            {linkedStores.map(r => r.retailer_name).filter(Boolean).join(', ')}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={agent.is_active ? 'success' : 'neutral'} size="sm">
                            {agent.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                          <button
                            onClick={(e) => handleToggleAgentStatus(agent, e)}
                            className={`text-[11px] font-bold underline transition-colors ${
                              agent.is_active 
                                ? 'text-amber-600 hover:text-amber-800 dark:text-amber-400' 
                                : 'text-emerald-600 hover:text-emerald-800 dark:text-emerald-400'
                            }`}
                          >
                            {agent.is_active ? 'Desativar' : 'Ativar'}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={(e) => handleOpenLinkRetailerModal(agent, e)}
                            icon={Building2}
                            title="Vincular um lojista a este comissionado"
                            className="text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          >
                            Vincular Lojista
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={(e) => handleShareCredentials(agent, e)}
                            icon={Send}
                            title="Enviar credenciais por WhatsApp"
                            className="text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                          >
                            Credenciais
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={(e) => handleOpenResetPasswordModal(agent, e)}
                            icon={Key}
                            title="Redefinir senha"
                          >
                            Senha
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={(e) => handleOpenEditAgentModal(agent, e)}
                            icon={Edit3}
                            title="Editar dados"
                          />
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={(e) => handleDeleteAgent(agent, e)}
                            icon={Trash2}
                            className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            title="Excluir acesso"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* Drawer de Detalhes da Indicação & Extrato de Compras Filtrado por Período */}
      {activeDetailData && (
        <Drawer
          isOpen={Boolean(activeDetailData)}
          onClose={() => setDetailReferral(null)}
          title={`Extrato: ${activeDetailData.referrer_name}`}
          subtitle={`Indicação do Lojista: ${activeDetailData.retailer_name}`}
          width="max-w-xl"
        >
          <div className="space-y-6">
            {/* Header Card do Extrato */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400">Pessoa que Indicou:</span>
                  <div className="text-lg font-black text-slate-900 dark:text-white">{activeDetailData.referrer_name}</div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Comissão Cadastrada:</span>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {formatUSD(activeDetailData.currentRate)}/peça
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">Lojista Vinculado:</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{activeDetailData.retailer_name}</div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400">Comissão no Período:</span>
                  <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                    {formatUSD(activeDetailData.totalCommission)}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/40 dark:border-slate-700/40 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Período do Extrato:
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700/50 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                  {activePeriodLabel}
                </span>
              </div>
            </div>

            {/* Lista das Vendas Válidas que Geraram Comissão no Período */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4" /> Vendas Concluídas no Período ({activeDetailData.salesBreakdown?.length || 0})
                </h4>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {activeDetailData.unitsCount} peças comissionadas
                </span>
              </div>

              {!activeDetailData.salesBreakdown || activeDetailData.salesBreakdown.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
                  Nenhuma compra finalizada registrada para este lojista no período <span className="font-semibold text-slate-600 dark:text-slate-300">"{activePeriodLabel}"</span>.
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <Table headers={['Venda / Pedido', 'Peças', 'Taxa Aplicada', 'Comissão Gerada', 'Data']}>
                    {activeDetailData.salesBreakdown.map((sale, idx) => (
                      <TableRow key={sale.order_id || idx}>
                        <TableCell className="font-bold text-slate-900 dark:text-white">
                          {sale.order_number}
                        </TableCell>
                        <TableCell className="font-bold text-slate-600 dark:text-slate-300">
                          {sale.units} un.
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          ${sale.rateApplied.toFixed(2)}/un
                        </TableCell>
                        <TableCell className="font-black text-emerald-600 dark:text-emerald-400">
                          {formatUSD(sale.orderCommission)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">
                          {formatDate(sale.finalized_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </Table>
                </div>
              )}
            </div>
          </div>
        </Drawer>
      )}

      {/* Modal 1: Cadastro / Edição de Indicação de Lojista */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingReferral ? 'Editar Indicação de Lojista' : 'Cadastrar Indicação de Lojista'}
        subtitle="Defina o indicador, selecione o lojista e a comissão fixa por aparelho comprado."
        size="md"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <Input
            label="Pessoa que Indicou (Indicador)"
            placeholder="Ex: Pedro, João Silva..."
            value={formData.referrer_name}
            onChange={(e) => setFormData({ ...formData, referrer_name: e.target.value })}
            disabled={Boolean(formData.agent_id) && !editingReferral}
            required
          />

          <div>
            <Select
              label="Lojista Indicado"
              value={formData.retailer_id}
              onChange={(e) => setFormData({ ...formData, retailer_id: e.target.value })}
              options={
                editingReferral
                  ? [{ value: editingReferral.retailer_id, label: editingReferral.retailer_name }, ...availableRetailersForCreate.map(r => ({ value: r.id, label: r.store_name }))]
                  : availableRetailersForCreate.map(r => ({ value: r.id, label: `${r.store_name} (${r.city}/${r.state || 'BR'})` }))
              }
              required
            />
            {availableRetailersForCreate.length === 0 && !editingReferral && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                Todos os lojistas cadastrados já possuem uma indicação ativa.
              </p>
            )}
          </div>

          <CurrencyInput
            label="Comissão Fixa por Peça Comprada (USD)"
            value={formData.commission_per_unit_usd}
            onChange={(val) => setFormData({ ...formData, commission_per_unit_usd: val })}
            currency="USD"
          />

          <Input
            label="Observações / Termos"
            placeholder="Ex: Contrato de indicação comercial SP..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!formData.retailer_id}
            >
              {editingReferral ? 'Salvar Alterações' : 'Cadastrar Indicação'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Cadastro / Edição de Acesso de Comissionado */}
      <Modal
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
        title={editingAgent ? 'Editar Acesso do Comissionado' : 'Criar Login para Comissionado'}
        subtitle="Defina o e-mail de acesso e senha para o portal exclusivo do parceiro."
        size="md"
      >
        <form onSubmit={handleSaveAgentSubmit} className="space-y-4">
          <Input
            label="Nome do Comissionado / Indicador *"
            placeholder="Ex: Carlos Mendes"
            value={agentFormData.name}
            onChange={(e) => {
              setAgentFormData({ ...agentFormData, name: e.target.value });
              if (agentFormError) setAgentFormError('');
            }}
            required
          />

          <Input
            label="E-mail de Acesso (Login) *"
            type="email"
            placeholder="Ex: carlos@parceiro.com"
            value={agentFormData.email}
            onChange={(e) => {
              setAgentFormData({ ...agentFormData, email: e.target.value });
              if (agentFormError) setAgentFormError('');
            }}
            required
          />

          <Input
            label="WhatsApp / Telefone"
            placeholder="Ex: 5511999998888"
            value={agentFormData.phone}
            onChange={(e) => setAgentFormData({ ...agentFormData, phone: e.target.value })}
          />

          {!editingAgent && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Senha Inicial de Acesso *
                </label>
                <button
                  type="button"
                  onClick={() => setAgentFormData({ ...agentFormData, password: generateRandomPassword() })}
                  className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Gerar Nova Senha
                </button>
              </div>
              <Input
                type="text"
                placeholder="Ex: Rise@8374"
                value={agentFormData.password}
                onChange={(e) => setAgentFormData({ ...agentFormData, password: e.target.value })}
                required
              />
            </div>
          )}

          {agentFormError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{agentFormError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsAgentModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
            >
              {editingAgent ? 'Salvar Alterações' : 'Criar Login & Gerar Credenciais'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 3: Redefinir Senha do Comissionado */}
      <Modal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
        title="Redefinir Senha do Comissionado"
        subtitle={`Defina uma nova senha de acesso para ${selectedAgentForReset?.name}.`}
        size="sm"
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs">
            <span className="text-slate-400">Usuário:</span>
            <div className="font-bold text-slate-900 dark:text-white mt-0.5">{selectedAgentForReset?.name}</div>
            <div className="font-mono text-slate-500 text-[11px]">{selectedAgentForReset?.email}</div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Nova Senha
              </label>
              <button
                type="button"
                onClick={() => setNewPasswordValue(generateRandomPassword())}
                className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Gerar Aleatória
              </button>
            </div>
            <Input
              type="text"
              placeholder="Digite a nova senha..."
              value={newPasswordValue}
              onChange={(e) => {
                setNewPasswordValue(e.target.value);
                if (resetPasswordError) setResetPasswordError('');
              }}
              required
            />
          </div>

          {resetPasswordError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs">
              {resetPasswordError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsResetPasswordModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
            >
              Salvar Nova Senha
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 4: Compartilhar Credenciais por WhatsApp / Copiar */}
      <Modal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="Credenciais de Acesso do Parceiro"
        subtitle="Copie o texto pronto para enviar ao comissionado por WhatsApp ou e-mail."
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/10 font-mono text-xs whitespace-pre-line text-slate-800 dark:text-slate-200 leading-relaxed select-all">
            {`🌟 *Acesso ao Portal do Comissionado — RiseMobile*\n\nOlá *${selectedAgentForShare?.name}*, seu acesso exclusivo para acompanhar suas comissões já está ativo!\n\n🔗 *Link de Acesso:* ${typeof window !== 'undefined' ? window.location.origin : 'https://app.risemobile.com'}\n👤 *E-mail:* ${selectedAgentForShare?.email}\n🔑 *Senha:* ${selectedAgentForShare?.password || '(a senha definida no cadastro; se esquecer, use "Esqueci minha senha" na tela de login)'}\n\nNo portal você acompanha em tempo real suas peças vendidas, valores e extrato das lojas indicadas. Qualquer dúvida estamos à disposição!`}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              {copiedNotification ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Texto copiado para a área de transferência!
                </span>
              ) : (
                'Clique abaixo para copiar o texto formatado'
              )}
            </span>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => setIsShareModalOpen(false)}
              >
                Fechar
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={copyShareTextToClipboard}
                icon={Copy}
              >
                {copiedNotification ? 'Copiado!' : 'Copiar para WhatsApp'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CommissionsModule;
