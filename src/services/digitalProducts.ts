import { supabase, isSupabaseConfigured, insertAuditLogToSupabase } from '../lib/supabase';

export interface DigitalProduct {
  id: string;
  title: string;
  category: 'Automation Workflow' | 'AI Prompt System' | 'SaaS Template' | 'Growth Course' | 'Agency SOP Pack';
  description: string;
  price: number;
  monthlyMrrEstimate?: number;
  deliverableType: 'n8n_json' | 'notion_doc' | 'github_repo' | 'video_module' | 'figma_system';
  licenseType: 'single_user' | 'agency_unlimited' | 'enterprise';
  fileDownloadUrl: string;
  previewImageUrl?: string;
  salesCount: number;
  rating: number;
  active: boolean;
  features: string[];
  createdAt: string;
}

export interface DigitalOrder {
  id: string;
  orderNumber: string;
  productId: string;
  productTitle: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  amount: number;
  status: 'paid' | 'pending' | 'refunded';
  fulfillmentStatus: 'fulfilled' | 'processing' | 'failed';
  licenseKey: string;
  downloadCount: number;
  paymentMethod: 'Credit Card (Stripe)' | 'Crypto (USDT)' | 'Direct Bank Wire' | 'Manual Transfer';
  createdAt: string;
  notes?: string;
}

const LOCAL_PRODUCTS_KEY = 'za_media_digital_products_v1';
const LOCAL_ORDERS_KEY = 'za_media_digital_orders_v1';

export const INITIAL_DIGITAL_PRODUCTS: DigitalProduct[] = [
  {
    id: 'prod-001',
    title: 'AI Lead Qualification & WhatsApp Dispatcher (n8n Workflow Pack)',
    category: 'Automation Workflow',
    description: 'Production-ready n8n workflow for multi-channel intake, Gemini 2.5 scoring, and instant WhatsApp/Email outreach.',
    price: 299,
    deliverableType: 'n8n_json',
    licenseType: 'agency_unlimited',
    fileDownloadUrl: 'https://storage.zamedia.ai/downloads/n8n-lead-qualification-v1.json',
    salesCount: 42,
    rating: 4.9,
    active: true,
    features: [
      'Zero-code n8n import file (.json)',
      'Multi-model fallback logic (Gemini Flash & Pro)',
      'Direct Supabase & PostgreSQL schema sync',
      'Anti-ban WhatsApp rate-limiter logic'
    ],
    createdAt: '2026-08-01T10:00:00Z'
  },
  {
    id: 'prod-002',
    title: 'High-Ticket B2B Sales Closer & Objection Handling Matrix',
    category: 'AI Prompt System',
    description: 'Autonomous SDR prompt pack for closing $5k-$25k retainer clients with custom objection rebuttals.',
    price: 149,
    deliverableType: 'notion_doc',
    licenseType: 'single_user',
    fileDownloadUrl: 'https://storage.zamedia.ai/downloads/b2b-closer-matrix.pdf',
    salesCount: 78,
    rating: 5.0,
    active: true,
    features: [
      '50+ High-converting cold DM hooks',
      'Dynamic ROI calculation formulas',
      'Live objection battlecards for Zoom demos',
      'Instant proposal templates'
    ],
    createdAt: '2026-08-05T12:00:00Z'
  },
  {
    id: 'prod-003',
    title: 'AI Agency Growth Operating System (Full Stack React + Node Starter)',
    category: 'SaaS Template',
    description: 'Complete client portal, pipeline tracker, and autonomous team execution codebase ready to white-label.',
    price: 899,
    deliverableType: 'github_repo',
    licenseType: 'enterprise',
    fileDownloadUrl: 'https://github.com/zamedia/growth-os-enterprise',
    salesCount: 19,
    rating: 4.8,
    active: true,
    features: [
      'React 19 + Tailwind CSS + Express backend',
      'Integrated Supabase & n8n real-time listeners',
      'Built-in AI market intelligence module',
      'Commercial distribution rights included'
    ],
    createdAt: '2026-08-10T14:30:00Z'
  }
];

