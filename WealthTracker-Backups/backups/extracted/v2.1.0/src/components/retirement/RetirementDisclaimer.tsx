import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useRegionalSettings } from '../../hooks/useRegionalSettings';

export default function RetirementDisclaimer(): React.JSX.Element {
  const { region } = useRegionalSettings();

  return (
    <div className="mt-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" size={20} />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            {region === 'UK' ? 'Important Information' : 'Important Disclaimer'}
          </h3>
          
          {region === 'UK' ? (
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-3">
              <p>
                <strong>These retirement planning tools are for illustrative purposes only</strong> and the figures 
                shown may be higher or lower than those actually achieved. They should not be regarded as personal advice.
              </p>
              
              <p>
                Your final pension fund and the income available will depend on a number of factors including:
              </p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Fund performance, contributions made, charges, inflation</li>
                <li>Your retirement age and the amount you withdraw from your pensions</li>
                <li>Tax rules and mortality rates</li>
                <li>Annuity rates at the time you retire (if purchasing an annuity)</li>
              </ul>
              
              <p>
                <strong>Investment risks:</strong> As with all investments, the value can fall as well as rise, 
                therefore you may get back less than you invest. Past performance is not a guide to future performance.
              </p>
              
              <p>
                <strong>Assumptions:</strong> We have used an expected growth rate of 5-7% p.a. which is the expected 
                return of our growth portfolio modelled on current market conditions. This includes a fund charge of 
                0.11% p.a. and inflation of 2.9% p.a. Other charges may apply which may affect the value of your 
                pension and the amount of income available.
              </p>
              
              <p>
                <strong>State Pension:</strong> The state pension shown is based on the current full new State Pension 
                for the 2024/25 tax year. Your actual state pension may be higher or lower than this figure. 
                The state pension age shown is based on current legislation and may change.
              </p>
              
              <p>
                <strong>Tax considerations:</strong> This calculator does not take account of tax charges which may 
                apply to withdrawals or to contributions that exceed your allowances. Prevailing tax rates and reliefs 
                depend on your individual circumstances and are subject to change.
              </p>
              
              <p className="font-medium text-amber-800 dark:text-amber-200">
                <strong>Important:</strong> This is not regulated financial advice. The information provided by these 
                tools does not constitute financial advice and you should consider seeking independent financial advice 
                from an FCA-authorised adviser if you're unsure about the suitability of an investment or pension product.
              </p>
              
              <p>
                Regular contributions are assumed to be personal contributions increased in line with inflation and 
                include the tax relief associated with a basic rate taxpayer. If you are a higher or additional rate 
                taxpayer you may be eligible for higher amounts of tax relief.
              </p>
            </div>
          ) : (
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-3">
              <p>
                <strong>These retirement planning calculators are designed to be informational and educational tools only.</strong> When 
                used alone, they do not constitute investment advice. The results presented are hypothetical and may not 
                reflect the actual growth of your own investments.
              </p>
              
              <p>
                <strong>Key assumptions and limitations:</strong>
              </p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Results are rough approximations of future financial performance</li>
                <li>Actual results will vary based on market conditions, fund selection, and fees</li>
                <li>Inflation estimates may not reflect actual future inflation rates</li>
                <li>Tax laws are complex and subject to change</li>
                <li>Life expectancy assumptions may not match your individual situation</li>
              </ul>
              
              <p>
                <strong>Investment risks:</strong> All investments involve risk, including the potential loss of principal. 
                Past performance does not guarantee future results. The value of investments will fluctuate, and you may 
                get back less than you invest.
              </p>
              
              <p>
                <strong>Social Security:</strong> The Social Security benefits shown are estimates based on current law. 
                Your actual benefits may differ based on your earnings history, claiming age, and future changes to 
                Social Security rules.
              </p>
              
              <p>
                <strong>Tax considerations:</strong> This calculator provides general information only. It does not provide 
                tax advice. Tax laws are complex and change regularly. The impact of taxes on your retirement savings and 
                income will depend on your individual circumstances.
              </p>
              
              <p>
                <strong>Medicare and healthcare costs:</strong> Healthcare costs in retirement can be substantial and highly 
                variable. The Medicare planning estimates shown are based on current premiums and may not reflect your 
                actual healthcare costs in retirement.
              </p>
              
              <p className="font-medium text-amber-800 dark:text-amber-200">
                <strong>Important:</strong> We strongly recommend that you seek the advice of a qualified financial services 
                professional before making any type of investment or financial planning decision. Consider consulting with 
                qualified financial advisors, tax professionals, and estate planning attorneys who can provide personalized 
                advice based on your individual circumstances.
              </p>
              
              <p>
                Neither WealthTracker nor its affiliates are responsible for any decisions or actions taken in reliance 
                upon or as a result of the information provided by these tools. We are not responsible for any human or 
                mechanical errors or omissions.
              </p>
            </div>
          )}
          
          <div className="mt-4 pt-4 border-t border-amber-300 dark:border-amber-700">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              <strong>Last updated:</strong> {new Date().toLocaleDateString(region === 'UK' ? 'en-GB' : 'en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} | 
              <strong> Region:</strong> {region === 'UK' ? 'United Kingdom' : 'United States'} | 
              <strong> Tax year:</strong> {region === 'UK' ? '2024/25' : '2024'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}