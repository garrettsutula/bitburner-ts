export interface Stock {
  symbol: string;
  longShares: number;
  shortShares: number;
  longPrice: number;
  shortPrice: number;
  forecast: number;
  volatility: number
  askPrice: number;
  bidPrice:  number;
  maxShares: number;
  profit?: number;
  cost?: number;
  profitPotential?: number;
  shares?: number;
  summary?: string;
}