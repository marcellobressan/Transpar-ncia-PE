import React from 'react';
import { Politician, CandidacyStatus } from '../types';
import { FORMATTER_BRL, PARTY_LOGOS } from '../constants';
import EfficiencyBadge from './EfficiencyBadge';
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ComparisonTableProps {
  politicians: Politician[];
}

const ComparisonTable: React.FC<ComparisonTableProps> = ({ politicians }) => {
  
  const getStatusBadge = (status: CandidacyStatus) => {
    switch (status) {
      case CandidacyStatus.CONFIRMADA:
        return <span className="px-2 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800 border border-green-200">Confirmada</span>;
      case CandidacyStatus.PRE_CANDIDATO:
        return <span className="px-2 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">Pré-Candidato</span>;
      case CandidacyStatus.NAO_CANDIDATO:
        return <span className="px-2 py-1 text-xs font-bold rounded-full bg-gray-100 text-gray-600 border border-gray-200">Não Concorre</span>;
      default:
        return null;
    }
  };

  const getRedFlagsIndicator = (flags: Politician['redFlags']) => {
    const highSeverity = flags.filter(f => f.severity === 'HIGH').length;
    const mediumSeverity = flags.filter(f => f.severity === 'MEDIUM').length;

    if (highSeverity > 0) {
      return (
        <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded border border-red-200">
          <AlertCircle className="w-3 h-3" /> {highSeverity} Crítico(s)
        </span>
      );
    }
    if (mediumSeverity > 0) {
      return (
        <span className="flex items-center gap-1 text-xs font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded border border-orange-200">
          <AlertTriangle className="w-3 h-3" /> {mediumSeverity} Atenção
        </span>
      );
    }
    if (flags.length > 0) {
       return (
        <span className="flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-200">
          {flags.length} Nota(s)
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded border border-green-100">
        <CheckCircle2 className="w-3 h-3" /> Nada Consta
      </span>
    );
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Político / Partido</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Situação</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cargo Atual</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gasto (Último Mandato)</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bandeiras Vermelhas</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eficiência</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {politicians.map((pol) => (
            <tr key={pol.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <img 
                      className="h-10 w-10 rounded-full object-contain bg-white border border-gray-200 p-0.5" 
                      src={PARTY_LOGOS[pol.party] || PARTY_LOGOS['DEFAULT']} 
                      alt={`Logo ${pol.party}`} 
                    />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{pol.name}</div>
                    <div className="text-sm text-gray-500">{pol.party}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <div className="flex flex-col gap-1">
                   {getStatusBadge(pol.candidacyStatus)}
                   {pol.disputedRole && (
                     <span className="text-xs text-gray-500">Alvo: {pol.disputedRole}</span>
                   )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {pol.currentRole}
                <br />
                <span className="text-xs text-gray-400">{pol.sphere}</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                {FORMATTER_BRL.format(pol.totalSpendingLastMandate)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {getRedFlagsIndicator(pol.redFlags)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <EfficiencyBadge rating={pol.efficiencyRating} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ComparisonTable;