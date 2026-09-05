let currentData = null;
let animations = {};
let activeTimer = null;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("calculateBtn").addEventListener("click", calculate);

    document.querySelectorAll("[data-play]").forEach(btn => {
        btn.addEventListener("click", () => {
            if (!currentData) return;
            playAlgorithm(btn.dataset.play);
        });
    });

    document.getElementById("playAllBtn").addEventListener("click", playAll);
});

async function calculate() {
    const error = document.getElementById("error");
    error.textContent = "";

    const head = Number(document.getElementById("head").value);
    const diskSize = Number(document.getElementById("diskSize").value);
    const direction = document.getElementById("direction").value;

    const requests = document.getElementById("requests").value
        .split(",")
        .map(x => x.trim())
        .filter(Boolean)
        .map(Number);

    if (!Number.isInteger(head) || !Number.isInteger(diskSize)) {
        error.textContent = "Please enter whole numbers for head and disk size.";
        return;
    }

    if (!requests.length || requests.some(x => !Number.isInteger(x))) {
        error.textContent = "Please enter valid comma-separated request numbers.";
        return;
    }

    try {
        const response = await fetch("/calculate", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({head, diskSize, requests, direction})
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "Calculation failed.");

        currentData = data;
        renderResults(data);
    } catch (err) {
        error.textContent = err.message;
    }
}

function renderResults(data) {
    document.getElementById("results").classList.remove("hidden");

    document.getElementById("initialHead").textContent = data.initial_head;
    document.getElementById("initialDirection").textContent =
        data.direction === "right" ? "Right →" : "Left ←";

    document.getElementById("sstfMovement").textContent = data.sstf.movement;
    document.getElementById("lookMovement").textContent = data.look.movement;
    document.getElementById("clookMovement").textContent = data.clook.movement;

    document.getElementById("sstfSequence").textContent =
        [data.initial_head, ...data.sstf.sequence].join(" → ");
    document.getElementById("lookSequence").textContent =
        [data.initial_head, ...data.look.sequence].join(" → ");
    document.getElementById("clookSequence").textContent =
        [data.initial_head, ...data.clook.sequence].join(" → ");

    drawMainTimeline(data);
    drawGraph("sstfGraph", data.initial_head, data.sstf, data.disk_size, "SSTF");
    drawGraph("lookGraph", data.initial_head, data.look, data.disk_size, "LOOK");
    drawGraph("clookGraph", data.initial_head, data.clook, data.disk_size, "C-LOOK");

    renderComparison(data);
    renderTables(data);

    document.getElementById("bestAlgorithm").textContent =
        `🏆 Minimum Head Movement: ${data.best_algorithm} (${data[data.best_algorithm.toLowerCase().replace("-", "")]?.movement ?? getResult(data.best_algorithm).movement} cylinders)`;

    window.scrollTo({top: document.getElementById("results").offsetTop - 15, behavior: "smooth"});
}

function getResult(name) {
    if (name === "SSTF") return currentData.sstf;
    if (name === "LOOK") return currentData.look;
    return currentData.clook;
}

function drawMainTimeline(data) {
    const box = document.getElementById("mainTimeline");
    box.innerHTML = "";

    const inner = document.createElement("div");
    inner.className = "timeline-inner";

    const axis = document.createElement("div");
    axis.className = "axis";
    inner.appendChild(axis);

    const max = data.disk_size - 1;

    for (let i = 0; i <= 10; i++) {
        const value = Math.round((i / 10) * max);
        const pct = (value / max) * 100;

        const tick = document.createElement("div");
        tick.className = "tick";
        tick.style.left = `calc(${pct}% + 20px)`;
        inner.appendChild(tick);

        const label = document.createElement("div");
        label.className = "tick-label";
        label.style.left = `calc(${pct}% + 20px)`;
        label.textContent = value;
        inner.appendChild(label);
    }

    data.requests.forEach((value, index) => {
        const pct = (value / max) * 100;
        const marker = document.createElement("div");
        marker.className = "request-marker";
        marker.style.left = `calc(${pct}% + 20px)`;
        marker.title = `Request ${value}`;
        inner.appendChild(marker);

        const label = document.createElement("div");
        label.className = "marker-label";
        label.style.left = `calc(${pct}% + 20px)`;
        label.style.top = index % 2 === 0 ? "35px" : "15px";
        label.textContent = value;
        inner.appendChild(label);
    });

    const head = document.createElement("div");
    head.className = "head-marker";
    head.style.left = `calc(${(data.initial_head / max) * 100}% + 20px)`;
    head.title = `Initial head ${data.initial_head}`;
    inner.appendChild(head);

    const headLabel = document.createElement("div");
    headLabel.className = "marker-label";
    headLabel.style.left = `calc(${(data.initial_head / max) * 100}% + 20px)`;
    headLabel.style.top = "0";
    headLabel.textContent = `HEAD ${data.initial_head}`;
    inner.appendChild(headLabel);

    box.appendChild(inner);
}

