'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Heart, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DealScoreBadge } from '@/components/deal-score-badge';
import { useUpdateListing } from '@/hooks/use-listings';
import { cn } from '@/lib/utils';
import type { Listing } from '@/lib/types';

function formatPrice(cents: number | null): string {
  if (cents == null) return 'Price N/A';
  const dollars = cents / 100;
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatMileage(miles: number | null): string {
  if (miles == null) return 'Mileage N/A';
  return `${miles.toLocaleString('en-US')} mi`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ListingCardProps {
  listing: Listing;
}

export function ListingCard({ listing }: ListingCardProps) {
  const { mutate: updateListing } = useUpdateListing();
  const [imgError, setImgError] = useState(false);

  const title = [listing.year, listing.make, listing.model, listing.trim]
    .filter(Boolean)
    .join(' ');

  function handleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    updateListing({ id: listing.id, data: { isFavorited: !listing.isFavorited } });
  }

  function handleDismiss(e: React.MouseEvent) {
    e.preventDefault();
    updateListing({ id: listing.id, data: { isDismissed: true } });
  }

  return (
    <Link href={`/listing/${listing.id}`} className="block focus:outline-none">
      <Card className="relative h-full transition-shadow hover:shadow-md">
        {/* Image */}
        <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-muted">
          {listing.imageUrl && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.imageUrl}
              alt={title || 'Vehicle'}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              No image
            </div>
          )}
          {/* Source badge */}
          <Badge className="absolute left-2 top-2 capitalize" variant="secondary">
            {listing.source}
          </Badge>
          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-background/80 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground"
            aria-label="Dismiss listing"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <CardContent className="pt-3">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
              {title || 'Unknown Vehicle'}
            </h3>
            <button
              onClick={handleFavorite}
              aria-label={listing.isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              className={cn(
                'shrink-0 transition-colors',
                listing.isFavorited
                  ? 'text-red-500 hover:text-red-600'
                  : 'text-muted-foreground hover:text-red-500'
              )}
            >
              <Heart
                className={cn('size-4', listing.isFavorited && 'fill-current')}
              />
            </button>
          </div>

          {/* Price + deal score */}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-base font-bold">{formatPrice(listing.price)}</span>
            {listing.dealScore != null && (
              <DealScoreBadge score={listing.dealExplanation?.score ?? listing.dealScore} />
            )}
          </div>

          {listing.dealExplanation && <div className="mt-2 text-xs space-y-1">
            <p>{listing.dealExplanation.assessment.verified ? 'Verified filter match' : 'Needs verification'}</p>
            {listing.dealExplanation.assessment.unknown.map(t => <p key={t} className="text-muted-foreground">{t}</p>)}
            {listing.dealExplanation.assessment.flags.map(t => <p key={t} className="text-amber-600">{t}</p>)}
            <p title={listing.dealExplanation.marketBasis}>Market comparison: {listing.dealExplanation.comparableCount} peers</p>
            <p>Score /10: market {listing.dealExplanation.parts.market.toFixed(1)} · miles {listing.dealExplanation.parts.mileage.toFixed(1)} · history {listing.dealExplanation.parts.history.toFixed(1)} · dealer {listing.dealExplanation.parts.dealer.toFixed(1)} · age {listing.dealExplanation.parts.age.toFixed(1)} · days {listing.dealExplanation.parts.daysOnMarket.toFixed(1)} · fee penalty {listing.dealExplanation.penalty}</p>
          </div>}
          {/* Details */}
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <p>{formatMileage(listing.mileage)}</p>
            {listing.location && <p>{listing.location}</p>}
            <p>First observed {formatDate(listing.firstSeenAt)}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
