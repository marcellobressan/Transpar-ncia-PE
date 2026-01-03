import React from 'react';
import { EfficiencyRating } from '../types';
import Tooltip from './Tooltip';

interface EfficiencyBadgeProps {
  rating: EfficiencyRating;
}

const EfficiencyBadge: React.FC<EfficiencyBadgeProps> = ({ rating }) => {
  let colorClass = '';
  let description = '';
  let icon = '';

  switch (rating) {
    case EfficiencyRating.ALTA:
      colorClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      description = 'Alta produtividade legislativa combinada com baixo custo operacional comparado aos pares.';
      icon = '★';
      break;
    case EfficiencyRating.MEDIA:
      colorClass = 'bg-amber-100 text-amber-800 border-amber-200';
      description = 'Produção legislativa e gastos dentro da média esperada para o cargo.';
      icon = '●';
      break;
    case EfficiencyRating.BAIXA:
      colorClass = 'bg-orange-100 text-orange-800 border-orange-200';
      description = 'Gasto elevado em relação à quantidade de propostas ou presença em plenário.';
      icon = '▼';
      break;
    case EfficiencyRating.CRITICA:
      colorClass = 'bg-rose-100 text-rose-800 border-rose-200';
      description = 'Indicadores financeiros e legislativos muito abaixo da média ou com irregularidades.';
      icon = '⚠';
      break;
  }

  return (
    <Tooltip content={description} position="bottom">
      <span 
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200 hover:shadow-sm ${colorClass}`}
        role="status"
        aria-label={`Eficiência: ${rating}. ${description}`}
      >
        <span aria-hidden="true">{icon}</span>
        {rating}
      </span>
    </Tooltip>
  );
};

export default EfficiencyBadge;