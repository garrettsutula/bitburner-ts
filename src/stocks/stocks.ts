import { NS } from '@ns'
import { Stock } from '/models/stocks';

const commission = 100000;

export function getAllStocks(ns: NS): Stock[] {
  // make a lookup table of all stocks and all their properties
  const stockSymbols = ns.stock.getSymbols();
  const stocks: Stock[] = [];
  for (const sym of stockSymbols) {

      const pos = ns.stock.getPosition(sym);
      const stock: Stock = {
          symbol: sym,
          longShares: pos[0],
          longPrice: pos[1],
          shortShares: pos[2],
          shortPrice: pos[3],
          forecast: ns.stock.getForecast(sym),
          volatility: ns.stock.getVolatility(sym),
          askPrice: ns.stock.getAskPrice(sym),
          bidPrice: ns.stock.getBidPrice(sym),
          maxShares: ns.stock.getMaxShares(sym),
      };

      const longProfit = stock.longShares * (stock.bidPrice - stock.longPrice) - 2 * commission;
      const shortProfit = stock.shortShares * (stock.shortPrice - stock.askPrice) - 2 * commission;
      stock.profit = longProfit + shortProfit;
      stock.cost = (stock.longShares * stock.longPrice) + (stock.shortShares * stock.shortPrice)

      // profit potential as chance for profit * effect of profit
      const profitChance = 2 * Math.abs(stock.forecast - 0.5);
      const profitPotential = profitChance * (stock.volatility);
      stock.profitPotential = profitPotential;

      stock.summary = `${stock.symbol}: ${stock.forecast.toFixed(3)} ± ${stock.volatility.toFixed(3)}`;
      stocks.push(stock);
  }
  return stocks;
}