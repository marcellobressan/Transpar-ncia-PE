import React from 'react';
import { EfficiencyRating } from '../types';
import Tooltip from './Tooltip';

interface EfficiencyBadgeProps {
  rating: EfficiencyRating;
}

const EfficiencyBadge: React.FC<EfficiencyBadgeProps> = ({ rating }) => {
  let colorClass = '';
  let description = '';

  switch (rating) {
    case EfficiencyRating.ALTA:
      colorClass = 'bg-green-100 text-green-800 border-green-200';
      description = 'Alta produtividade legislativa combinada com baixo custo operacional comparado aos pares.';
      break;
    case EfficiencyRating.MEDIA:
      colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
      description = 'Produção legislativa e gastos dentro da média esperada para o cargo.';
      break;
    case EfficiencyRating.BAIXA:
      colorClass = 'bg-orange-100 text-orange-800 border-orange-200';
      description = 'Gasto elevado em relação à quantidade de propostas ou presença em plenário.';
      break;
    case EfficiencyRating.CRITICA:
      colorClass = 'bg-red-100 text-red-800 border-red-200';
      description = 'Indicadores financeiros e legislativos muito abaixo da média ou com irregularidades.';
      break;
  }

  return (
    <Tooltip content={description} position="bottom">
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border cursor-help ${colorClass}`}>
        {rating}
      </span>
    </Tooltip>
  );
};

export default EfficiencyBadge;