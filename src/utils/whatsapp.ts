/**
 * Utility functions for WhatsApp integration
 */

export function sanitizePhoneNumber(phone?: string): string {
  if (!phone) return '';
  let digits = phone.replace(/[^0-9]/g, '');
  
  // Default regional formatting for common local numbers if needed (e.g. 01XXXXXXXXX -> 201XXXXXXXXX)
  if (digits.startsWith('01') && digits.length === 11) {
    digits = `20${digits.substring(1)}`;
  }
  return digits;
}

export function createWhatsAppLink(phone?: string, text?: string): string {
  const encodedText = encodeURIComponent(text || '');
  const cleanPhone = sanitizePhoneNumber(phone);
  
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}
