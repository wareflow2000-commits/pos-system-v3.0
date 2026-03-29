import axios from 'axios';
import { db } from '../db/db';

let API_BASE = '/api';

// Initialize API_BASE from settings
const initApiBase = async () => {
  try {
    const serverUrlSetting = await db.settings.where('key').equals('serverUrl').first();
    if (serverUrlSetting && serverUrlSetting.value) {
      const url = serverUrlSetting.value;
      API_BASE = url.endsWith('/') ? `${url}api` : `${url}/api`;
    }
  } catch (e) {
    console.error('Failed to init API_BASE:', e);
  }
};

initApiBase();

export const updateApiBase = (url: string) => {
  API_BASE = url.endsWith('/') ? `${url}api` : `${url}/api`;
};

const requestWithRetry = async (fn: () => Promise<any>, retries = 3, delay = 1000): Promise<any> => {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return requestWithRetry(fn, retries - 1, delay * 2);
  }
};

export const apiService = {
  async getProducts() {
    return requestWithRetry(() => axios.get(`${API_BASE}/products`).then(r => r.data));
  },

  async createProduct(product: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/products`, product).then(r => r.data));
  },

  async updateProduct(id: number, product: any) {
    return requestWithRetry(() => axios.put(`${API_BASE}/products/${id}`, product).then(r => r.data));
  },

  async deleteProduct(id: number) {
    return requestWithRetry(() => axios.delete(`${API_BASE}/products/${id}`).then(r => r.data));
  },

  async getCategories() {
    return requestWithRetry(() => axios.get(`${API_BASE}/categories`).then(r => r.data));
  },

  async createCategory(category: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/categories`, category).then(r => r.data));
  },

  async updateCategory(id: number, category: any) {
    return requestWithRetry(() => axios.put(`${API_BASE}/categories/${id}`, category).then(r => r.data));
  },

  async deleteCategory(id: number) {
    return requestWithRetry(() => axios.delete(`${API_BASE}/categories/${id}`).then(r => r.data));
  },

  async getCustomers() {
    return requestWithRetry(() => axios.get(`${API_BASE}/customers`).then(r => r.data));
  },

  async createCustomer(customer: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/customers`, customer).then(r => r.data));
  },

  async updateCustomer(id: number, customer: any) {
    return requestWithRetry(() => axios.put(`${API_BASE}/customers/${id}`, customer).then(r => r.data));
  },

  async deleteCustomer(id: number) {
    return requestWithRetry(() => axios.delete(`${API_BASE}/customers/${id}`).then(r => r.data));
  },

  async getSuppliers() {
    return requestWithRetry(() => axios.get(`${API_BASE}/suppliers`).then(r => r.data));
  },

  async createSupplier(supplier: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/suppliers`, supplier).then(r => r.data));
  },

  async updateSupplier(id: number, supplier: any) {
    return requestWithRetry(() => axios.put(`${API_BASE}/suppliers/${id}`, supplier).then(r => r.data));
  },

  async deleteSupplier(id: number) {
    return requestWithRetry(() => axios.delete(`${API_BASE}/suppliers/${id}`).then(r => r.data));
  },

  async getOrders() {
    return requestWithRetry(() => axios.get(`${API_BASE}/orders`).then(r => r.data));
  },

  async createOrder(order: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/orders`, order).then(r => r.data));
  },

  async updateOrder(id: string, order: any) {
    return requestWithRetry(() => axios.put(`${API_BASE}/orders/${id}`, order).then(r => r.data));
  },

  async deleteOrder(id: string) {
    return requestWithRetry(() => axios.delete(`${API_BASE}/orders/${id}`).then(r => r.data));
  },

  async getOrderItems() {
    return requestWithRetry(() => axios.get(`${API_BASE}/orderItems`).then(r => r.data));
  },

  async createOrderItem(orderItem: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/orderItems`, orderItem).then(r => r.data));
  },

  async deleteOrderItem(id: number) {
    return requestWithRetry(() => axios.delete(`${API_BASE}/orderItems/${id}`).then(r => r.data));
  },

  async getShifts() {
    return requestWithRetry(() => axios.get(`${API_BASE}/shifts`).then(r => r.data));
  },

  async createShift(shift: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/shifts`, shift).then(r => r.data));
  },

  async updateShift(id: string, shift: any) {
    return requestWithRetry(() => axios.put(`${API_BASE}/shifts/${id}`, shift).then(r => r.data));
  },

  async getExpenses() {
    return requestWithRetry(() => axios.get(`${API_BASE}/expenses`).then(r => r.data));
  },

  async createExpense(expense: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/expenses`, expense).then(r => r.data));
  },

  async deleteExpense(id: number) {
    return requestWithRetry(() => axios.delete(`${API_BASE}/expenses/${id}`).then(r => r.data));
  },

  async getEmployees() {
    return requestWithRetry(() => axios.get(`${API_BASE}/employees`).then(r => r.data));
  },

  async createEmployee(employee: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/employees`, employee).then(r => r.data));
  },

  async updateEmployee(id: number, employee: any) {
    return requestWithRetry(() => axios.put(`${API_BASE}/employees/${id}`, employee).then(r => r.data));
  },

  async deleteEmployee(id: number) {
    return requestWithRetry(() => axios.delete(`${API_BASE}/employees/${id}`).then(r => r.data));
  },

  async getSettings() {
    return requestWithRetry(() => axios.get(`${API_BASE}/settings`).then(r => r.data));
  },

  async createSetting(setting: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/settings`, setting).then(r => r.data));
  },

  async updateSetting(key: string, setting: any) {
    return requestWithRetry(() => axios.put(`${API_BASE}/settings/${key}`, setting).then(r => r.data));
  },

  async checkout(checkoutData: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/checkout`, checkoutData).then(r => r.data));
  },

  async getAttendance() {
    return requestWithRetry(() => axios.get(`${API_BASE}/attendance`).then(r => r.data));
  },

  async recordAttendance(attendance: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/attendance`, attendance).then(r => r.data));
  },

  async updateAttendance(id: string, attendance: any) {
    return requestWithRetry(() => axios.put(`${API_BASE}/attendance/${id}`, attendance).then(r => r.data));
  },

  async getLoyaltyTransactions() {
    return requestWithRetry(() => axios.get(`${API_BASE}/loyalty-transactions`).then(r => r.data));
  },
  
  async createLoyaltyTransaction(transaction: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/loyalty-transactions`, transaction).then(r => r.data));
  },

  async getPayroll() {
    return requestWithRetry(() => axios.get(`${API_BASE}/payroll`).then(r => r.data));
  },

  async createPayroll(payroll: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/payroll`, payroll).then(r => r.data));
  },

  async getBranches() {
    return requestWithRetry(() => axios.get(`${API_BASE}/branches`).then(r => r.data));
  },
  async createBranch(branch: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/branches`, branch).then(r => r.data));
  },
  async updateBranch(id: number, branch: any) {
    return requestWithRetry(() => axios.put(`${API_BASE}/branches/${id}`, branch).then(r => r.data));
  },
  async deleteBranch(id: number) {
    return requestWithRetry(() => axios.delete(`${API_BASE}/branches/${id}`).then(r => r.data));
  },
  async getOffers() {
    return requestWithRetry(() => axios.get(`${API_BASE}/offers`).then(r => r.data));
  },
  async createOffer(offer: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/offers`, offer).then(r => r.data));
  },
  async updateOffer(id: number, offer: any) {
    return requestWithRetry(() => axios.put(`${API_BASE}/offers/${id}`, offer).then(r => r.data));
  },
  async deleteOffer(id: number) {
    return requestWithRetry(() => axios.delete(`${API_BASE}/offers/${id}`).then(r => r.data));
  },
  async getPurchases() {
    return requestWithRetry(() => axios.get(`${API_BASE}/purchases`).then(r => r.data));
  },
  async getPurchaseItems() {
    return requestWithRetry(() => axios.get(`${API_BASE}/purchaseItems`).then(r => r.data));
  },
  async createPurchase(purchaseData: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/purchases`, purchaseData).then(r => r.data));
  },
  async createPurchaseItem(purchaseItem: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/purchaseItems`, purchaseItem).then(r => r.data));
  },
  async updatePurchase(id: string, purchase: any) {
    return requestWithRetry(() => axios.put(`${API_BASE}/purchases/${id}`, purchase).then(r => r.data));
  },
  async deletePurchase(id: string) {
    return requestWithRetry(() => axios.delete(`${API_BASE}/purchases/${id}`).then(r => r.data));
  },

  async getSalesReport(params: { startDate?: string, endDate?: string, branchId?: number }) {
    return requestWithRetry(() => axios.get(`${API_BASE}/reports/sales`, { params }).then(r => r.data));
  },

  async getAuditLogs() {
    return requestWithRetry(() => axios.get(`${API_BASE}/auditLogs`).then(r => r.data));
  },

  async createAuditLog(log: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/auditLogs`, log).then(r => r.data));
  },

  async getStocktakingSessions() {
    return requestWithRetry(() => axios.get(`${API_BASE}/stocktakingSessions`).then(r => r.data));
  },

  async createStocktakingSession(session: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/stocktakingSessions`, session).then(r => r.data));
  },

  async updateStocktakingSession(id: string, session: any) {
    return requestWithRetry(() => axios.put(`${API_BASE}/stocktakingSessions/${id}`, session).then(r => r.data));
  },

  async getStocktakingEntries() {
    return requestWithRetry(() => axios.get(`${API_BASE}/stocktakingEntries`).then(r => r.data));
  },

  async createStocktakingEntry(entry: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/stocktakingEntries`, entry).then(r => r.data));
  },

  async getInventoryBatches() {
    return requestWithRetry(() => axios.get(`${API_BASE}/inventoryBatches`).then(r => r.data));
  },

  async createInventoryBatch(batch: any) {
    return requestWithRetry(() => axios.post(`${API_BASE}/inventoryBatches`, batch).then(r => r.data));
  },

  async updateInventoryBatch(id: number, batch: any) {
    return requestWithRetry(() => axios.put(`${API_BASE}/inventoryBatches/${id}`, batch).then(r => r.data));
  },
};
