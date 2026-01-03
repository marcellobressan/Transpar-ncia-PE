import React from 'react';
import { Politician, CandidacyStatus } from '../types';
import { FORMATTER_BRL, PARTY_LOGOS } from '../constants';
import EfficiencyBadge from './EfficiencyBadge';
import Tooltip from './Tooltip';
import { AlertCircle, CheckCircle2, AlertTriangle, ArrowRight, HelpCircle } from 'lucide-react';

interface ComparisonTableProps {
  politicians: Politician[];
}

const ComparisonTable: React.FC<ComparisonTableProps> = ({ politicians }) => {
  
  const getStatusBadge = (status: CandidacyStatus) => {
    switch (status) {
      case CandidacyStatus.CONFIRMADA:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span>
            Confirmada
          </span>
        );
      case CandidacyStatus.PRE_CANDIDATO:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
             <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5"></span>
             Pré-Candidato
          </span>
        );
      case CandidacyStatus.NAO_CANDIDATO:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
             Não Concorre
          </span>
        );
      default:
        return null;
    }
  };

  const getRedFlagsIndicator = (flags: Politician['redFlags']) => {
    const highSeverity = flags.filter(f => f.severity === 'HIGH').length;
    const mediumSeverity = flags.filter(f => f.severity === 'MEDIUM').length;

    if (highSeverity > 0) {
      return (
        <Tooltip content="Processos judiciais, condenações ou irregularidades graves identificadas." position="top">
          <span className="flex items-center w-fit gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100 cursor-help">
            <AlertCircle className="w-3.5 h-3.5" /> {highSeverity} Crítico(s)
          </span>
        </Tooltip>
      );
    }
    if (mediumSeverity > 0) {
      return (
        <Tooltip content="Investigações em andamento ou apontamentos de Tribunais de Contas." position="top">
          <span className="flex items-center w-fit gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-100 cursor-help">
            <AlertTriangle className="w-3.5 h-3.5" /> {mediumSeverity} Atenção
          </span>
        </Tooltip>
      );
    }
    if (flags.length > 0) {
       return (
        <span className="flex items-center w-fit gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
          {flags.length} Nota(s)
        </span>
      );
    }
    return (
      <span className="flex items-center w-fit gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 opacity-80">
        <CheckCircle2 className="w-3.5 h-3.5" /> Nada Consta
      </span>
    );
  };

  return (
    <div className="overflow-x-auto w-full pb-12"> {/* Padding bottom extra para tooltips da ultima linha */}
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Político</th>
            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status Eleitoral</th>
            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cargo / Esfera</th>
            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <div className="flex items-center justify-end gap-1">
                Gastos (Mandato)
                <Tooltip content="Total acumulado declarado no último mandato completo ou atual. Inclui verba de gabinete e salários." position="top">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                </Tooltip>
              </div>
            </th>
            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <div className="flex items-center gap-1">
                Alertas
                <Tooltip content="Monitoramento de processos judiciais, " position="top">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                </Tooltip>
              </div>
            </th>
            <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <div className="flex items-center justify-center gap-1">
                Eficiência
                <Tooltip content="Índice calculado cruzando custo por voto, presença e projetos aprovados." position="top">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                </Tooltip>
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {politicians.map((pol) => (
            <tr key={pol.id} className="hover:bg-slate-50/80 transition-colors group cursor-default">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-11 w-11 relative">
                    <img 
                      className="h-11 w-11 rounded-full object-contain bg-white border border-slate-200 p-0.5" 
                      src={PARTY_LOGOS[pol.party] || PARTY_LOGOS['DEFAULT']} 
                      alt={`Logo ${pol.party}`} 
                    />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors">{pol.name}</div>
                    <div className="text-xs font-medium text-slate-500 bg-slate-100 px-1.5 rounded w-fit mt-0.5">{pol.party}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <div className="flex flex-col gap-1 items-start">
                   {getStatusBadge(pol.candidacyStatus)}
                   {pol.disputedRole && (
                     <div className="flex items-center gap-1 text-xs text-slate-500 mt-1 pl-1">
                        <ArrowRight className="w-3 h-3" />
                        Alvo: <span className="font-semibold text-slate-700">{pol.disputedRole}</span>
                     </div>
                   )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-slate-700">{pol.currentRole}</div>
                <div className="text-xs text-slate-400 font-medium">{pol.sphere}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <div className="text-sm font-bold text-slate-900">
                  {FORMATTER_BRL.format(pol.totalSpendingLastMandate)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {getRedFlagsIndicator(pol.redFlags)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                <div className="flex justify-center">
                   <EfficiencyBadge rating={pol.efficiencyRating} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ComparisonTable;