function drawGraph(elementId, head, result, diskSize, name) {
    const box = document.getElementById(elementId);
    box.innerHTML = "";

    const width = 760;
    const height = 290;
    const left = 48, right = 18, top = 28, bottom = 48;
    const plotW = width - left - right;
    const plotH = height - top - bottom;
    const sequence = [head, ...result.sequence];
    const max = diskSize - 1;

    const x = value => left + (value / max) * plotW;
    const y = index => top + (index / Math.max(1, sequence.length - 1)) * plotH;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    // Horizontal grid / labels.
    for (let i = 0; i <= 10; i++) {
        const value = Math.round((i / 10) * max);
        const line = svgEl("line", {
            x1: x(value), y1: top, x2: x(value), y2: top + plotH,
            class: "graph-grid"
        });
        svg.appendChild(line);

        const label = svgEl("text", {
            x: x(value), y: height - 16,
            class: "graph-text", "text-anchor": "middle"
        });
        label.textContent = value;
        svg.appendChild(label);
    }

    svg.appendChild(svgEl("line", {
        x1: left, y1: height - bottom, x2: width - right, y2: height - bottom,
        class: "graph-axis"
    }));

    // Path segments. C-LOOK wrap is drawn dashed.
    for (let i = 0; i < sequence.length - 1; i++) {
        const a = sequence[i], b = sequence[i + 1];
        const line = svgEl("line", {
            x1: x(a), y1: y(i),
            x2: x(b), y2: y(i + 1),
            class: (name === "C-LOOK" && Math.abs(b - a) > (max * 0.5))
                ? "graph-wrap" : "graph-path"
        });
        svg.appendChild(line);
    }

    // Request points.
    sequence.forEach((value, i) => {
        const circle = svgEl("circle", {
            cx: x(value), cy: y(i), r: i === 0 ? 9 : 7,
            class: i === 0 ? "graph-current" : "graph-point"
        });
        svg.appendChild(circle);

        const label = svgEl("text", {
            x: x(value), y: y(i) - 13,
            class: "graph-text", "text-anchor": "middle"
        });
        label.textContent = value;
        svg.appendChild(label);
    });

    // Animated head.
    const headCircle = svgEl("circle", {
        cx: x(head), cy: y(0), r: 13, class: "graph-current"
    });
    svg.appendChild(headCircle);

    const headText = svgEl("text", {
        x: x(head), y: y(0) + 4,
        class: "graph-text", "text-anchor": "middle"
    });
    headText.textContent = "H";
    svg.appendChild(headText);

    box.appendChild(svg);

    animations[elementId] = {
        svg, headCircle, headText, x, y, sequence, result, current: 0
    };

    updateStepLabel(name, 0, result);
}

function svgEl(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
}

function updateStepLabel(name, index, result) {
    const id = name.toLowerCase().replace("-", "") + "Step";
    const el = document.getElementById(id);
    if (!el) return;

    if (index === 0) {
        el.textContent = `Start at initial head. Step 0 of ${result.steps.length}`;
    } else {
        const s = result.steps[index - 1];
        el.textContent =
            `Step ${index}/${result.steps.length}: ${s.from} → ${s.to} | ` +
            `${s.direction} | Movement ${s.movement} | Total ${s.total}`;
    }
}

