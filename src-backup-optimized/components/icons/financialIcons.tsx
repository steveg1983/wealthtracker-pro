import { memo } from 'react';
import {
  IconWallet,
  IconCreditCard,
  IconBuildingBank,
  IconCashBanknote,
  IconReceipt,
  IconPigMoney,
  IconCoins,
  IconCurrencyDollar,
  IconCurrencyPound,
  IconBusinessplan,
  IconReportMoney,
  IconMoneybag,
  IconBuilding,
  IconBriefcase,
  IconFileInvoice,
  IconTrendingUp,
  IconTrendingDown,
} from '@tabler/icons-react';
import { createIconComponent } from './iconUtils';

/**
 * Financial and banking icons module
 * Extracted from index.tsx for better organization
 */

// Core Financial Icons
export const WalletIcon = memo(createIconComponent(IconWallet, 'WalletIcon'));
export const CreditCardIcon = memo(createIconComponent(IconCreditCard, 'CreditCardIcon'));
export const BanknoteIcon = memo(createIconComponent(IconCashBanknote, 'BanknoteIcon'));
export const PiggyBankIcon = memo(createIconComponent(IconPigMoney, 'PiggyBankIcon'));
export const DollarSignIcon = memo(createIconComponent(IconCurrencyDollar, 'DollarSignIcon'));
export const PoundSterlingIcon = memo(createIconComponent(IconCurrencyPound, 'PoundSterlingIcon'));
export const ReceiptIcon = memo(createIconComponent(IconReceipt, 'ReceiptIcon'));

// Banking & Business Icons
export const BankIcon = memo(createIconComponent(IconBuildingBank, 'BankIcon'));
export const LandmarkIcon = memo(createIconComponent(IconBuildingBank, 'LandmarkIcon'));
export const Building2Icon = memo(createIconComponent(IconBuilding, 'Building2Icon'));
export const BriefcaseIcon = memo(createIconComponent(IconBriefcase, 'BriefcaseIcon'));

// Trending & Market Icons
export const TrendingUpIcon = memo(createIconComponent(IconTrendingUp, 'TrendingUpIcon'));
export const TrendingDownIcon = memo(createIconComponent(IconTrendingDown, 'TrendingDownIcon'));

// Currency Icons
export const CoinsIcon = memo(createIconComponent(IconCoins, 'CoinsIcon'));