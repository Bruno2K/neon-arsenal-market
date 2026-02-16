import { Shield } from 'lucide-react';
import type { SellerRank } from '@/services/mock-data';

const config: Record<SellerRank, { label: string; className: string }> = {
  bronze: { label: 'Bronze', className: 'rank-bronze' },
  silver: { label: 'Silver', className: 'rank-silver' },
  gold: { label: 'Gold', className: 'rank-gold' },
  'global-elite': { label: 'Elite', className: 'rank-elite' },
};

export function RankBadge({ rank, size = 'sm' }: { rank: SellerRank; size?: 'sm' | 'md' }) {
  const c = config[rank];
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-0.5' : 'text-xs px-2 py-1 gap-1';

  return (
    <span className={`inline-flex items-center rounded border font-heading ${c.className} ${sizeClass}`}>
      <Shield className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
      {c.label}
    </span>
  );
}