function playAlgorithm(key) {
    stopAnimation();

    const map = {
        sstf: {graph: "sstfGraph", name: "SSTF"},
        look: {graph: "lookGraph", name: "LOOK"},
        clook: {graph: "clookGraph", name: "C-LOOK"}
    };

    const info = map[key];
    const anim = animations[info.graph];
    if (!anim) return;

    anim.current = 0;
    updateAnimatedHead(anim, info.name);

    let step = 0;
    activeTimer = setInterval(() => {
        step++;
        if (step > anim.sequence.length - 1) {
            stopAnimation();
            return;
        }

        anim.current = step;
        updateAnimatedHead(anim, info.name);
    }, 800);
}

function updateAnimatedHead(anim, name) {
    const value = anim.sequence[anim.current];
    anim.headCircle.setAttribute("cx", anim.x(value));
    anim.headCircle.setAttribute("cy", anim.y(anim.current));
    anim.headText.setAttribute("x", anim.x(value));
    anim.headText.setAttribute("y", anim.y(anim.current) + 4);

    updateStepLabel(name, anim.current, anim.result);
}

function playAll() {
    stopAnimation();

    const keys = [
        {graph: "sstfGraph", name: "SSTF"},
        {graph: "lookGraph", name: "LOOK"},
        {graph: "clookGraph", name: "C-LOOK"}
    ];

    let step = 0;
    const maxSteps = Math.max(
        ...keys.map(k => animations[k.graph]?.sequence.length - 1 || 0)
    );

    activeTimer = setInterval(() => {
        step++;

        if (step > maxSteps) {
            stopAnimation();
            return;
        }

        keys.forEach(k => {
            const anim = animations[k.graph];
            if (!anim) return;

            const actual = Math.min(step, anim.sequence.length - 1);
            anim.current = actual;
            updateAnimatedHead(anim, k.name);
        });
    }, 800);
}

function stopAnimation() {
    if (activeTimer) {
        clearInterval(activeTimer);
        activeTimer = null;
    }
}

function renderComparison(data) {
    const items = [
        ["SSTF", data.sstf.movement],
        ["LOOK", data.look.movement],
        ["C-LOOK", data.clook.movement]
    ];

    const max = Math.max(...items.map(x => x[1]), 1);
    const box = document.getElementById("comparison");
    box.innerHTML = "";

    items.forEach(([name, value]) => {
        const row = document.createElement("div");
        row.className = "comparison-row";

        const label = document.createElement("div");
        label.textContent = name;

        const bg = document.createElement("div");
        bg.className = "bar-bg";

        const fill = document.createElement("div");
        fill.className = "bar-fill";
        fill.style.width = `${(value / max) * 100}%`;

        const number = document.createElement("div");
        number.textContent = `${value} cyl`;

        bg.appendChild(fill);
        row.append(label, bg, number);
        box.appendChild(row);
    });

    document.getElementById("bestAlgorithm").textContent =
        `🏆 Minimum Head Movement: ${data.best_algorithm} (${getResult(data.best_algorithm).movement} cylinders)`;
}

function renderTables(data) {
    const box = document.getElementById("tables");
    box.innerHTML = "";

    [
        ["SSTF", data.sstf],
        ["LOOK", data.look],
        ["C-LOOK", data.clook]
    ].forEach(([name, result]) => {
        const title = document.createElement("h2");
        title.textContent = `${name} — Step-by-Step Movement`;

        const wrap = document.createElement("div");
        wrap.className = "table-wrap";

        const table = document.createElement("table");
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Step</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Change</th>
                    <th>Movement</th>
                    <th>Direction</th>
                    <th>Total So Far</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector("tbody");

        result.steps.forEach(s => {
            const tr = document.createElement("tr");
            const change = s.change > 0 ? `+${s.change}` : `${s.change}`;
            tr.innerHTML = `
                <td>${s.step}</td>
                <td>${s.from}</td>
                <td>${s.to}</td>
                <td class="${s.change >= 0 ? "change-positive" : "change-negative"}">${change}</td>
                <td>${s.movement}</td>
                <td>${s.direction}</td>
                <td>${s.total}</td>
            `;
            tbody.appendChild(tr);
        });

        wrap.appendChild(table);

        const total = document.createElement("div");
        total.className = "total-box";
        total.textContent = `Total Head Movement = ${result.movement} cylinders`;

        box.append(title, wrap, total);
    });
}
