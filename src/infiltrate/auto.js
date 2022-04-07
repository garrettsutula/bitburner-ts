// auto-infiltrate-standalone.js
// by Oreo

// delays for setTimeout and setInterval above this threshold are not modified
const maxDelayCutoff = 30e3

// interval multiplier to apply during infiltrations (set to 1 to disable)
const infiltrationTimeFactor = 1

// URL to connect to local keypress server
const socketUrl = 'ws://localhost:59764'

function getWindow () {
  return [].map.constructor('return this')()
}

function getDocument () {
  return [].map.constructor('return this.document')()
}

let lastFactor
let _ns, _doc, _win

let lastLog
function logStable (str) {
  if (str === lastLog) return
  _ns.print(str)
  console.log(str)
  lastLog = str
}

function setTimeFactor (factor = 1) {
  if (factor === lastFactor) return false
  if (_win._setTimeout === undefined) { _win._setTimeout = _win.setTimeout }
  if (_win._setInterval === undefined) { _win._setInterval = _win.setInterval }
  if (factor === 1) {
    _win.setTimeout = _win._setTimeout
    _win.setInterval = _win._setInterval
    lastFactor = factor
    return true
  }
  _win.setTimeout = function (fn, delay, ...args) {
    if (delay < maxDelayCutoff) {
      _win._setTimeout(fn, Math.round(delay * factor), ...args)
    } else {
      _win._setTimeout(fn, delay, ...args)
    }
  }
  _win.setInterval = function (fn, delay, ...args) {
    if (delay < maxDelayCutoff) {
      _win._setInterval(fn, Math.round(delay * factor), ...args)
    } else {
      _win._setInterval(fn, delay, ...args)
    }
  }
  lastFactor = factor
  return true
}

function autoSetTimeFactor () {
  const levelElement = [..._doc.querySelectorAll('p')].filter(el => el.innerText.trim().match(/^Level:\s+\d+\s*\/\s*\d+$/))
  if (levelElement.length === 0) {
    if (setTimeFactor(1)) {
      logStable('Infiltration not detected: removing injection')
    }
  } else {
    if (setTimeFactor(infiltrationTimeFactor)) {
      logStable('Infiltration detected: injecting middleware')
    }
  }
}

// navigation functions for MinesweeperGame and Cyberpunk2077Game
function getPathSingle (size, startPt, endPt) {
  // handle wrapping
  for (let i = 0; i <= 1; i++) {
    if (Math.abs(startPt[i] - endPt[i]) > size / 2) {
      if (startPt[i] < endPt[i]) startPt[i] += size
      else endPt[i] += size
    }
  }
  let ret = ''
  // calculate x offset
  if (startPt[0] < endPt[0]) ret += 'd'.repeat(endPt[0] - startPt[0])
  else ret += 'a'.repeat(startPt[0] - endPt[0])
  // calculate y offset
  if (startPt[1] < endPt[1]) ret += 's'.repeat(endPt[1] - startPt[1])
  else ret += 'w'.repeat(startPt[1] - endPt[1])
  return ret
}

// function getPathMulti (size, points) {
//   // first, target all the points at once
//   let state = points.map(coord => {
//     return {
//       at: [0, 0],
//       target: coord,
//       remaining: [...points].filter(c => coord[0] !== c[0] && coord[1] !== c[1]),
//       distance: 0
//     }
//   })
//   // now iterate and add new targets as they're reached
//   let nextState
//   for (let distance = 0; distance < 1000; distance++) {
//     // TODO
//   }
// }

function getPathSequential (size, points, start = [0, 0]) {
  const ret = []
  const routePoints = [start, ...points]
  for (let i = 0; i < routePoints.length - 1; i++) {
    ret.push(getPathSingle(size, routePoints[i], routePoints[i + 1]))
  }
  return ret
}

function getGridX (node) {
  let x = 0
  while (node.previousSibling !== null) {
    node = node.previousSibling
    x += 1
  }
  return x
}

function getGridY (node) {
  let y = 0
  node = node.parentNode.parentNode
  while (node.previousSibling?.tagName === 'DIV') {
    node = node.previousSibling
    y += 1
  }
  return y
}

class InfiltrationManager {
  constructor (ns) {
    const self = this
    /* eslint-disable no-undef */
    self.ws = new WebSocket(socketUrl)
    /* eslint-enable */
    self.ws.onopen = () => {
      self.automationEnabled = true
      _ns.print('Websocket connection established: full automation enabled.')
    }
    self.ws.onerror = event => {
      self.automationEnabled = false
      _ns.print(`Warning: websocket is not connected: ${JSON.stringify(event)}`)
    }
  }

