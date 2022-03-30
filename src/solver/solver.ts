import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  const contracts = JSON.parse(ns.read('/data/controlledHosts.txt')).flatMap((server) => {
    const onServer = ns.ls(server, '.cct').map((contract) => {
      const type = ns.codingcontract.getContractType(contract, server);
      const data = ns.codingcontract.getData(contract, server);
      const didSolve = solve(type, data, server, contract, ns);
      return `${server} - ${contract} - ${type} - ${didSolve || 'FAILED!'}`;
    });
    return onServer;
  });
  ns.tprint(`Found ${contracts.length} contracts`);
  contracts.forEach((contract) => ns.tprint(contract));
}

// ALGORITHMIC STOCK TRADER

function maxProfit(arrayData) {
  let i; let j; let
    k;

  const maxTrades = arrayData[0];
  const stockPrices = arrayData[1];

  // WHY?
  let tempStr = '[0';
  for (i = 0; i < stockPrices.length; i += 1) {
    tempStr += ',0';
  }
  tempStr += ']';
  let tempArr = `[${tempStr}`;
  for (i = 0; i < maxTrades - 1; i += 1) {
    tempArr += `,${tempStr}`;
  }
  tempArr += ']';

  const highestProfit = JSON.parse(tempArr);

  for (i = 0; i < maxTrades; i += 1) {
    for (j = 0; j < stockPrices.length; j += 1) { // Buy / Start
      for (k = j; k < stockPrices.length; k += 1) { // Sell / End
        if (i > 0 && j > 0 && k > 0) {
          highestProfit[i][k] = Math.max(
            highestProfit[i][k],
            highestProfit[i - 1][k],
            highestProfit[i][k - 1],
            highestProfit[i - 1][j - 1] + stockPrices[k] - stockPrices[j],
          );
        } else if (i > 0 && j > 0) {
          highestProfit[i][k] = Math.max(
            highestProfit[i][k],
            highestProfit[i - 1][k],
            highestProfit[i - 1][j - 1] + stockPrices[k] - stockPrices[j],
          );
        } else if (i > 0 && k > 0) {
          highestProfit[i][k] = Math.max(
            highestProfit[i][k],
            highestProfit[i - 1][k],
            highestProfit[i][k - 1],
            stockPrices[k] - stockPrices[j],
          );
        } else if (j > 0 && k > 0) {
          highestProfit[i][k] = Math.max(
            highestProfit[i][k],
            highestProfit[i][k - 1],
            stockPrices[k] - stockPrices[j],
          );
        } else {
          highestProfit[i][k] = Math.max(highestProfit[i][k], stockPrices[k] - stockPrices[j]);
        }
      }
    }
  }
  return highestProfit[maxTrades - 1][stockPrices.length - 1];
}

// SMALLEST TRIANGLE SUM

function solveTriangleSum(arrayData) {
  const triangle = arrayData;
  let nextArray;
  let previousArray = triangle[0];

  for (let i = 1; i < triangle.length; i += 1) {
    nextArray = [];
    for (let j = 0; j < triangle[i].length; j += 1) {
      if (j === 0) {
        nextArray.push(previousArray[j] + triangle[i][j]);
      } else if (j === triangle[i].length - 1) {
        nextArray.push(previousArray[j - 1] + triangle[i][j]);
      } else {
        nextArray.push(Math.min(previousArray[j], previousArray[j - 1]) + triangle[i][j]);
      }
    }

    previousArray = nextArray;
  }

  return Math.min.apply(null, nextArray);
}

// UNIQUE PATHS IN A GRID

function factorialDivision(n, d) {
  if (n === 0 || n === 1 || n === d) { return 1; }
  return factorialDivision(n - 1, d) * n;
}

function factorial(n) {
  return factorialDivision(n, 1);
}

function uniquePathsI(grid) {
  const rightMoves = grid[0] - 1;
  const downMoves = grid[1] - 1;

  return Math.round(factorialDivision(rightMoves + downMoves, rightMoves) / (factorial(downMoves)));
}

