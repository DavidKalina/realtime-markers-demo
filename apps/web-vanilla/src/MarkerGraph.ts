import * as d3 from "d3";

interface Marker {
  id: string;
  title?: string; // Added title property for popup
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  emoji: string;
  color: string;
  // D3 simulation properties
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
  // Custom drift properties for free roaming
  driftX?: number;
  driftY?: number;
}

const styles = `
.marker-popup {
  position: absolute;
  background-color: rgba(24, 24, 27, 0.95);
  color: white;
  padding: 1rem;
  border-radius: 0.375rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  pointer-events: none;
  min-width: 300px;
  z-index: 1000;
  transform: translate(-50%, -100%);
}

/* Add a small triangle pointing down to complete the T-shape */
.marker-popup::after {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid rgba(24, 24, 27, 0.95);
}



.marker-popup .header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.marker-popup .emoji {
  font-size: 1.5rem;
  font-family: monospace;
}

.marker-popup .label {
  font-weight: bold;
  font-family: monospace;
}

.marker-popup .description {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  font-family: monospace;
}

.node text {
  font-size: 42px;
  dominant-baseline: middle;
}`;

// Inject styles into the document
const styleSheet = document.createElement("style");
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// Custom drift force: continuously applies each node’s drift vector.
function forceDrift() {
  let nodes: Marker[] = [];
  function force() {
    for (const node of nodes) {
      if (node.driftX === undefined || node.driftY === undefined) {
        node.driftX = (Math.random() - 0.5) * 0.2;
        node.driftY = (Math.random() - 0.5) * 0.2;
      }
      node.vx! += node.driftX;
      node.vy! += node.driftY;
    }
  }
  force.initialize = function (_nodes: Marker[]) {
    nodes = _nodes;
  };
  return force;
}

// Custom bounds force: bounces nodes off the window edges.
function forceBounds(width: number, height: number, radius: number) {
  let nodes: Marker[] = [];
  function force() {
    for (const node of nodes) {
      // Left and right boundaries
      if (node.x! < radius) {
        // Calculate how far past the wall the node has gone
        const overshoot = radius - node.x!;
        // Reflect the node’s position relative to the wall
        node.x = radius + overshoot;
        // Reverse its velocity
        node.vx = Math.abs(node.vx!);
      } else if (node.x! > width - radius) {
        const overshoot = node.x! - (width - radius);
        node.x = width - radius - overshoot;
        node.vx = -Math.abs(node.vx!);
      }

      // Top and bottom boundaries
      if (node.y! < radius) {
        const overshoot = radius - node.y!;
        node.y = radius + overshoot;
        node.vy = Math.abs(node.vy!);
      } else if (node.y! > height - radius) {
        const overshoot = node.y! - (height - radius);
        node.y = height - radius - overshoot;
        node.vy = -Math.abs(node.vy!);
      }
    }
  }
  force.initialize = function (_nodes: Marker[]) {
    nodes = _nodes;
  };
  return force;
}

export class MarkerGraph {
  private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
  private simulation: d3.Simulation<Marker, undefined>;
  private nodes: Marker[] = [];
  private ws: WebSocket;
  // Increase node size: use a larger radius.
  private readonly nodeRadius = 50;
  private popupContainer: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;

  constructor(containerId: string) {
    // Create container for popups
    this.popupContainer = d3
      .select(`#${containerId}`)
      .append("div")
      .style("position", "relative")
      .style("width", "100%")
      .style("height", "100%");

    this.svg = this.popupContainer.append("svg").attr("width", "100%").attr("height", "100%");

    this.simulation = d3
      .forceSimulation<Marker>()
      .velocityDecay(0.1)
      .force("collision", d3.forceCollide().radius(this.nodeRadius))
      .force("drift", forceDrift())
      .force("bounds", forceBounds(window.innerWidth, window.innerHeight, this.nodeRadius))
      .on("tick", () => this.updateNodePositions());

    this.simulation.alpha(1).alphaDecay(0);

    this.ws = new WebSocket("ws://localhost:8080");
    this.ws.onmessage = (event) => this.handleWebSocketMessage(event);

    this.fetchInitialMarkers();
  }

