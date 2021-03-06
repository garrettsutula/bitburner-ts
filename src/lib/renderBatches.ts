import { Job, Task } from '/models/procedure';

const startTime = Date.now();
/** Convert timestamps to seconds since the graph was started. This resolution works for about 24 hours. */

interface ElementDeclaration {
  tagName: string;
  attributes ? : {
      [key: string]: unknown
    },
    children ? : ElementDeclaration[];
  content ? : string;
}

function convertTime(t: number, t0 = startTime) {
  return ((t - t0) / 1000);
}

function convertSecToPx(t: number) {
  return t * WIDTH_PIXELS / WIDTH_SECONDS;
}

const GRAPH_COLORS = {
  "hack": "cyan",
  "grow": "lightgreen",
  "weaken": "yellow",
  "cancelled": "red",
  "desync": "magenta",
  "safe": "#111",
  "unsafe": "#333"
};

const WIDTH_PIXELS = 800;
const WIDTH_SECONDS = 16;
const HEIGHT_PIXELS = 1200;

/**
 * Job
 * @typedef {Object} Job
 * @property {string} task - name of the netscript function to call (hack, grow, weaken)
 * @property {number} duration - duration in milliseconds
 * @property {number} startTime - timestamp of expected start
 * @property {number} startTimeActual - timestamp of actual start (optional)
 * @property {number} endTime - timestamp of expected end
 * @property {number} endTimeActual - timestamp of actual end (optional)
 * @property {boolean} cancelled - whether the job has been cancelled (optional)
 * @property {Object} result - expected server state after the job completes
 * @property {number} result.hackDifficulty
 * @property {number} result.minDifficulty
 */

/**
 * renderBatches - create an SVG element with a graph of jobs
 * @param {SVGSVGElement} [el] - SVG element to reuse. Will be created if it does not exist yet.
 * @param {Job[][]} batches - array of arrays of jobs
 * @param {number} [now] - current time (optional)
 * @returns {SVGSVGElement}
 */
export function renderBatches(el: SVGElement | null, batches: any[][] = [], now: number): SVGElement {
  now ||= Date.now();

  // Render the main SVG element if needed
  el ||= svgEl({
    tagName: "svg",
    attributes: {
      version: "1.1",
      width: WIDTH_PIXELS,
      height: HEIGHT_PIXELS,
      // Set the viewBox for 10 seconds of history, 6 seconds of future.
      viewBox: `${convertSecToPx(-10)} 0 ${WIDTH_PIXELS} ${HEIGHT_PIXELS}`
    },
    children: [{
        tagName: "g",
        attributes: {
          id: "timeCoordinates"
        },
        children: [{
            tagName: "g",
            attributes: {
              id: "secLayer"
            }
          },
          {
            tagName: "g",
            attributes: {
              id: "jobLayer"
            }
          },
        ]
      },
      {
        tagName: "rect",
        attributes: {
          id: "cursor",
          x: 0,
          width: 1,
          y: 0,
          height: "100%",
          fill: "white"
        },
      },
      renderLegend()
    ]
  });

  // Update the time coordinates every frame
  const dataEl = (el as any).getElementById("timeCoordinates");
  dataEl.setAttribute('transform',
    `scale(${WIDTH_PIXELS / WIDTH_SECONDS} 1) translate(${convertTime(startTime-now, 0)} 0)`
  );

  // Only update the main data every 250 ms
  const lastUpdate = dataEl.getAttribute('data-last-update') || 0;
  if (now - lastUpdate < 250) {
    return el;
  }
  dataEl.setAttribute('data-last-update', now);

  // Render each job background and foreground
  while (dataEl.firstChild) {
    dataEl.removeChild(dataEl.firstChild);
  }
  dataEl.appendChild(renderSecurityLayer(batches, now));
  dataEl.appendChild(renderJobLayer(batches, now));

  return el;
}

function renderSecurityLayer(batches: Array < any[] > = [], now: number) {
  const secLayer = svgEl({
    tagName: 'g',
    attributes: {
      id: "secLayer"
    }
  });

  let prevJob;
  for (const batch of batches) {
    for (const job of batch) {
      if ((job.endTimeActual || job.endTime) < now - (WIDTH_SECONDS * 1000)) {
        continue;
      }

      // shade the background based on secLevel
      if (prevJob && job.endTime > prevJob.endTime) {
        secLayer.appendChild(svgEl({
          tagName: 'rect',
          attributes: {
            x: convertTime(prevJob.endTime),
            width: convertTime(job.endTime - prevJob.endTime, 0),
            y: 0,
            height: "100%",
            fill: (prevJob.result.hackDifficulty > prevJob.result.minDifficulty) ? GRAPH_COLORS.unsafe : GRAPH_COLORS.safe
          }
        }));
      }
      prevJob = job;
    }
  }
  if (prevJob) {
    secLayer.appendChild(svgEl({
      tagName: 'rect',
      attributes: {
        x: convertTime(prevJob.endTime),
        width: convertTime(10000, 0),
        y: 0,
        height: "100%",
        fill: (prevJob.result.hackDifficulty > prevJob.result.minDifficulty) ? GRAPH_COLORS.unsafe : GRAPH_COLORS.safe
      }
    }));
  }
  return secLayer;
}