  async cyberpunk () {
    const getTargetElement = () => [..._doc.querySelectorAll('h5')].filter(e => e.innerText.includes('Targets:'))[0]
    let targetElement = getTargetElement()
    if (!targetElement) return
    logStable('Game active: Cyberpunk2077 game')
    const targetValues = targetElement.innerText.split('Targets: ')[1].trim().split(/\s+/)
    const routePoints = []
    let size
    console.log('Target values: ' + targetValues)
    // get coords of each target
    for (const target of targetValues) {
      const node = [...targetElement.parentElement.querySelectorAll('div p span')].filter(el => el.innerText.trim() === target)[0]
      size = node.parentNode.childElementCount
      routePoints.push([getGridX(node), getGridY(node)])
    }
    const pathStr = getPathSequential(size, routePoints).join(' ') + ' '
    console.log(`Sending path: '${pathStr}'`)
    this.ws.send(pathStr)
    while (targetElement !== undefined) {
      await _ns.asleep(100 / infiltrationTimeFactor)
      targetElement = getTargetElement()
    }
  }

  async oldMines () {
    const minePlots = [..._doc.querySelectorAll('span')].filter(el => el.innerText.trim().match(/^\[[X.\s?]\]$/))
    if (minePlots.length === 0) return
    logStable('Game active: Minesweeper game')
    // outline mines
    minePlots.filter(el => el.innerText.trim().match(/^\[\?\]$/)).forEach(function (el) { el.style.outline = '2px red solid' })
    // remove outline from marked mines
    minePlots.filter(el => el.innerText.trim().match(/^\[\.\]$/)).forEach(function (el) { el.style.outline = '' })
  }

  async mines () {
    const isMemoryPhase = () => [..._doc.querySelectorAll('h4')].some(e => e.innerText === 'Remember all the mines!')
    const isMarkPhase = () => [..._doc.querySelectorAll('h4')].some(e => e.innerText === 'Mark all the mines!')
    if (!isMemoryPhase()) return
    logStable('Game active: Minesweeper game')
    const gridElements = [..._doc.querySelectorAll('span')].filter(el => el.innerText.trim().match(/^\[[X.\s?]\]$/))
    if (gridElements.length === 0) return
    // get size
    const size = gridElements[0].parentNode.childElementCount
    // get coordinates for each mine
    const mineCoords = gridElements.filter(el => el.innerText.trim().match(/^\[\?\]$/)).map(el => [getGridX(el), getGridY(el)])
    // wait for mark phase
    while (isMemoryPhase()) {
      await _ns.asleep(100 / infiltrationTimeFactor)
    }
    // send solution string
    const pathStr = getPathSequential(size, mineCoords).join(' ') + ' '
    console.log(`Mine solution string: ${pathStr}`)
    this.ws.send(pathStr)
    // wait for end
    while (isMarkPhase()) {
      await _ns.asleep(100 / infiltrationTimeFactor)
    }
  }

  async slash () {
    const self = this
    if (!self.automationEnabled) return
    const getActiveElement = () => [..._doc.querySelectorAll('h4')].filter(e => e.innerText === 'Slash when his guard is down!')[0]
    let activeElement = getActiveElement()
    while (activeElement !== undefined) {
      logStable('Game active: Slash game')
      if (activeElement.nextSibling.innerText === 'ATTACKING!') {
        self.ws.send(' ')
      }
      await _ns.asleep(50 / infiltrationTimeFactor)
      activeElement = getActiveElement()
    }
  }

  async brackets () {
    const self = this
    if (!self.automationEnabled) return
    const getActiveElement = () => [..._doc.querySelectorAll('h4')].filter(e => e.innerText === 'Close the brackets')[0]
    let activeElement = getActiveElement()
    if (activeElement === undefined) return
    logStable('Game active: Bracket game')
    const bracketText = activeElement.nextSibling.innerText
    const closeText = bracketText.split('').reverse().join('')
      .replaceAll('<', '>')
      .replaceAll('(', ')')
      .replaceAll('[', ']')
      .replaceAll('{', '}')
    self.ws.send(closeText)
    while (activeElement !== undefined) {
      activeElement = getActiveElement()
      await _ns.asleep(100 / infiltrationTimeFactor)
    }
  }

  async cheatCode () {
    const self = this
    if (!self.automationEnabled) return
    const arrowsMap = { '↑': 'w', '→': 'd', '↓': 's', '←': 'a' }
    const getActiveElement = () => [..._doc.querySelectorAll('h4')].filter(e => e.innerText === 'Enter the Code!')[0]
    let activeElement = getActiveElement()
    let lastArrow
    while (activeElement !== undefined) {
      logStable('Game active: Cheat Code game')
      const arrow = activeElement?.nextSibling?.innerText
      if (arrow !== lastArrow) {
        if (arrow in arrowsMap) {
          self.ws.send(arrowsMap[arrow])
          // logStable(`Sent '${arrowsMap[arrow]}'`)
          lastArrow = arrow
        } else {
          return
        }
      }
      activeElement = getActiveElement()
      await _ns.asleep(50 / infiltrationTimeFactor)
    }
  }

