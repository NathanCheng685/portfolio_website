import { F } from "../sprite.js";

const RECIPES = {
  pasta: { dish: "Tomato pasta", parts: [{ name: "Pasta" }, { name: "Tomato sauce", items: ["Tomatoes", "Garlic", "Olive oil"] }, { name: "Basil" }] },
  bowl: { dish: "Chickpea bowl", parts: [{ name: "Rice" }, { name: "Crispy chickpeas", items: ["Chickpeas", "Paprika"] }, { name: "Lemon dressing", items: ["Lemon", "Olive oil"] }] },
};
const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// A dish becomes a tree; the pantry decides which leaves still need buying.
export default function cooktree(card, ctx) {
  const tree = card.querySelector("#ingredient-tree");
  const lines = tree.querySelector(".tree-lines");
  const cookButton = card.querySelector("#cook-button");
  const pantry = new Set(["Garlic", "Olive oil"]);
  let recipe = RECIPES.pasta;
  let cookTimer = 0;

  const leavesOf = part => part.items || [part.name];
  const allLeaves = () => [...new Set(recipe.parts.flatMap(leavesOf))];
  const missing = () => allLeaves().filter(item => !pantry.has(item));

  function build() {
    tree.querySelectorAll(".node").forEach(node => node.remove());
    const add = (html, data) => {
      const holder = document.createElement("template");
      holder.innerHTML = html.trim();
      const node = holder.content.firstElementChild;
      Object.assign(node.dataset, data);
      tree.append(node);
      return node;
    };
    add(`<div class="node dish">${escape(recipe.dish)}</div>`, { level: "0" });
    recipe.parts.forEach((part, partIndex) => {
      if (part.items) {
        add(`<div class="node part"><span>${escape(part.name)}</span><small></small></div>`, { level: "1", part: String(partIndex) });
        part.items.forEach((item, itemIndex) => add(`<button type="button" class="node leaf"><span>${escape(item)}</span><small></small></button>`, { level: "2", part: String(partIndex), index: String(itemIndex), item }));
      } else {
        add(`<button type="button" class="node leaf"><span>${escape(part.name)}</span><small></small></button>`, { level: "1", part: String(partIndex), item: part.name });
      }
    });
    place();
    refresh();
  }

  // One row of the tree: start from the wanted centers, then push nodes apart by their
  // measured widths so none overlap, and keep the row inside the tree. A row too wide
  // for the tree (narrow phones) splits into two lanes. Returns the lanes.
  function packRow(row, width) {
    const gap = 6;
    const margin = 4;
    row.sort((a, b) => a.want - b.want);
    const total = row.reduce((sum, n) => sum + n.w, 0) + gap * (row.length - 1);
    const lanes = total > width - 2 * margin && row.length > 1 ? [row.filter((_, i) => i % 2 === 0), row.filter((_, i) => i % 2 === 1)] : [row];
    for (const lane of lanes) {
      let edge = margin;
      for (const n of lane) {
        n.x = Math.max(n.want, edge + n.w / 2);
        edge = n.x + n.w / 2 + gap;
      }
      edge = width - margin;
      for (let i = lane.length - 1; i >= 0; i -= 1) {
        lane[i].x = Math.min(lane[i].x, edge - lane[i].w / 2);
        edge = lane[i].x - lane[i].w / 2 - gap;
      }
    }
    return lanes;
  }

  function place() {
    const width = tree.clientWidth;
    const height = tree.clientHeight;
    if (!width || !height) return;
    const parts = recipe.parts.length;
    const at = {};
    const spread = Math.min(124, width / 4.4);
    // Narrow trees use smaller nodes before splitting any row.
    tree.classList.toggle("is-tight", width < 360);
    const nodes = [...tree.querySelectorAll(".node")].map(node => {
      const level = Number(node.dataset.level);
      let want = width / 2;
      if (level >= 1) want = (Number(node.dataset.part) + 0.5) / parts * width;
      if (level === 2) {
        const part = recipe.parts[Number(node.dataset.part)];
        want += (Number(node.dataset.index) - (part.items.length - 1) / 2) * spread;
      }
      return { node, level, want, w: node.offsetWidth + 1 }; // offsetWidth rounds down
    });
    // Rows top to bottom; with a split row, all rows are spaced evenly down the tree.
    const rows = [0, 1, 2].flatMap(level => packRow(nodes.filter(n => n.level === level), width));
    const fractions = rows.length === 3 ? [0.1, 0.48, 0.86] : rows.map((_, i) => 0.08 + 0.8 * i / (rows.length - 1));
    rows.forEach((row, i) => row.forEach(n => { n.y = height * fractions[i]; }));
    nodes.forEach(({ node, level, x, y }) => {
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      at[level === 0 ? "root" : level === 1 ? `p${node.dataset.part}` : `p${node.dataset.part}i${node.dataset.index}`] = { x, y, node };
    });
    const curve = (a, b) => `M${a.x},${a.y + 18}C${a.x},${(a.y + b.y) / 2} ${b.x},${(a.y + b.y) / 2} ${b.x},${b.y - 18}`;
    let paths = "";
    recipe.parts.forEach((part, partIndex) => {
      paths += `<path data-to="p${partIndex}" d="${curve(at.root, at[`p${partIndex}`])}"/>`;
      (part.items || []).forEach((_, itemIndex) => { paths += `<path data-to="p${partIndex}i${itemIndex}" d="${curve(at[`p${partIndex}`], at[`p${partIndex}i${itemIndex}`])}"/>`; });
    });
    lines.innerHTML = paths;
    refresh();
  }

  function refresh() {
    tree.querySelectorAll(".node.leaf").forEach(node => {
      const have = pantry.has(node.dataset.item);
      node.setAttribute("aria-pressed", String(have));
      node.querySelector("small").textContent = have ? "have it" : "need it";
    });
    recipe.parts.forEach((part, partIndex) => {
      const have = leavesOf(part).every(item => pantry.has(item));
      lines.querySelector(`[data-to="p${partIndex}"]`)?.classList.toggle("is-have", have);
      (part.items || []).forEach((item, itemIndex) => lines.querySelector(`[data-to="p${partIndex}i${itemIndex}"]`)?.classList.toggle("is-have", pantry.has(item)));
      const node = tree.querySelector(`.node.part[data-part="${partIndex}"]`);
      if (node) {
        node.classList.toggle("is-have", have);
        node.querySelector("small").textContent = `${part.items.filter(item => pantry.has(item)).length} of ${part.items.length}`;
      }
    });
    const need = missing();
    card.querySelector("#shopping-label").textContent = need.length ? `Shopping list · ${need.length} ${need.length === 1 ? "thing" : "things"}` : "Shopping list";
    card.querySelector("#shopping-list").textContent = need.length ? need.join(", ") : "Nothing. You have it all.";
    cookButton.disabled = need.length > 0;
    if (!tree.classList.contains("is-cooking")) cookButton.textContent = need.length ? "Cook" : "Cook it";
  }

  tree.addEventListener("click", event => {
    const node = event.target.closest(".node.leaf");
    if (!node) return;
    const item = node.dataset.item;
    if (pantry.has(item)) pantry.delete(item);
    else pantry.add(item);
    refresh();
    if (!missing().length) ctx.actor()?.play([F.panB, F.panA], { fps: 5, rest: F.panA });
  });
  card.querySelectorAll("[data-recipe]").forEach(button => button.addEventListener("click", () => {
    card.querySelectorAll("[data-recipe]").forEach(other => other.setAttribute("aria-pressed", String(other === button)));
    recipe = RECIPES[button.dataset.recipe];
    tree.classList.remove("is-cooking");
    build();
  }));
  cookButton.addEventListener("click", () => {
    clearTimeout(cookTimer);
    tree.classList.add("is-cooking");
    cookButton.textContent = "Dinner's ready";
    ctx.actor()?.play([F.panA, F.panB], { fps: 5, times: 5, rest: F.panA });
    cookTimer = setTimeout(() => {
      tree.classList.remove("is-cooking");
      refresh();
    }, 2600);
  });

  new ResizeObserver(place).observe(tree);
  build();

  return {
    pose: F.panA,
    enter(actor) {
      actor?.play([F.stand, F.panA], { fps: 3, rest: F.panA });
    },
  };
}