export const INITIAL_DIGITAL_ORDERS: DigitalOrder[] = [
  {
    id: 'ord-101',
    orderNumber: 'ZA-ORD-8821',
    productId: 'prod-001',
    productTitle: 'AI Lead Qualification & WhatsApp Dispatcher (n8n Workflow Pack)',
    customerName: 'Marcus Vance',
    customerEmail: 'marcus@vancegrowth.com',
    customerPhone: '+1 (555) 234-5678',
    amount: 299,
    status: 'paid',
    fulfillmentStatus: 'fulfilled',
    licenseKey: 'ZA-AGENCY-8821-VANCE-789X',
    downloadCount: 3,
    paymentMethod: 'Credit Card (Stripe)',
    createdAt: '2026-08-16T18:20:00Z',
    notes: 'Auto-delivered license key via webhook'
  },
  {
    id: 'ord-102',
    orderNumber: 'ZA-ORD-8822',
    productId: 'prod-003',
    productTitle: 'AI Agency Growth Operating System (Full Stack React + Node Starter)',
    customerName: 'Lina Al-Mansour',
    customerEmail: 'lina@solargrowth.ae',
    customerPhone: '+971 50 123 4567',
    amount: 899,
    status: 'paid',
    fulfillmentStatus: 'fulfilled',
    licenseKey: 'ZA-ENT-8822-SOLAR-391Z',
    downloadCount: 1,
    paymentMethod: 'Direct Bank Wire',
    createdAt: '2026-08-17T09:15:00Z',
    notes: 'Enterprise GitHub repo access granted'
  }
];