  async backwardGame () {
    const self = this
    if (!self.automationEnabled) return
    const getActiveElement = () => [..._doc.querySelectorAll('h4')].filter(e => e.innerText === 'Type it backward')[0]
    let activeElement = getActiveElement()
    if (activeElement === undefined) return
    logStable('Game active: Backward game')
    const text = activeElement.parentNode.nextSibling.children[0].innerText
    self.ws.send(text.toLowerCase())
    while (activeElement !== undefined) {
      activeElement = getActiveElement()
      await _ns.asleep(100 / infiltrationTimeFactor)
    }
  }

  async bribeGame () {
    const self = this
    if (!self.automationEnabled) return
    const getActiveElement = () => [..._doc.querySelectorAll('h4')].filter(e => e.innerText === 'Say something nice about the guard.')[0]
    let activeElement = getActiveElement()
    // if (activeElement === undefined) return
    let lastWord
    const positive = [
      'affectionate',
      'agreeable',
      'bright',
      'charming',
      'creative',
      'determined',
      'energetic',
      'friendly',
      'funny',
      'generous',
      'polite',
      'likable',
      'diplomatic',
      'helpful',
      'giving',
      'kind',
      'hardworking',
      'patient',
      'dynamic',
      'loyal'
    ]
    while (activeElement !== undefined) {
      logStable('Game active: Bribe game')
      const currentWord = activeElement.parentNode.nextSibling.children[1].innerText
      if (positive.includes(currentWord)) {
        self.ws.send(' ')
      } else if (lastWord !== currentWord) {
        self.ws.send('w')
        lastWord = currentWord
      }
      activeElement = getActiveElement()
      await _ns.asleep(50 / infiltrationTimeFactor)
    }
  }

  async wireCuttingGame () {
    const self = this
    if (!self.automationEnabled) return
    const getActiveElement = () => [..._doc.querySelectorAll('h4')].filter(e => e.innerText.includes('Cut the wires'))[0]
    const activeElement = getActiveElement()
    if (activeElement === undefined) return
    logStable('Game active: Wire Cutting game')
    // extract hints
    const hints = [...activeElement.parentNode.children].filter(el => el.tagName === 'P').map(el => el.innerText).join('')
    const colorHints = hints.match(/(?<=colored ).+?(?=\.)/g)
      .map(s => { return { white: 'white', blue: 'blue', red: 'red', yellow: 'rgb(255, 193, 7)' }[s] })
    const numberHints = hints.match(/(?<=number ).+?(?=\.)/g)
    const solution = new Set()
    numberHints.forEach(n => { solution.add(n) })
    // find the first div containing wire spans
    let wireDiv = activeElement
    while (wireDiv.tagName !== 'DIV') {
      wireDiv = wireDiv.nextSibling
    }
    // check first row of wire spans
    const wireCount = wireDiv.firstElementChild.childElementCount
    for (let i = 0; i < wireCount; i++) {
      if (colorHints.includes(wireDiv.firstElementChild.children[i].style.color)) {
        solution.add((i + 1).toString())
      }
    }
    // repeat for second row
    wireDiv = wireDiv.nextSibling
    for (let i = 0; i < wireCount; i++) {
      if (colorHints.includes(wireDiv.firstElementChild.children[i].style.color)) {
        solution.add((i + 1).toString())
      }
    }
    // send solution string
    const solutionStr = Array.from(solution).join('')
    console.log(`Sending solution: ${solutionStr}`)
    this.ws.send(solutionStr)
    // wait for end
    while (getActiveElement() !== undefined) {
      await _ns.asleep(100 / infiltrationTimeFactor)
    }
  }

  async start () {
    const self = this
    while (!self.canceled) {
      await _ns.asleep(50)
      // Adjust time speed if we're infiltrating
      autoSetTimeFactor()
      // Match the symbols!
      await self.cyberpunk()
      // Mark all the mines!
      await self.mines()
      // Slash when his guard is down!
      await self.slash()
      // Close the brackets
      await self.brackets()
      // Enter the code
      await self.cheatCode()
      // Type it backward
      await self.backwardGame()
      // Say something nice about the guard
      await self.bribeGame()
      // Cut the wires
      await self.wireCuttingGame()
    }
  }
}

export async function main (ns) {
  ns.disableLog('ALL')
  _ns = ns
  _doc = getDocument()
  _win = getWindow()

  await new InfiltrationManager(ns).start()
}
