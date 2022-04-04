import { NS } from '@ns'
import { getSymbolServer } from '/stocks/servers';
import { getAllStocks } from '/stocks/stocks';

// file: stock-trader.js

// requires 4s Market Data TIX API Access

// defines if stocks can be shorted (see BitNode 8)
const shortAvailable = false;

const commission = 100000;

export async function main(ns : NS) : Promise<void> {
  ns.disableLog("ALL");

  while (true) {
      tendStocks(ns);
      await ns.sleep(5 * 1000);
  }
}


function tendStocks(ns: NS) {
    ns.print("");
    const stocks = getAllStocks(ns);

    stocks.sort((a, b) => b.profitPotential as number - (a.profitPotential as number));

    const longStocks = new Set<string>();
    const shortStocks = new Set<string>();
    let overallValue = 0;

    for (const stock of stocks) {
        if (stock.longShares > 0  && stock.cost && stock.profit) {
            if (stock.forecast > 0.5) {
                longStocks.add(stock.symbol);
                ns.print(`INFO ${stock.summary} LONG ${ns.nFormat(stock.cost + stock.profit, "0.0a")} ${ns.nFormat(100 * stock.profit / stock.cost, "0.00")}%`);
                overallValue += (stock.cost + stock.profit);
            }
            else {
                const salePrice = ns.stock.sell(stock.symbol, stock.longShares);
                const saleTotal = salePrice * stock.longShares;
                const saleCost = stock.longPrice * stock.longShares;
                const saleProfit = saleTotal - saleCost - 2 * commission;
                stock.shares = 0;
                shortStocks.add(stock.symbol);
                ns.print(`WARN ${stock.summary} SOLD for ${ns.nFormat(saleProfit, "$0.0a")} profit`);
            }
        }
        if (stock.shortShares > 0  && stock.cost && stock.profit) {
            if (stock.forecast < 0.5) {
                shortStocks.add(stock.symbol);
                ns.print(`INFO ${stock.summary} SHORT ${ns.nFormat(stock.cost + stock.profit, "0.0a")} ${ns.nFormat(100 * stock.profit / stock.cost, "0.00")}%`);
                overallValue += (stock.cost + stock.profit);
            }
            else {
                const salePrice = ns.stock.sellShort(stock.symbol, stock.shortShares);
                const saleTotal = salePrice * stock.shortShares;
                const saleCost = stock.shortPrice * stock.shortShares;
                const saleProfit = saleTotal - saleCost - 2 * commission;
                stock.shares = 0;
                longStocks.add(stock.symbol);
                ns.print(`WARN ${stock.summary} SHORT SOLD for ${ns.nFormat(saleProfit, "$0.0a")} profit`);
            }
        }
    }

    for (const stock of stocks) {
        const money = ns.getServerMoneyAvailable("home");
        //ns.print(`INFO ${stock.summary}`);
        if (stock.forecast > 0.55) {
            longStocks.add(stock.symbol);
            //ns.print(`INFO ${stock.summary}`);
            if (money > 500 * commission) {
                const sharesToBuy = Math.min(stock.maxShares, Math.floor((money - commission) / stock.askPrice));
                if (ns.stock.buy(stock.symbol, sharesToBuy) > 0) {
                    ns.print(`WARN ${stock.summary} LONG BOUGHT ${ns.nFormat(sharesToBuy, "$0.0a")}`);
                }
            }
        }
        else if (stock.forecast < 0.45 && shortAvailable) {
            shortStocks.add(stock.symbol);
            //ns.print(`INFO ${stock.summary}`);
            if (money > 500 * commission) {
                const sharesToBuy = Math.min(stock.maxShares, Math.floor((money - commission) / stock.bidPrice));
                if (ns.stock.short(stock.symbol, sharesToBuy) > 0) {
                    ns.print(`WARN ${stock.summary} SHORT BOUGHT ${ns.nFormat(sharesToBuy, "$0.0a")}`);
                }
            }
        }
    }
    ns.print("Stock value: " + ns.nFormat(overallValue, "$0.0a"));

    // send stock market manipulation orders to hack manager
    const growStockPort = ns.getPortHandle(1); // port 1 is grow
    const hackStockPort = ns.getPortHandle(2); // port 2 is hack
    if (growStockPort.empty() && hackStockPort.empty()) {
        // only write to ports if empty
        for (const symbol of longStocks) {
            //ns.print("INFO grow " + symbol);
            growStockPort.write(getSymbolServer(symbol));
        }
        for (const symbol of shortStocks) {
            //ns.print("INFO hack " + symbol);
            hackStockPort.write(getSymbolServer(symbol));
        }
    }
}



