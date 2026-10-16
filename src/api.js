import { invoke } from "@tauri-apps/api/core";

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const call = (cmd, args) => {
  if (!inTauri) return Promise.reject("Run the app with `npm run tauri dev` (Tauri backend not available in the browser).");
  return invoke(cmd, args);
};

export const api = {
  products: () => call("list_products"),
  saveProduct: (product) => call("save_product", { product }),
  deleteProduct: (id) => call("delete_product", { id }),
  createSale: (items, paid) => call("create_sale", { items, paid }),
  sales: (from, to, status = "") => call("list_sales", { from, to, status }),
  voidSale: (id, reason) => call("void_sale", { id, reason }),
  voided: (from, to) => call("list_voided", { from, to }),
  restock: (productId, qty, unitCost, note) => call("restock", { productId, qty, unitCost, note }),
  restocks: () => call("list_restocks"),
  expenses: (from, to) => call("list_expenses", { from, to }),
  saveExpense: (expense) => call("save_expense", { expense }),
  deleteExpense: (id) => call("delete_expense", { id }),
  salaries: (from, to) => call("list_salaries", { from, to }),
  saveSalary: (salary) => call("save_salary", { salary }),
  deleteSalary: (id) => call("delete_salary", { id }),
  commissions: (from, to) => call("list_commissions", { from, to }),
  saveCommission: (commission) => call("save_commission", { commission }),
  deleteCommission: (id) => call("delete_commission", { id }),
  commissionTypes: () => call("list_commission_types"),
  addCommissionType: (name) => call("add_commission_type", { name }),
  ldCommissions: (from, to) => call("list_ld_commissions", { from, to }),
  saveLdCommission: (commission) => call("save_ld_commission", { commission }),
  deleteLdCommission: (id) => call("delete_ld_commission", { id }),
  employees: () => call("list_employees"),
  saveEmployee: (employee) => call("save_employee", { employee }),
  deleteEmployee: (id) => call("delete_employee", { id }),
  dashboard: (from, to) => call("dashboard", { from, to }),
  getSettings: () => call("get_settings"),
  setSettings: (values) => call("set_settings", { values }),
  backup: (path) => call("backup_db", { path }),
  restore: (path) => call("restore_db", { path }),
  printReceipt: (saleId) => call("print_receipt", { saleId }),
  printTest: () => call("print_test"),
  usbDevices: () => call("list_usb_devices"),
};