  private showPopup(marker: Marker, x: number, y: number) {
    const gap = 20; // Increased gap for better visual separation
    const popup = this.popupContainer
      .append("div")
      .attr("class", "marker-popup")
      .style("left", `${x}px`)
      .style("top", `${y - this.nodeRadius - gap}px`)
      .datum(marker);

    const header = popup.append("div").attr("class", "header");

    header.append("span").attr("class", "emoji").text(marker.emoji);

    header
      .append("span")
      .attr("class", "label")
      .text(marker.title || "New Marker");

    // Animate popup
    popup
      .style("opacity", "0")
      .style("transform", "translate(-50%, -110%)")
      .transition()
      .duration(200)
      .style("opacity", "1")
      .style("transform", "translate(-50%, -100%)")
      .transition()
      .delay(2000)
      .duration(200)
      .style("opacity", "0")
      .style("transform", "translate(-50%, -110%)")
      .on("end", () => popup.remove());
  }

  private async fetchInitialMarkers() {
    try {
      const response = await fetch("/api/markers");
      const markers = await response.json();
      this.updateNodes(markers, true); // initial load
    } catch (error) {
      console.error("Failed to fetch markers:", error);
    }
  }

  private handleWebSocketMessage(event: MessageEvent) {
    const data = JSON.parse(event.data);
    let shouldUpdate = false;

    if (data.operation === "INSERT") {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const newNode: Marker = {
        ...data.record,
        x: centerX + (Math.random() - 0.5) * 100,
        y: centerY + (Math.random() - 0.5) * 100,
      };
      this.nodes.push(newNode);
      shouldUpdate = true;
    } else if (data.operation === "DELETE") {
      const initialLength = this.nodes.length;
      this.nodes = this.nodes.filter((node) => node.id !== data.record.id);
      shouldUpdate = initialLength !== this.nodes.length;
    } else if (data.operation === "UPDATE") {
      const index = this.nodes.findIndex((node) => node.id === data.record.id);
      if (index !== -1) {
        const currentPos = { x: this.nodes[index].x, y: this.nodes[index].y };
        this.nodes[index] = {
          ...data.record,
          ...currentPos,
          driftX: this.nodes[index].driftX,
          driftY: this.nodes[index].driftY,
        };
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      // For INSERT operations, isInitialLoad is false so the popup will show.
      this.updateNodes(this.nodes, false);
    }
  }

  private updateNodes(markers: Marker[], isInitialLoad: boolean) {
    this.nodes = markers;
    this.simulation.nodes(this.nodes);

    if (isInitialLoad) {
      this.simulation.alpha(1).restart();
    } else {
      if (this.simulation.alpha() < 0.1) {
        this.simulation.alpha(0.3).restart();
      }
    }

    const nodesSelection = this.svg.selectAll(".node").data(this.nodes, (d: any) => d.id);
    nodesSelection.exit().remove();

    const nodeEnter = nodesSelection
      .enter()
      .append("g")
      .attr("class", "node")
      .call(
        d3
          .drag<any, any>()
          .on("start", (event) => {
            if (!event.active) this.simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
          })
          .on("drag", (event) => {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
          })
          .on("end", (event) => {
            if (!event.active) this.simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
          })
      );

    // Append a circle with a larger radius and non-scaling stroke.
    nodeEnter
      .append("circle")
      .attr("r", this.nodeRadius - 10)
      .style("fill", "#333")
      .style("stroke", "#fff")
      .style("stroke-width", 2)
      .attr("vector-effect", "non-scaling-stroke");

    // Append the emoji text and center it both horizontally and vertically.
    nodeEnter
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text((d) => d.emoji);

    // For new nodes (i.e. not the initial load), add a temporary popup showing the title.
    if (!isInitialLoad) {
      nodeEnter.each((d) => {
        if (d.x !== undefined && d.y !== undefined) {
          // Pass the node's x and y so the popup can compute its position.
          this.showPopup(d, d.x, d.y);
        }
      });
    }

    // Update existing nodes if properties (like color or emoji) have changed.
    nodesSelection.select("circle").style("fill", (d) => d.color);
    nodesSelection.select("text").text((d) => d.emoji);
  }

  private updateNodePositions() {
    // Update nodes
    this.svg
      .selectAll<SVGGElement, Marker>(".node")
      .attr("transform", (d) => `translate(${d.x},${d.y})`);

    // Update popups with the T-shape positioning
    const gap = 20;
    this.popupContainer
      .selectAll<HTMLDivElement, Marker>(".marker-popup")
      .style("left", (d) => `${d.x}px`)
      .style("top", (d) => `${(d.y ?? 0) - this.nodeRadius - gap}px`);
  }
}

// Initialize the graph.
new MarkerGraph("graph-container");
