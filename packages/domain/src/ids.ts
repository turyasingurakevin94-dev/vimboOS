/**
 * Branded identifiers.
 *
 * Every id in the database is a string, which means every id is assignable to
 * every other id, which means `getCustomer(order.agentId)` compiles. The old
 * app had a whole migration — 0036_repair_detached_agent_orders — to clean up
 * after exactly that class of mistake.
 *
 * Branding costs nothing at run time and makes the mix-up a type error.
 */

declare const IdBrand: unique symbol;

type Id<Table extends string> = string & { readonly [IdBrand]: Table };

export type ShopId = Id<'shops'>;
export type StaffId = Id<'staff'>;
export type MemberId = Id<'shop_members'>;
export type ProductId = Id<'products'>;
export type VariantId = Id<'product_variants'>;
export type CustomerId = Id<'customers'>;
export type AgentId = Id<'agents'>;
export type SupplierId = Id<'suppliers'>;
export type OrderId = Id<'saved_quotes'>;
export type PurchaseId = Id<'purchase_invoices'>;
export type StockLotId = Id<'stock_lots'>;
export type CashTxnId = Id<'cash_txns'>;
export type LoanId = Id<'loans'>;
export type PlaceId = Id<'places'>;

/**
 * Assert a string from outside the type system — a URL param, a database row,
 * a form field — is an id of a given table.
 *
 * Deliberately verbose. Every call is a place where the compiler stopped
 * helping, and it should be visible in a diff.
 */
export const asId = <T extends Id<string>>(value: string): T => value as T;

/** The empty-string check that every id from a URL needs before it is used. */
export function parseId<T extends Id<string>>(value: string | undefined): T | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : (trimmed as T);
}