function uniquePathsII(grid, ignoreFirst = false, ignoreLast = false) {
  const rightMoves = grid[0].length - 1;
  const downMoves = grid.length - 1;

  let totalPossiblePaths = Math.round(
    factorialDivision(rightMoves + downMoves, rightMoves) / (factorial(downMoves)),
  );

  for (let i = 0; i < grid.length; i += 1) {
    for (let j = 0; j < grid[i].length; j += 1) {
      if (
        grid[i][j] === 1
          && (!ignoreFirst || (i !== 0 || j !== 0))
          && (!ignoreLast || (i !== grid.length - 1 || j !== grid[i].length - 1))) {
        const newArray = [];
        for (let k = i; k < grid.length; k += 1) {
          newArray.push(grid[k].slice(j, grid[i].length));
        }

        let removedPaths = uniquePathsII(newArray, true, ignoreLast);
        removedPaths *= uniquePathsI([i + 1, j + 1]);

        totalPossiblePaths -= removedPaths;
      }
    }
  }

  return totalPossiblePaths;
}

// GENERATE IP ADDRESSES

function isValidIpSegment(segment) {
  if (segment[0] === '0' && segment !== '0') return false;
  segment = Number(segment);
  if (segment < 0 || segment > 255) return false;
  return true;
}

function generateIps(num) {
  num = num.toString();

  const { length } = num;

  const ips = [];

  for (let i = 1; i < length - 2; i += 1) {
    for (let j = i + 1; j < length - 1; j += 1) {
      for (let k = j + 1; k < length; k += 1) {
        const ip = [
          num.slice(0, i),
          num.slice(i, j),
          num.slice(j, k),
          num.slice(k, num.length),
        ];
        let isValid = true;

        ip.forEach((seg) => {
          isValid = isValid && isValidIpSegment(seg);
        });

        if (isValid) ips.push(ip.join('.'));
      }
    }
  }

  return ips;
}

// GREATEST FACTOR

function factor(num) {
  for (let div = 2; div <= Math.sqrt(num); div += 1) {
    if (num % div === 0) {
      num /= div;
      div = 2;
    }
  }
  return num;
}

// SPIRALIZE Matrix

function column(arr, index) {
  const res = [];
  for (let i = 0; i < arr.length; i += 1) {
    const elm = arr[i].splice(index, 1)[0];
    if (elm) {
      res.push(elm);
    }
  }
  return res;
}

function spiral(arr, accum = []) {
  if (arr.length === 0 || arr[0].length === 0) {
    return accum;
  }
  accum = accum.concat(arr.shift());
  if (arr.length === 0 || arr[0].length === 0) {
    return accum;
  }
  accum = accum.concat(column(arr, arr[0].length - 1));
  if (arr.length === 0 || arr[0].length === 0) {
    return accum;
  }
  accum = accum.concat(arr.pop().reverse());
  if (arr.length === 0 || arr[0].length === 0) {
    return accum;
  }
  accum = accum.concat(column(arr, 0).reverse());
  if (arr.length === 0 || arr[0].length === 0) {
    return accum;
  }
  return spiral(arr, accum);
}

// Merge Overlapping Intervals

function mergeOverlap(intervals) {
  intervals.sort(([minA], [minB]) => minA - minB);
  for (let i = 0; i < intervals.length; i += 1) {
    for (let j = i + 1; j < intervals.length; j += 1) {
      const [min, max] = intervals[i];
      const [laterMin, laterMax] = intervals[j];
      if (laterMin <= max) {
        const newMax = laterMax > max ? laterMax : max;
        const newInterval = [min, newMax];
        intervals[i] = newInterval;
        intervals.splice(j, 1);
        j = i;
      }
    }
  }
  return intervals;
}

function solve(type, data, server, contract, ns) {
  let solution = '';
  ns.tprint(type);
  switch (type) {
    case 'Algorithmic Stock Trader I':
      solution = maxProfit([1, data]);
      break;
    case 'Algorithmic Stock Trader II':
      solution = maxProfit([Math.ceil(data.length / 2), data]);
      break;
    case 'Algorithmic Stock Trader III':
      solution = maxProfit([2, data]);
      break;
    case 'Algorithmic Stock Trader IV':
      solution = maxProfit(data);
      break;
    case 'Minimum Path Sum in a Triangle':
      solution = solveTriangleSum(data, ns);
      break;
    case 'Unique Paths in a Grid I':
      solution = uniquePathsI(data);
      break;
    case 'Unique Paths in a Grid II':
      solution = uniquePathsII(data);
      break;
    case 'Generate IP Addresses':
      solution = generateIps(data);
      break;
    case 'Find Largest Prime Factor':
      solution = factor(data);
      break;
    case 'Spiralize Matrix':
      solution = spiral(data);
      break;
    case 'Merge Overlapping Intervals':
      solution = mergeOverlap(data);
      break;
    default:
      throw new Error(`Unknown case: ${type}`);
  }
  return (solution !== '') ? ns.codingcontract.attempt(solution, contract, server, [true]) : '';
}
