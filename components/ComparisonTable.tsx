import React from 'react';
import { Candidate, Sphere } from '../types';
import { FORMATTER_BRL } from '../constants';
import EfficiencyBadge from './EfficiencyBadge';

interface ComparisonTableProps {
  candidates: Candidate[];
}

const ComparisonTable: React.FC<ComparisonTableProps> = ({ candidates }) => {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidato</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cargo Atual</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Gastos (10 anos)</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eficiência</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tendência</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Execução Emendas</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {candidates.map((candidate) => (
            <tr key={candidate.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <img className="h-10 w-10 rounded-full object-cover" src={candidate.photoUrl} alt="" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{candidate.name}</div>
                    <div className="text-sm text-gray-500">{candidate.party}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {candidate.currentRole}
                <br />
                <span className="text-xs text-gray-400">{candidate.sphere}</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                {FORMATTER_BRL.format(candidate.totalSpending10Years)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <EfficiencyBadge rating={candidate.efficiencyRating} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {candidate.spendingTrend === 'Crescente' ? (
                  <span className="text-red-600 flex items-center">↗ Crescente</span>
                ) : candidate.spendingTrend === 'Decrescente' ? (
                  <span className="text-green-600 flex items-center">↘ Decrescente</span>
                ) : (
                  <span className="text-blue-600 flex items-center">→ Estável</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {candidate.amendments ? (
                  `${Math.round((candidate.amendments.totalExecuted / candidate.amendments.totalProposed) * 100)}%`
                ) : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ComparisonTable;