import { useState } from 'react';
import { Package } from 'lucide-react';

interface ProductImageProps {
  src: string;
  alt: string;
  category?: string;
  className?: string;
}

export function ProductImage({ src, alt, category, className = '' }: ProductImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-white via-purple-50 to-purple-100/70 text-purple-700 select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <Package className="w-8 h-8 mb-2 text-purple-400" strokeWidth={1.5} />
        <span className="text-xs font-medium text-purple-800 px-3 text-center line-clamp-1">
          {category || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
