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
  TrendingUp
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, CurrencyInput } from '../ui/Input';
import { Table, TableRow, TableCell } from '../ui/Table';
import { Modal, Drawer } from '../ui/Modal';
import { formatUSD, formatDate, getStatusBadge } from '../../lib/formatters';

export const RetailersModule = ({
  retailers = [],
  orders = [],
  installments = [],
  onSaveRetailer,
  onNavigate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRetailer, setSelectedRetailer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      r.store_name.toLowerCase().includes(q) || 
      r.contact_name.toLowerCase().includes(q) || 
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
    setIsModalOpen(true);
  };

  const handleOpenEdit = (retailer, e) => {
    e?.stopPropagation();
    setFormData({
      ...retailer
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.store_name.trim() || !formData.whatsapp.trim()) {
      alert('Preencha o Nome da Loja e o WhatsApp.');
      return;
    }

    onSaveRetailer({
      ...formData
    });
    setIsModalOpen(false);
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
          <p className="text-xs text-slate-500 dark:text-slate-300">Gestão de limites, comissões por peça e histórico de pedidos</p>
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

      {/* Retailers Cards Grid */}
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
                    <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">{r.contact_name} • {r.city}/{r.state || 'BR'}</p>
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
                <a
                  href={`https://wa.me/${(r.whatsapp || '').replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:underline"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-slate-700 dark:text-cyan-300" /> WhatsApp
                </a>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleOpenEdit(r, e)}
                  icon={Edit2}
                >
                  Editar
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 360° Retailer Profile Drawer */}
      {selectedRetailer && (
        <Drawer
          isOpen={Boolean(selectedRetailer)}
          onClose={() => setSelectedRetailer(null)}
          title={selectedRetailer.store_name}
          subtitle={`Responsável: ${selectedRetailer.contact_name} | WhatsApp: ${selectedRetailer.whatsapp}`}
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
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedRetailer.city}/{selectedRetailer.state} — {selectedRetailer.address || ''}</span>
              </div>
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nome da Loja"
              required
              value={formData.store_name}
              onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
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
              required
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

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Salvar Lojista
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
