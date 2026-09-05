import type { OrderStatus, PaymentStatus } from "../../shared/types/roles.js";
import { adminRepository } from "./admin.repository.js";
import { ordersRepository } from "../orders/orders.repository.js";
import { sellersService } from "../sellers/sellers.service.js";
import { auditService } from "../audit/audit.service.js";
import type { ListAuditLogsQueryInput } from "../audit/audit.dto.js";
import type { AuditActor } from "../audit/audit.types.js";

export const adminService = {
  async listUsers() {
    return adminRepository.findAllUsers();
  },

  async listOrders(filters?: { status?: OrderStatus; paymentStatus?: PaymentStatus }) {
    return ordersRepository.findMany(filters);
  },

  async approveSeller(sellerId: string, isApproved: boolean, actor?: AuditActor) {
    return sellersService.approve(sellerId, isApproved, actor);
  },

  async listAuditLogs(query: ListAuditLogsQueryInput) {
    return auditService.list(query);
  },
};