export function generateLicenseKey(prefix = 'ZA-KEY'): string {
  const segment1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const segment2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const segment3 = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${segment1}-${segment2}-${segment3}`;
}

export async function getDigitalProducts(): Promise<DigitalProduct[]> {
  try {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('digital_products').select('*');
      if (!error && data && data.length > 0) {
        return data.map((r: any) => ({
          id: r.id,
          title: r.title || r.name,
          category: r.category || 'Automation Workflow',
          description: r.description || '',
          price: Number(r.price || 0),
          deliverableType: r.deliverable_type || 'n8n_json',
          licenseType: r.license_type || 'single_user',
          fileDownloadUrl: r.file_url || r.file_download_url || '#',
          salesCount: r.sales_count || 0,
          rating: r.rating || 5.0,
          active: r.is_active ?? true,
          features: Array.isArray(r.features) ? r.features : (r.features ? JSON.parse(r.features) : []),
          createdAt: r.created_at || new Date().toISOString()
        }));
      }
    }
  } catch (err) {
    console.warn('Supabase digital_products fetch fallback:', err);
  }

  // Local storage fallback
  const local = localStorage.getItem(LOCAL_PRODUCTS_KEY);
  if (local) {
    try {
      return JSON.parse(local);
    } catch {}
  }
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(INITIAL_DIGITAL_PRODUCTS));
  return INITIAL_DIGITAL_PRODUCTS;
}

export async function saveDigitalProduct(product: DigitalProduct): Promise<void> {
  const current = await getDigitalProducts();
  const exists = current.findIndex(p => p.id === product.id);
  let updated: DigitalProduct[];
  if (exists >= 0) {
    updated = current.map(p => p.id === product.id ? product : p);
  } else {
    updated = [product, ...current];
  }
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(updated));

  // Supabase sync
  if (isSupabaseConfigured) {
    try {
      await supabase.from('digital_products').upsert([{
        id: product.id,
        title: product.title,
        category: product.category,
        description: product.description,
        price: product.price,
        deliverable_type: product.deliverableType,
        license_type: product.licenseType,
        file_url: product.fileDownloadUrl,
        sales_count: product.salesCount,
        rating: product.rating,
        is_active: product.active,
        features: JSON.stringify(product.features),
        created_at: product.createdAt
      }]);
    } catch (err) {
      console.warn('Supabase digital_products upsert warning:', err);
    }
  }
}

export async function getDigitalOrders(): Promise<DigitalOrder[]> {
  try {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('digital_orders').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return data.map((r: any) => ({
          id: r.id,
          orderNumber: r.order_number || `ZA-ORD-${r.id.substring(0, 4)}`,
          productId: r.product_id,
          productTitle: r.product_title || 'Digital Product',
          customerName: r.customer_name,
          customerEmail: r.customer_email,
          customerPhone: r.customer_phone,
          amount: Number(r.amount || 0),
          status: r.status || 'paid',
          fulfillmentStatus: r.fulfillment_status || 'fulfilled',
          licenseKey: r.license_key || generateLicenseKey(),
          downloadCount: r.download_count || 1,
          paymentMethod: r.payment_method || 'Credit Card (Stripe)',
          createdAt: r.created_at || new Date().toISOString(),
          notes: r.notes
        }));
      }
    }
  } catch (err) {
    console.warn('Supabase digital_orders fetch fallback:', err);
  }

  const local = localStorage.getItem(LOCAL_ORDERS_KEY);
  if (local) {
    try {
      return JSON.parse(local);
    } catch {}
  }
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(INITIAL_DIGITAL_ORDERS));
  return INITIAL_DIGITAL_ORDERS;
}

export async function createDigitalOrder(orderData: Omit<DigitalOrder, 'id' | 'orderNumber' | 'licenseKey' | 'createdAt' | 'fulfillmentStatus' | 'downloadCount'>): Promise<DigitalOrder> {
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'ord-' + Date.now();
  const orderNumber = `ZA-ORD-${Math.floor(1000 + Math.random() * 9000)}`;
  const licenseKey = generateLicenseKey();
  const now = new Date().toISOString();

  const newOrder: DigitalOrder = {
    ...orderData,
    id: newId,
    orderNumber,
    licenseKey,
    fulfillmentStatus: 'fulfilled',
    downloadCount: 0,
    createdAt: now
  };

  // 1. Update local storage
  const currentOrders = await getDigitalOrders();
  const updatedOrders = [newOrder, ...currentOrders];
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(updatedOrders));

  // 2. Increment sales count on product
  const products = await getDigitalProducts();
  const targetProduct = products.find(p => p.id === orderData.productId);
  if (targetProduct) {
    targetProduct.salesCount += 1;
    await saveDigitalProduct(targetProduct);
  }

  // 3. Persist to Supabase digital_orders
  if (isSupabaseConfigured) {
    try {
      await supabase.from('digital_orders').insert([{
        id: newId,
        order_number: orderNumber,
        product_id: newOrder.productId,
        product_title: newOrder.productTitle,
        customer_name: newOrder.customerName,
        customer_email: newOrder.customerEmail,
        customer_phone: newOrder.customerPhone,
        amount: newOrder.amount,
        status: newOrder.status,
        fulfillment_status: newOrder.fulfillmentStatus,
        license_key: newOrder.licenseKey,
        payment_method: newOrder.paymentMethod,
        created_at: now
      }]);
    } catch (err) {
      console.warn('Supabase digital_orders insert warning:', err);
    }

    // 4. Also register to public.income_records
    try {
      await supabase.from('income_records').insert([{
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'inc-' + Date.now(),
        client_name: newOrder.customerName,
        amount: newOrder.amount,
        category: 'Digital Product Sales',
        payment_method: newOrder.paymentMethod,
        status: 'paid',
        transaction_date: now,
        created_at: now
      }]);
    } catch (err) {
      console.warn('Supabase income_records insert notice:', err);
    }
  }

  // 5. Audit log
  await insertAuditLogToSupabase({
    title: `Digital Product Order Fulfilled: ${newOrder.orderNumber}`,
    description: `Customer ${newOrder.customerName} purchased ${newOrder.productTitle} ($${newOrder.amount}). License key generated & delivered: ${newOrder.licenseKey}`,
    type: 'automation',
    leadName: newOrder.customerName,
    status: 'success'
  });

  return newOrder;
}
