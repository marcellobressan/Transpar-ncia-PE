import React from 'react';
import { EfficiencyRating } from '../types';

interface EfficiencyBadgeProps {
  rating: EfficiencyRating;
}

const EfficiencyBadge: React.FC<EfficiencyBadgeProps> = ({ rating }) => {
  let colorClass = '';

  switch (rating) {
    case EfficiencyRating.ALTA:
      colorClass = 'bg-green-100 text-green-800 border-green-200';
      break;
    case EfficiencyRating.MEDIA:
      colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
      break;
    case EfficiencyRating.BAIXA:
      colorClass = 'bg-orange-100 text-orange-800 border-orange-200';
      break;
    case EfficiencyRating.CRITICA:
      colorClass = 'bg-red-100 text-red-800 border-red-200';
      break;
  }

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${colorClass}`}>
      {rating}
    </span>
  );
};

export default EfficiencyBadge;