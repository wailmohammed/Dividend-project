import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useUserSettings } from './useUserSettings';
import { toast } from 'sonner';

export interface StateTaxRate {
  id: string;
  state_code: string;
  state_name: string;
  income_tax_rate: number;
  capital_gains_rate: number | null;
  has_separate_cg_rate: boolean;
  notes: string | null;
}

export const useStateTaxRates = () => {
  const { user } = useAuth();
  const { settings, updateSettings } = useUserSettings();
  const [states, setStates] = useState<StateTaxRate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('state_tax_rates')
        .select('*')
        .order('state_name');

      if (error) throw error;
      setStates((data || []) as StateTaxRate[]);
    } catch (err) {
      console.error('Failed to fetch state tax rates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStates();
  }, [fetchStates]);

  const setUserState = async (stateCode: string) => {
    const state = states.find(s => s.state_code === stateCode);
    if (!state) return;

    try {
      await updateSettings({
        state_code: stateCode,
        state_tax_rate: state.has_separate_cg_rate && state.capital_gains_rate 
          ? state.capital_gains_rate 
          : state.income_tax_rate
      } as any);
      toast.success(`State set to ${state.state_name}`);
    } catch (err) {
      toast.error('Failed to update state');
    }
  };

  const setCustomRate = async (stateCode: string, customRate: number) => {
    try {
      await updateSettings({
        state_code: stateCode,
        state_tax_rate: customRate
      } as any);
      toast.success('Custom tax rate saved');
    } catch (err) {
      toast.error('Failed to update tax rate');
    }
  };

  const getCurrentState = () => {
    if (!settings?.state_code) return null;
    return states.find(s => s.state_code === settings.state_code);
  };

  const calculateStateTax = (
    shortTermGains: number, 
    longTermGains: number, 
    stateCode?: string
  ) => {
    const state = stateCode 
      ? states.find(s => s.state_code === stateCode)
      : getCurrentState();
    
    if (!state) {
      const rate = Number(settings?.state_tax_rate) || 0;
      return {
        stateCode: settings?.state_code || null,
        stateName: null,
        shortTermTax: shortTermGains * (rate / 100),
        longTermTax: longTermGains * (rate / 100),
        totalStateTax: (shortTermGains + longTermGains) * (rate / 100),
        effectiveRate: rate
      };
    }

    const shortTermRate = state.income_tax_rate;
    const longTermRate = state.has_separate_cg_rate && state.capital_gains_rate !== null
      ? state.capital_gains_rate
      : state.income_tax_rate;

    const shortTermTax = shortTermGains * (shortTermRate / 100);
    const longTermTax = longTermGains * (longTermRate / 100);

    return {
      stateCode: state.state_code,
      stateName: state.state_name,
      shortTermTax,
      longTermTax,
      totalStateTax: shortTermTax + longTermTax,
      effectiveRate: state.income_tax_rate,
      hasSeperateCGRate: state.has_separate_cg_rate,
      capitalGainsRate: state.capital_gains_rate
    };
  };

  const calculateDividendTax = (dividendIncome: number, qualifiedDividends: number = 0) => {
    const ordinaryDividends = dividendIncome - qualifiedDividends;
    const federalRate = Number(settings?.federal_tax_rate) || 22;
    const dividendRate = Number(settings?.dividend_tax_rate) || federalRate;
    const qualifiedRate = Number(settings?.qualified_dividend_rate) || 15;
    
    const stateRate = Number(settings?.state_tax_rate) || 0;

    const ordinaryFederalTax = ordinaryDividends * (dividendRate / 100);
    const qualifiedFederalTax = qualifiedDividends * (qualifiedRate / 100);
    const stateTax = dividendIncome * (stateRate / 100);

    return {
      ordinaryDividends,
      qualifiedDividends,
      ordinaryFederalTax,
      qualifiedFederalTax,
      stateTax,
      totalTax: ordinaryFederalTax + qualifiedFederalTax + stateTax,
      effectiveFederalRate: dividendRate,
      effectiveQualifiedRate: qualifiedRate,
      effectiveStateRate: stateRate,
      netAfterTax: dividendIncome - (ordinaryFederalTax + qualifiedFederalTax + stateTax)
    };
  };

  const setFederalRate = async (rate: number) => {
    try {
      await updateSettings({ federal_tax_rate: rate } as any);
      toast.success('Federal tax rate saved');
    } catch (err) {
      toast.error('Failed to update federal tax rate');
    }
  };

  const setDividendRate = async (rate: number) => {
    try {
      await updateSettings({ dividend_tax_rate: rate } as any);
      toast.success('Dividend tax rate saved');
    } catch (err) {
      toast.error('Failed to update dividend tax rate');
    }
  };

  const setQualifiedDividendRate = async (rate: number) => {
    try {
      await updateSettings({ qualified_dividend_rate: rate } as any);
      toast.success('Qualified dividend rate saved');
    } catch (err) {
      toast.error('Failed to update qualified dividend rate');
    }
  };

  return {
    states,
    loading,
    setUserState,
    setCustomRate,
    getCurrentState,
    calculateStateTax,
    calculateDividendTax,
    setFederalRate,
    setDividendRate,
    setQualifiedDividendRate,
    userStateCode: settings?.state_code,
    userStateTaxRate: settings?.state_tax_rate,
    federalTaxRate: settings?.federal_tax_rate ?? 0,
    dividendTaxRate: settings?.dividend_tax_rate ?? 0,
    qualifiedDividendRate: settings?.qualified_dividend_rate ?? 0
  };
};
