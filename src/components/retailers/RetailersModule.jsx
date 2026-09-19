import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  Phone, 
  MessageSquare, 
  MapPin, 
  DollarSign, 
  ShoppingBag, 
  Receipt, 
  Clock, 
  ExternalLink,
  Edit2,
  TrendingUp,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, CurrencyInput } from '../ui/Input';
import { Table, TableRow, TableCell } from '../ui/Table';
import { Modal, Drawer } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { formatUSD, formatDate, getStatusBadge } from '../../lib/formatters';

export const RetailersModule = ({
  retailers = [],
  orders = [],
  installments = [],
  onSaveRetailer,
  onDeleteRetailer,
  onNavigate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRetailer, setSelectedRetailer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const handleDelete = async (retailer, e) => {
    e?.stopPropagation();
    if (!onDeleteRetailer || !retailer?.id) return;
    if (window.confirm(`Tem certeza que deseja excluir o lojista "${retailer.store_name}"? Esta ação removerá o cadastro do lojista.`)) {
      try {
        await onDeleteRetailer(retailer.id);
        if (selectedRetailer?.id === retailer.id) {
          setSelectedRetailer(null);
        }
        if (isModalOpen && formData.id === retailer.id) {
          setIsModalOpen(false);
        }
      } catch (err) {
        alert(err.message || 'Erro ao excluir lojista.');
      }
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    id: '',
    store_name: '',
    contact_name: '',
    phone: '',
    whatsapp: '',
    document: '',
    city: '',
    state: '',
    address: '',
    notes: ''
  });

  const filteredRetailers = retailers.filter(r => {
    const q = searchQuery.toLowerCase().trim();
    return !q || 
      (r.store_name && r.store_name.toLowerCase().includes(q)) || 
      (r.contact_name && r.contact_name.toLowerCase().includes(q)) || 
      (r.city && r.city.toLowerCase().includes(q));
  });

  const handleOpenCreate = () => {
    setFormData({
      id: '',
      store_name: '',
      contact_name: '',
      phone: '',
      whatsapp: '',
      document: '',
      city: '',
      state: '',
      address: '',
      notes: ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (retailer, e) => {
    e?.stopPropagation();
    setFormData({
      id: retailer.id || '',
      store_name: retailer.store_name || '',
      contact_name: retailer.contact_name || '',
      phone: retailer.phone || '',
      whatsapp: retailer.whatsapp || '',
      document: retailer.document || '',
      city: retailer.city || '',
      state: retailer.state || '',
      address: retailer.address || '',
      notes: retailer.notes || '',
      commission_per_unit_usd: retailer.commission_per_unit_usd ?? 0
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.store_name || !formData.store_name.trim()) {
      setFormError('Informe o nome da loja.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      await onSaveRetailer({
        ...formData,
        store_name: formData.store_name.trim()
      });
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err.message || 'Erro ao salvar lojista.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cálculos de perfil do lojista selecionado
  const retailerOrders = selectedRetailer ? orders.filter(o => o.retailer_id === selectedRetailer.id) : [];
  const retailerInstallments = selectedRetailer ? installments.filter(i => i.retailer_id === selectedRetailer.id) : [];

  const totalBoughtUSD = retailerOrders.reduce((sum, o) => sum + (o.total_amount_usd || 0), 0);
  const totalPaidUSD = retailerOrders.reduce((sum, o) => sum + (o.paid_amount_usd || 0), 0);
  const balanceDueUSD = Math.max(0, totalBoughtUSD - totalPaidUSD);
  const totalUnitsBought = retailerOrders.reduce((sum, o) => sum + (o.items?.reduce((isum, item) => isum + item.quantity, 0) || 0), 0);
  const totalCommissionsUSD = retailerOrders.reduce((sum, o) => sum + (o.total_commission_usd || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Lojistas & Clientes Atacadistas</h2>
          <p className="text-xs text-slate-500 dark:text-slate-300">Gestão de parceiros comerciais, contatos e histórico de compras</p>
        </div>

        <div className="flex items-center gap-3">
          <Input
            placeholder="Buscar por loja, responsável, cidade..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
          <Button variant="primary" size="sm" onClick={handleOpenCreate} icon={Plus}>
            Novo Lojista
          </Button>
        </div>
      </div>

      {/* Retailers Cards Grid / Empty State */}
      {filteredRetailers.length === 0 ? (
        <EmptyState
          title="Nenhum lojista cadastrado"
          description="Cadastre seus parceiros comerciais e lojistas atacadistas para gerenciar vendas e pedidos."
          actionText="Cadastrar Primeiro Lojista"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRetailers.map((r) => {
          const rOrders = orders.filter(o => o.retailer_id === r.id);
          const rBought = rOrders.reduce((sum, o) => sum + (o.total_amount_usd || 0), 0);
          const rPaid = rOrders.reduce((sum, o) => sum + (o.paid_amount_usd || 0), 0);
          const rBalance = Math.max(0, rBought - rPaid);

          return (
            <Card
              key={r.id}
              className="p-6 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              onClick={() => setSelectedRetailer(r)}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{r.store_name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                      {[r.contact_name, [r.city, r.state].filter(Boolean).join('/')].filter(Boolean).join(' • ') || 'Sem contato adicional'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] dark:backdrop-blur-sm border border-slate-100 dark:border-white/10 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-300 font-medium">Total Comprado:</span>
                    <p className="font-extrabold text-slate-900 dark:text-white mt-0.5">{formatUSD(rBought)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-300 font-medium">Saldo Devedor:</span>
                    <p className="font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {formatUSD(rBalance)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
                {r.whatsapp ? (
                  <a
                    href={`https://wa.me/${(r.whatsapp || '').replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:underline"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-slate-700 dark:text-cyan-300" /> WhatsApp
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 select-none">
                    <Phone className="w-3.5 h-3.5 opacity-40" /> Sem WhatsApp
                  </span>
                )}

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleOpenEdit(r, e)}
                    icon={Edit2}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDelete(r, e)}
                    icon={Trash2}
                    className="text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    Excluir
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        </div>
      )}

      {/* 360° Retailer Profile Drawer */}
      {selectedRetailer && (
        <Drawer
          isOpen={Boolean(selectedRetailer)}
          onClose={() => setSelectedRetailer(null)}
          title={selectedRetailer.store_name}
          subtitle={
            [
              selectedRetailer.contact_name ? `Responsável: ${selectedRetailer.contact_name}` : null,
              selectedRetailer.whatsapp ? `WhatsApp: ${selectedRetailer.whatsapp}` : null
            ].filter(Boolean).join(' | ') || 'Sem contatos adicionais'
          }
          width="max-w-xl"
        >
          <div className="space-y-6">
            {/* Financial Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-[#EDE8F8] dark:bg-purple-950/40 dark:border dark:border-purple-500/20 text-slate-900 dark:text-purple-200">
                <span className="text-xs font-semibold opacity-75">Total Comprado</span>
                <p className="text-xl font-bold mt-1 text-slate-900 dark:text-white">{formatUSD(totalBoughtUSD)}</p>
                <p className="text-[11px] opacity-60 mt-0.5">{totalUnitsBought} aparelhos comprados</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF3D6] dark:bg-amber-950/40 dark:border dark:border-amber-500/20 text-slate-900 dark:text-amber-200">
                <span className="text-xs font-semibold opacity-75">Saldo Devedor</span>
                <p className="text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">{formatUSD(balanceDueUSD)}</p>
                <p className="text-[11px] opacity-60 mt-0.5">{retailerInstallments.filter(i => i.status !== 'Pago').length} parcelas abertas</p>
              </div>
            </div>

            {/* Direct Contact & Details */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] dark:backdrop-blur-sm border border-slate-200 dark:border-white/10 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Documento / CNPJ:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedRetailer.document || 'Não informado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cidade / Endereço:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {([selectedRetailer.city, selectedRetailer.state].filter(Boolean).join('/') + (selectedRetailer.address ? ` — ${selectedRetailer.address}` : '')) || 'Não informado'}
                </span>
              </div>
              {selectedRetailer.notes && (
                <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-white/5">
                  <span className="text-slate-400">Observações:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 max-w-[65%] text-right">{selectedRetailer.notes}</span>
                </div>
              )}
            </div>

            {/* Orders Tab */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4" /> Histórico de Pedidos ({retailerOrders.length})
              </h4>
              <Table headers={['Pedido', 'Total USD', 'Status', 'Data']}>
                {retailerOrders.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-bold">{o.order_number}</TableCell>
                    <TableCell className="font-bold">{formatUSD(o.total_amount_usd)}</TableCell>
                    <TableCell>
                      <Badge size="sm">{o.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">{formatDate(o.created_at)}</TableCell>
                  </TableRow>
                ))}
              </Table>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(selectedRetailer)}
                icon={Trash2}
                className="text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                Excluir Lojista
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={(e) => {
                  const target = selectedRetailer;
                  setSelectedRetailer(null);
                  handleOpenEdit(target, e);
                }}
                icon={Edit2}
              >
                Editar Dados
              </Button>
            </div>
          </div>
        </Drawer>
      )}

      {/* Modal de Criação / Edição de Lojista */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formData.id ? 'Editar Lojista' : 'Cadastrar Novo Lojista'}
        subtitle="Informações cadastrais do parceiro comercial"
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nome da Loja *"
              value={formData.store_name}
              onChange={(e) => {
                setFormData({ ...formData, store_name: e.target.value });
                if (formError) setFormError('');
              }}
              placeholder="Ex: iStore Prime SP"
            />
            <Input
              label="Responsável / Contato"
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              placeholder="Ex: Rodrigo Mendes"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="WhatsApp (com DDD)"
              value={formData.whatsapp}
              onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
              placeholder="Ex: 5511988881111"
            />
            <Input
              label="Documento (CNPJ / CPF)"
              value={formData.document}
              onChange={(e) => setFormData({ ...formData, document: e.target.value })}
              placeholder="Ex: 00.000.000/0001-00"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Cidade"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Ex: São Paulo"
            />
            <Input
              label="UF (Estado)"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              placeholder="Ex: SP"
            />
          </div>

          <Input
            label="Endereço Completo"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Ex: Rua Santa Ifigênia, 450 - Sala 12"
          />

          <Input
            label="Observações Internas"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Condições de pagamento combinadas, preferências..."
          />

          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/10">
            {formData.id ? (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => handleDelete(formData)}
                icon={Trash2}
                className="text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                disabled={isSubmitting}
              >
                Excluir Lojista
              </Button>
            ) : <div />}
            <div className="flex gap-3">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Salvar Lojista'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
