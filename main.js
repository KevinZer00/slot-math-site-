(() => {
  "use strict";

  const symbols = [
    { name: "Cherry", icon: "🍒", probability: 0.25, triplePay: 14 },
    { name: "Lemon", icon: "🍋", probability: 0.20, triplePay: 18 },
    { name: "Bell", icon: "🔔", probability: 0.15, triplePay: 32 },
    { name: "Diamond", icon: "💎", probability: 0.10, triplePay: 60 },
    { name: "Blank", icon: "—", probability: 0.30, triplePay: 0 }
  ];
  const theoreticalRtp = 0.932;
  const maxChartPoints = 1500;
  const state = {
    bet: 1,
    spins: 0,
    totalWagered: 0,
    totalReturned: 0,
    hits: 0,
    chartPoints: [],
    busy: false
  };

  const byId = (id) => document.getElementById(id);
  const spinButton = byId("spin-button");
  const resultMessage = byId("result-message");
  const canvas = byId("rtp-chart");
  const context = canvas.getContext("2d");

  function formatMoney(value) {
    return `${value < 0 ? "-$" : "$"}${Math.abs(value).toFixed(2)}`;
  }

  function randomSymbol() {
    const draw = Math.random();
    let cumulative = 0;
    for (const symbol of symbols) {
      cumulative += symbol.probability;
      if (draw < cumulative) return symbol;
    }
    return symbols[symbols.length - 1];
  }

  function playOutcome() {
    const result = [randomSymbol(), randomSymbol(), randomSymbol()];
    let payoutMultiple = 0;
    if (result[0].name === result[1].name && result[1].name === result[2].name) {
      payoutMultiple = result[0].triplePay;
    } else {
      const counts = new Map();
      for (const symbol of result) {
        counts.set(symbol.name, (counts.get(symbol.name) || 0) + 1);
      }
      if (Array.from(counts).some(([name, count]) => name !== "Blank" && count === 2)) {
        payoutMultiple = 1.25;
      }
    }
    return { result, payout: state.bet * payoutMultiple };
  }

  function recordChartPoint() {
    state.chartPoints.push({
      spins: state.spins,
      rtp: (state.totalReturned / state.totalWagered) * 100
    });
    if (state.chartPoints.length > maxChartPoints) {
      const stride = Math.ceil(state.chartPoints.length / 1000);
      state.chartPoints = state.chartPoints.filter((_, index) => index % stride === 0);
    }
  }

  function recordOutcome(outcome, addChartPoint = true) {
    state.spins += 1;
    state.totalWagered += state.bet;
    state.totalReturned += outcome.payout;
    if (outcome.payout > 0) state.hits += 1;
    if (addChartPoint) recordChartPoint();
  }

  function renderStats() {
    const sessionRtp = state.spins ? (state.totalReturned / state.totalWagered) * 100 : null;
    const net = state.totalReturned - state.totalWagered;
    byId("stat-spins").textContent = state.spins.toLocaleString();
    byId("stat-rtp").textContent = sessionRtp === null ? "—" : `${sessionRtp.toFixed(1)}%`;
    byId("stat-rtp-note").textContent = sessionRtp === null ? "needs at least 1 spin" : "session result, not a forecast";
    byId("stat-net").textContent = formatMoney(net);
    byId("stat-net").className = net < 0 ? "negative" : net > 0 ? "positive" : "";
    byId("stat-hit").textContent = state.spins ? `${((state.hits / state.spins) * 100).toFixed(1)}%` : "—";
    byId("stat-hit-note").textContent = state.spins ? `${state.hits.toLocaleString()} spins with any payout` : "any payout / spins";
    byId("chart-session").textContent = sessionRtp === null ? "—" : `${sessionRtp.toFixed(1)}%`;
    byId("chart-empty").hidden = state.spins > 0;
    drawChart();
  }

  function drawChart() {
    if (!context) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.round(bounds.width * scale);
    canvas.height = Math.round(bounds.height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);

    const width = bounds.width;
    const height = bounds.height;
    const left = 33;
    const right = 7;
    const top = 8;
    const bottom = 18;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const maxY = 200;

    context.clearRect(0, 0, width, height);
    context.font = '8px "DM Mono", monospace';
    context.textAlign = "right";
    context.textBaseline = "middle";
    for (const value of [0, 50, 100, 150, 200]) {
      const y = top + plotHeight * (1 - value / maxY);
      context.strokeStyle = "#ffffff12";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(width - right, y);
      context.stroke();
      context.fillStyle = "#788072";
      context.fillText(`${value}%`, left - 5, y);
    }

    const expectedY = top + plotHeight * (1 - theoreticalRtp);
    context.setLineDash([4, 4]);
    context.strokeStyle = "#969d8c";
    context.beginPath();
    context.moveTo(left, expectedY);
    context.lineTo(width - right, expectedY);
    context.stroke();
    context.setLineDash([]);

    if (state.chartPoints.length < 1) return;
    const totalSpins = state.spins;
    const points = state.chartPoints;
    context.beginPath();
    points.forEach((point, index) => {
      const x = left + plotWidth * (totalSpins > 1 ? (point.spins - 1) / (totalSpins - 1) : 0);
      const y = top + plotHeight * (1 - Math.min(point.rtp, maxY) / maxY);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = "#c8f169";
    context.lineWidth = 2;
    context.lineJoin = "round";
    context.stroke();
    const lastPoint = points[points.length - 1];
    const lastX = left + plotWidth * (totalSpins > 1 ? (lastPoint.spins - 1) / (totalSpins - 1) : 0);
    const lastY = top + plotHeight * (1 - Math.min(lastPoint.rtp, maxY) / maxY);
    context.fillStyle = "#c8f169";
    context.beginPath();
    context.arc(lastX, lastY, 3, 0, Math.PI * 2);
    context.fill();
  }

  function showOutcome(outcome) {
    outcome.result.forEach((symbol, index) => {
      byId(`reel-${index}`).textContent = symbol.icon;
    });
    const names = outcome.result.map((symbol) => symbol.name);
    if (outcome.payout > 0) {
      const net = outcome.payout - state.bet;
      resultMessage.textContent = `${names.join(" · ")} — returned ${formatMoney(outcome.payout)} (${net >= 0 ? "+" : ""}${formatMoney(net)} net)`;
      resultMessage.className = "result-message win";
    } else {
      resultMessage.textContent = `${names.join(" · ")} — no payout this time.`;
      resultMessage.className = "result-message loss";
    }
  }

  function updateInsight() {
    if (state.spins === 0) {
      byId("insight-text").textContent = "Run a batch to see how a short sample can differ from the long-run average.";
      return;
    }
    const rtp = (state.totalReturned / state.totalWagered) * 100;
    const difference = Math.abs(rtp - theoreticalRtp * 100);
    let observation;
    if (state.spins < 100) {
      observation = "With so few spins, big swings are normal; the theoretical average is not a session target.";
    } else if (difference < 5) {
      observation = "This sample is near the theoretical average, but another sample of the same size could look quite different.";
    } else {
      observation = rtp > theoreticalRtp * 100
        ? "This sample is above the theoretical average. That doesn’t change the odds of your next spin."
        : "This sample is below the theoretical average. Past results don’t make a win due.";
    }
    byId("insight-text").textContent = `${state.spins.toLocaleString()} spins: session RTP is ${rtp.toFixed(1)}%. ${observation}`;
  }

  function updateSampleSpread() {
    const count = Number(byId("sample-size").value);
    const standardError = (3.513322999668547 * 100) / Math.sqrt(count);
    byId("sample-size-value").textContent = count.toLocaleString();
    byId("sample-range").textContent = `${(93.2 - standardError).toFixed(1)}%–${(93.2 + standardError).toFixed(1)}%`;
    byId("sample-spread").textContent = `At this sample size, the standard deviation of observed RTP is about ${standardError.toFixed(1)} percentage points around the 93.2% expectation.`;
  }

  function finishBatch(count) {
    const pointStride = Math.max(1, Math.ceil(count / 500));
    for (let index = 0; index < count; index += 1) {
      const outcome = playOutcome();
      recordOutcome(outcome, false);
      if ((index + 1) % pointStride === 0 || index === count - 1) {
        recordChartPoint();
      }
    }
    renderStats();
    updateInsight();
    resultMessage.textContent = `Batch complete: ${count.toLocaleString()} spins added to your session.`;
    resultMessage.className = "result-message";
  }

  spinButton.addEventListener("click", () => {
    if (state.busy) return;
    state.busy = true;
    spinButton.disabled = true;
    const reels = [byId("reel-0"), byId("reel-1"), byId("reel-2")];
    reels.forEach((reel) => reel.classList.add("spinning"));
    resultMessage.textContent = "Spinning…";
    resultMessage.className = "result-message";
    window.setTimeout(() => {
      reels.forEach((reel) => reel.classList.remove("spinning"));
      const outcome = playOutcome();
      recordOutcome(outcome);
      showOutcome(outcome);
      renderStats();
      updateInsight();
      state.busy = false;
      spinButton.disabled = false;
    }, 420);
  });

  document.querySelectorAll("[data-spins]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.busy) return;
      const count = Number(button.dataset.spins);
      if (Number.isInteger(count) && count > 0) finishBatch(count);
    });
  });

  byId("bet-down").addEventListener("click", () => {
    state.bet = Math.max(0.25, Math.round((state.bet - 0.25) * 100) / 100);
    byId("bet-value").textContent = state.bet.toFixed(2);
  });
  byId("bet-up").addEventListener("click", () => {
    state.bet = Math.min(10, Math.round((state.bet + 0.25) * 100) / 100);
    byId("bet-value").textContent = state.bet.toFixed(2);
  });

  byId("reset-button").addEventListener("click", () => {
    if (state.busy) return;
    state.spins = 0;
    state.totalWagered = 0;
    state.totalReturned = 0;
    state.hits = 0;
    state.chartPoints = [];
    [ "🍒", "🍋", "💎" ].forEach((symbol, index) => {
      byId(`reel-${index}`).textContent = symbol;
    });
    resultMessage.textContent = "Session reset. Try a spin.";
    resultMessage.className = "result-message";
    renderStats();
    updateInsight();
  });

  byId("math-toggle").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const details = byId("math-details");
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    details.hidden = expanded;
    button.innerHTML = expanded
      ? 'Show the calculation <span>＋</span>'
      : 'Hide the calculation <span>−</span>';
  });

  byId("sample-size").addEventListener("input", updateSampleSpread);
  window.addEventListener("resize", drawChart);
  updateSampleSpread();
  renderStats();
})();
