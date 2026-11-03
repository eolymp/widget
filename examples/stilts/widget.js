const yard = document.getElementById("yard");
for (let n = 1; n <= 19; n++) {
  const mark = document.createElement("b");
  mark.style.setProperty("--n", n);
  mark.textContent = n;
  yard.append(mark);
}

const figures = ["0", "1", "2", "3", "4"];
const stilts = ["0", "1", "2", "3", "4", "5"];
const seats = eolymp.slots("#scene");

const answer = {
  get() {
    const placement = seats.get();
    const chosen = figures.map((figure) => stilts.find((stilt) => placement[stilt].includes(figure)));
    return chosen.includes(undefined) ? null : chosen.map(Number);
  },
  set(value) {
    const list = Array.isArray(value) ? value : [];
    seats.set(Object.fromEntries(stilts.map((stilt) => [stilt, figures.filter((_, i) => String(list[i]) === stilt)])));
  },
  update(change) {
    answer.set(change(answer.get()));
  },
  subscribe(listener) {
    return seats.subscribe(() => listener(answer.get()));
  },
};

eolymp.widget({ answer });
