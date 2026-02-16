import type { OrderStatus, PaymentStatus } from "../../shared/types/roles.js";
import { adminRepository } from "./admin.repository.js";
import { ordersRepository } from "../orders/orders.repository.js";
import { sellersService } from "../sellers/sellers.service.js";

export const adminService = {
  async listUsers() {
    return adminRepository.findAllUsers();
  },

  async listOrders(filters?: { status?: OrderStatus; paymentStatus?: PaymentStatus }) {
    return ordersRepository.findMany(filters);
  },

  async approveSeller(sellerId: string, isApproved: boolean) {
    return sellersService.approve(sellerId, isApproved);
  },
};
