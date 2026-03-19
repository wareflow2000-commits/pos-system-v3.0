import { create } from 'zustand';
import { Product } from '../db/db';

export interface CartItem extends Product {
  cartItemId: string; // Unique ID for the cart item (in case of same product added differently)
  cartQuantity: number;
  discount: number; // Percentage or fixed
  discountType: 'percentage' | 'fixed';
  costPriceAtTimeOfSale: number; // Added for accurate COGS
}

interface CartState {
  items: CartItem[];
  globalDiscount: number;
  globalDiscountType: 'percentage' | 'fixed';
  offerDiscount: number; // Automatically calculated from active offers
  taxRate: number; // Global tax rate from settings
  
  // Actions
  addItem: (product: Product) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  updateItemDiscount: (cartItemId: string, discount: number, type: 'percentage' | 'fixed') => void;
  clearCart: () => void;
  setGlobalDiscount: (discount: number, type: 'percentage' | 'fixed') => void;
  setOfferDiscount: (discount: number) => void;
  setTaxRate: (rate: number) => void;
  
  // Computed (Getters)
  getSubTotal: () => number;
  getTaxTotal: () => number;
  getDiscountTotal: () => number;
  getGrandTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  globalDiscount: 0,
  globalDiscountType: 'percentage',
  offerDiscount: 0,
  taxRate: 15,

  addItem: (product) => {
    set((state) => {
      const existingItem = state.items.find((item) => item.id === product.id);
      if (existingItem) {
        return {
          items: state.items.map((item) =>
            item.id === product.id
              ? { ...item, cartQuantity: item.cartQuantity + 1 }
              : item
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            ...product,
            cartItemId: crypto.randomUUID(),
            cartQuantity: 1,
            discount: 0,
            discountType: 'percentage',
            costPriceAtTimeOfSale: product.costPrice,
            vatRate: state.taxRate // Use global tax rate
          },
        ],
      };
    });
  },

  removeItem: (cartItemId) => {
    set((state) => ({
      items: state.items.filter((item) => item.cartItemId !== cartItemId),
    }));
  },

  updateQuantity: (cartItemId, quantity) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.cartItemId === cartItemId ? { ...item, cartQuantity: Math.max(1, quantity) } : item
      ),
    }));
  },

  updateItemDiscount: (cartItemId, discount, type) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.cartItemId === cartItemId ? { ...item, discount, discountType: type } : item
      ),
    }));
  },

  clearCart: () => {
    set({ items: [], globalDiscount: 0, globalDiscountType: 'percentage', offerDiscount: 0 });
  },

  setGlobalDiscount: (discount, type) => {
    set({ globalDiscount: discount, globalDiscountType: type });
  },

  setOfferDiscount: (discount) => {
    if (get().offerDiscount === discount) return;
    set({ offerDiscount: discount });
  },

  setTaxRate: (rate) => {
    set((state) => ({ 
      taxRate: rate,
      items: state.items.map(item => ({ ...item, vatRate: rate }))
    }));
  },

  getSubTotal: () => {
    const { items } = get();
    return items.reduce((total, item) => {
      const price = Number(item.sellingPrice) || 0;
      const qty = Number(item.cartQuantity) || 0;
      return total + price * qty;
    }, 0);
  },

  getTaxTotal: () => {
    const { items, globalDiscount, globalDiscountType, offerDiscount, taxRate } = get();
    
    // First calculate total discount on items
    const itemsDiscountTotal = items.reduce((total, item) => {
      const itemTotal = (Number(item.sellingPrice) || 0) * (Number(item.cartQuantity) || 0);
      const discount = Number(item.discount) || 0;
      return total + (item.discountType === 'percentage' ? itemTotal * (discount / 100) : discount);
    }, 0);

    const subTotal = get().getSubTotal();
    const subTotalAfterItemsDiscount = Math.max(0, subTotal - itemsDiscountTotal);
    
    const gDiscount = Number(globalDiscount) || 0;
    const oDiscount = Number(offerDiscount) || 0;

    const orderDiscount = globalDiscountType === 'percentage' 
      ? subTotalAfterItemsDiscount * (gDiscount / 100)
      : gDiscount;

    const totalOrderDiscount = orderDiscount + oDiscount;

    // Distribute order discount proportionally to calculate tax correctly
    return items.reduce((total, item) => {
      const itemTotal = (Number(item.sellingPrice) || 0) * (Number(item.cartQuantity) || 0);
      const discount = Number(item.discount) || 0;
      const itemDiscount = item.discountType === 'percentage' 
        ? itemTotal * (discount / 100) 
        : discount;
      
      let afterDiscount = itemTotal - itemDiscount;
      
      // Apply proportional global discount
      if (subTotalAfterItemsDiscount > 0) {
        const proportion = afterDiscount / subTotalAfterItemsDiscount;
        afterDiscount -= (totalOrderDiscount * proportion);
      }

      // Use global tax rate if provided, otherwise fallback to item's rate
      const vat = taxRate !== undefined ? taxRate : (Number(item.vatRate) || 0);
      return total + (Math.max(0, afterDiscount) * (vat / 100));
    }, 0);
  },

  getDiscountTotal: () => {
    const { items, globalDiscount, globalDiscountType, offerDiscount } = get();
    const itemsDiscount = items.reduce((total, item) => {
      const itemTotal = (Number(item.sellingPrice) || 0) * (Number(item.cartQuantity) || 0);
      const discount = Number(item.discount) || 0;
      return total + (item.discountType === 'percentage' ? itemTotal * (discount / 100) : discount);
    }, 0);

    const subTotal = get().getSubTotal();
    const subTotalAfterItemsDiscount = Math.max(0, subTotal - itemsDiscount);
    const gDiscount = Number(globalDiscount) || 0;
    const oDiscount = Number(offerDiscount) || 0;

    const orderDiscount = globalDiscountType === 'percentage' 
      ? subTotalAfterItemsDiscount * (gDiscount / 100)
      : gDiscount;

    return itemsDiscount + orderDiscount + oDiscount;
  },

  getGrandTotal: () => {
    const { getSubTotal, getTaxTotal, getDiscountTotal } = get();
    return getSubTotal() - getDiscountTotal() + getTaxTotal();
  },
}));