function renderJobLayer(batches: Array < any[] >= [], now: number) {
  const jobLayer = svgEl({
    tagName: 'g',
    attributes: {
      id: "jobLayer"
    }
  });

  let i = 0;
  for (const batch of batches) {
    for (const job of batch) {
      i = (i + 1) % (HEIGHT_PIXELS / 4);
      if ((job.endTimeActual || job.endTime) < now - (WIDTH_SECONDS * 1000)) {
        continue;
      }
      // draw the job bars
      let color = GRAPH_COLORS[(job.task as Task)];
      if (job.cancelled === true) {
        color = GRAPH_COLORS.cancelled;
      }
      jobLayer.appendChild(svgEl({
        tagName: 'rect',
        attributes: {
          x: convertTime(job.startTime),
          width: convertTime(job.duration, 0),
          y: i * 4,
          height: 2,
          fill: color
        }
      }));
      // draw the error bars
      if (job.startTimeActual) {
        const [t1, t2] = [job.startTime, job.startTimeActual].sort((a, b) => a - b);
        jobLayer.appendChild(svgEl({
          tagName: 'rect',
          attributes: {
            x: convertTime(t1),
            width: convertTime(t2 - t1, 0),
            y: i * 4,
            height: 1,
            fill: GRAPH_COLORS.desync
          }
        }));
      }
      if (job.endTimeActual) {
        const [t1, t2] = [job.endTime, job.endTimeActual].sort((a, b) => a - b);
        jobLayer.appendChild(svgEl({
          tagName: 'rect',
          attributes: {
            x: convertTime(t1),
            width: convertTime(t2 - t1, 0),
            y: i * 4,
            height: 1,
            fill: GRAPH_COLORS.desync
          }
        }));
      }
    }
    // space between batches
    i++;
  }
  return jobLayer;
}

function renderLegend(): ElementDeclaration {
  const legendEl: ElementDeclaration = {
    tagName: 'g',
    attributes: {
      id: "Legend",
      transform: "translate(-480, 10), scale(.5, .5)"
    },
    children: [{
      tagName: 'rect',
      attributes: {
        x: 1,
        y: 1,
        width: 275,
        height: 310,
        fill: "black",
        stroke: "#979797"
      }
    }],
  };
  let y = 13;
  for (const [label, color] of Object.entries(GRAPH_COLORS)) {
    (legendEl.children as ElementDeclaration[]).push({
      tagName: 'g',
      attributes: {
        transform: `translate(22, ${y})`
      },
      children: [{
          tagName: 'rect',
          attributes: {
            x: 0,
            y: 10,
            width: 22,
            height: 22,
            fill: color
          }
        },
        {
          tagName: 'text',
          attributes: {
            "font-family": "Courier New",
            "font-size": 36,
            fill: "#888"
          },
          children: [{
            tagName: 'tspan',
            attributes: {
              x: 42.5,
              y: 30
            },
            content: label,
          }],
        }
      ]
    });
    y += 41;
  }
  return legendEl;
}

/* ---------- library functions ---------- */

/** Create an SVG Element that can be displayed in the DOM. */
function svgEl({
  tagName,
  attributes = {},
  children = [],
  content
}: ElementDeclaration): SVGElement {
  const doc = eval("document");
  const xmlns = 'http://www.w3.org/2000/svg';
  const el = doc.createElementNS(xmlns, tagName) as SVGElement;
  // support exporting outerHTML
  if (tagName.toLowerCase() == 'svg') {
    attributes['xmlns'] = xmlns;
  }
  // set all attributes
  for (const [name, val] of Object.entries(attributes)) {
    el.setAttribute(name, val as string);
  }
  let childElement: Element;
  // append all children
  for (const child of children) {
    // recursively construct child elements
    childElement = svgEl(child);
    el.appendChild(childElement);
  }
  if (content) {
    childElement = doc.createTextNode(content);
    el.appendChild(childElement);
  }
  return el;
}

/** Insert an element into the netscript process's tail window. */
export function logHTML(ns: NS, el: Element): void {
  ns.tail();
  const doc = eval("document");
  const command = ns.getScriptName() + ' ' + ns.args.join(' ');
  const logEl = doc.querySelector(`[title="${command}"]`).parentElement.parentElement.nextElementSibling.querySelector('.MuiBox-root')
  logEl.appendChild(el);
}