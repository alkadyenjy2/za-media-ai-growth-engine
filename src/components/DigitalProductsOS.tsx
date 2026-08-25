import React, { useState, useEffect } from 'react';
import { 
  Package, 
  ShoppingCart, 
  Key, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  Copy, 
  Search, 
  Plus, 
  ExternalLink,
  DollarSign,
  Layers,
  ArrowUpRight,
  RefreshCw,
  Eye
} from 'lucide-react';
import { 
  DigitalProduct, 
  DigitalOrder, 
  getDigitalProducts, 
  getDigitalOrders, 
  saveDigitalProduct, 
  createDigitalOrder, 
  generateLicenseKey 
} from '../services/digitalProducts';

export const DigitalProductsOS: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'orders' | 'simulator'>('catalog');
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [orders, setOrders] = useState<DigitalOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // New product form state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newProduct, setNewProduct] = useState<Partial<DigitalProduct>>({
    title: '',
    category: 'Automation Workflow',
    description: '',
    price: 199,
    deliverableType: 'n8n_json',
    licenseType: 'agency_unlimited',
    fileDownloadUrl: 'https://storage.zamedia.ai/downloads/custom-asset.json',
    features: ['Instant digital deliverable', 'Lifetime updates included', 'Commercial license']
  });

  // Simulator checkout form state
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [simCustomerName, setSimCustomerName] = useState<string>('Omar Khattab');
  const [simCustomerEmail, setSimCustomerEmail] = useState<string>('omar@growthventures.co');
  const [simPaymentMethod, setSimPaymentMethod] = useState<DigitalOrder['paymentMethod']>('Credit Card (Stripe)');
  const [simulatingCheckout, setSimulatingCheckout] = useState<boolean>(false);
  const [latestFulfillment, setLatestFulfillment] = useState<DigitalOrder | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prods, ords] = await Promise.all([
        getDigitalProducts(),
        getDigitalOrders()
      ]);
      setProducts(prods);
      setOrders(ords);
      if (prods.length > 0 && !selectedProductId) {
        setSelectedProductId(prods[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.title) return;

    const prod: DigitalProduct = {
      id: 'prod-' + Date.now(),
      title: newProduct.title,
      category: newProduct.category as any || 'Automation Workflow',
      description: newProduct.description || 'Turn-key digital growth asset.',
      price: Number(newProduct.price) || 99,
      deliverableType: newProduct.deliverableType as any || 'n8n_json',
      licenseType: newProduct.licenseType as any || 'single_user',
      fileDownloadUrl: newProduct.fileDownloadUrl || 'https://storage.zamedia.ai/downloads/asset.zip',
      salesCount: 0,
      rating: 5.0,
      active: true,
      features: newProduct.features || ['Turn-key deliverable'],
      createdAt: new Date().toISOString()
    };

    await saveDigitalProduct(prod);
    setIsAddModalOpen(false);
    loadData();
  };

  const handleSimulateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    setSimulatingCheckout(true);
    try {
      const newOrder = await createDigitalOrder({
        productId: product.id,
        productTitle: product.title,
        customerName: simCustomerName,
        customerEmail: simCustomerEmail,
        amount: product.price,
        status: 'paid',
        paymentMethod: simPaymentMethod,
        notes: 'Simulated Instant Checkout & License Fulfillment'
      });
      setLatestFulfillment(newOrder);
      await loadData();
    } finally {
      setSimulatingCheckout(false);
    }
  };

  const totalDigitalRevenue = orders
    .filter(o => o.status === 'paid')
    .reduce((sum, o) => sum + o.amount, 0);

  const filteredProducts = products.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOrders = orders.filter(o =>
    o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono text-[10px] font-bold uppercase">
                Digital Revenue Engine
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono text-[10px] font-bold">
                Instant License Fulfillment
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Package className="w-6 h-6 text-indigo-400" />
              Digital Products OS & Fulfillment Hub
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Manage turn-key automation packs, AI prompt systems, issue license keys, and track digital product revenue synced directly to Supabase.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl text-right">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Digital Gross Sales</span>
              <span className="text-lg font-black text-emerald-400">${totalDigitalRevenue.toLocaleString()}</span>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Sub-tabs Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800/80 text-xs">
          <button
            onClick={() => setActiveSubTab('catalog')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'catalog'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Products Catalog ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('orders')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'orders'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Orders & Licenses ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('simulator')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'simulator'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>Instant Checkout Simulator</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeSubTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products, categories, or keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <span className="text-xs text-slate-400 font-mono">{filteredProducts.length} Active Offers</span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-500 text-xs">Loading digital catalog...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 border border-dashed border-slate-800 rounded-2xl text-center space-y-3">
              <p className="text-slate-400 text-sm">No products found matching your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProducts.map((prod) => (
                <div 
                  key={prod.id} 
                  className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all group shadow-lg"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 text-[10px] font-bold font-mono uppercase">
                        {prod.category}
                      </span>
                      <span className="text-sm font-black text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2.5 py-0.5 rounded-lg">
                        ${prod.price}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-base leading-snug group-hover:text-indigo-300 transition-colors">
                      {prod.title}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {prod.description}
                    </p>

                    <div className="space-y-1.5 pt-2 border-t border-slate-800/70">
                      {prod.features.slice(0, 3).map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                    <div className="text-slate-400">
                      <span className="font-bold text-white">{prod.salesCount}</span> sales • <span className="text-amber-400 font-bold">★ {prod.rating}</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedProductId(prod.id);
                        setActiveSubTab('simulator');
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-lg font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>Simulate Buy</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search orders by customer, email, or order number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={loadData}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-4">Order #</th>
                    <th className="p-4">Customer & Product</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Payment & Status</th>
                    <th className="p-4">License Key</th>
                    <th className="p-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono font-bold text-indigo-400">
                        {ord.orderNumber}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-white">{ord.customerName}</div>
                        <div className="text-[11px] text-slate-400">{ord.customerEmail}</div>
                        <div className="text-[11px] text-indigo-300/80 mt-0.5">{ord.productTitle}</div>
                      </td>
                      <td className="p-4 font-bold text-emerald-400">
                        ${ord.amount.toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-[10px]">
                          {ord.status.toUpperCase()}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1">{ord.paymentMethod}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800 text-[11px] text-amber-300 select-all">
                            {ord.licenseKey}
                          </span>
                          <button
                            onClick={() => handleCopyKey(ord.licenseKey)}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                            title="Copy License Key"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {copiedKey === ord.licenseKey && (
                          <span className="text-[10px] text-emerald-400 block mt-0.5">Copied!</span>
                        )}
                      </td>
                      <td className="p-4 text-slate-400 text-[11px]">
                        {new Date(ord.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Checkout Simulator Form */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Simulate Digital Purchase
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Test the instant license generator, Supabase income logging, and fulfillment lifecycle.
              </p>
            </div>

            <form onSubmit={handleSimulateOrder} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Product</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} (${p.price})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Customer Full Name</label>
                <input
                  type="text"
                  required
                  value={simCustomerName}
                  onChange={(e) => setSimCustomerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Customer Email</label>
                <input
                  type="email"
                  required
                  value={simCustomerEmail}
                  onChange={(e) => setSimCustomerEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Payment Method</label>
                <select
                  value={simPaymentMethod}
                  onChange={(e) => setSimPaymentMethod(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Credit Card (Stripe)">Credit Card (Stripe)</option>
                  <option value="Crypto (USDT)">Crypto (USDT)</option>
                  <option value="Direct Bank Wire">Direct Bank Wire</option>
                  <option value="Manual Transfer">Manual Transfer</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={simulatingCheckout}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {simulatingCheckout ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing License & Supabase Sync...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Order & Issue License</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Instant Fulfillment Delivery Result */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-400" />
                  Instant License Delivery Voucher
                </h3>
                <span className="text-[10px] font-mono bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800">
                  Automated Webhook Output
                </span>
              </div>

              {latestFulfillment ? (
                <div className="space-y-4 bg-slate-950 border border-slate-800/80 rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">Order Reference</span>
                      <p className="font-mono font-bold text-emerald-400 text-sm">{latestFulfillment.orderNumber}</p>
                    </div>
                    <span className="px-3 py-1 bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-xs rounded-full">
                      ✓ FULFILLED & PERSISTED
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-900">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Customer</span>
                      <span className="font-semibold text-white">{latestFulfillment.customerName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Email</span>
                      <span className="font-semibold text-slate-300">{latestFulfillment.customerEmail}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Item Purchased</span>
                      <span className="font-semibold text-indigo-300">{latestFulfillment.productTitle}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Total Charged</span>
                      <span className="font-bold text-emerald-400">${latestFulfillment.amount}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-950/50 border border-indigo-800/60 rounded-xl space-y-2">
                    <span className="text-[11px] font-bold text-indigo-200 block uppercase font-mono tracking-wider">
                      Generated Commercial License Key
                    </span>
                    <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-indigo-700/50 font-mono text-sm text-amber-300 font-bold">
                      <span>{latestFulfillment.licenseKey}</span>
                      <button
                        onClick={() => handleCopyKey(latestFulfillment.licenseKey)}
                        className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-colors cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  Run a simulated order on the left to see the instant license voucher and Supabase transaction entry.
                </div>
              )}
            </div>

            <div className="pt-4 mt-6 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Sync destination: <strong className="text-white">public.digital_orders & public.income_records</strong></span>
              <span className="text-emerald-400 font-bold">Live Integration Active</span>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Add New Digital Product</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={newProduct.title}
                  onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                  placeholder="e.g. AI Appointment Setter n8n Automation"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Automation Workflow">Automation Workflow</option>
                    <option value="AI Prompt System">AI Prompt System</option>
                    <option value="SaaS Template">SaaS Template</option>
                    <option value="Growth Course">Growth Course</option>
                    <option value="Agency SOP Pack">Agency SOP Pack</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Price (USD)</label>
                  <input
                    type="number"
                    required
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  rows={3}
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  placeholder="Summary of deliverables and key benefits..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg"
                >
                  Save & Publish Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
