import { SkyMass, md } from "@skymass/skymass";
import Canvas from "canvas";
const { createCanvas } = Canvas;

const sm = new SkyMass({ key: process.env["SKYMASS_KEY"] });


async function counter(ui) {
  ui.md`
#### Counter
{counter} {increment} ~ ~
`;

  // number input
  const counter = ui.number("counter", {
    readOnly: true,
    defaultVal: 0,
  });

  // button to increment counter
  const increment = ui.button("increment", {
    label: "Count",
  });

  // increment counter when button is clicked
  if (increment.didClick) {
    counter.setVal(counter.val + 1);
  }
}
async function temperature(ui) {
  ui.md`
#### Temp Converter
{inC} {inF} ~ ~
`;

  // initial state for values C and F
  let { C, F } = ui.getState(() => ({ C: 100, F: 212 }));

  // C input.  It's defaulted to C's initial value
  const inC = ui.number("inC", {
    label: "Celsius",
    required: true,
    step: 0.1,
    defaultVal: C,
  });

  // F input.  It's defaulted to F's initial value
  const inF = ui.number("inF", {
    label: "Farenheit",
    required: true,
    step: 0.1,
    defaultVal: F,
  });

  // check to see if C or F have changed
  // recompute the other based on the new value
  if (inC.isReady && inC.val !== C) {
    F = round(inC.val * (9 / 5) + 32, 1);
    inF.setVal(F);
  } else if (inF.isReady && inF.val !== F) {
    C = round((inF.val - 32) * (5 / 9), 1);
    inC.setVal(C);
  }

  // update the state to the new values
  ui.setState({ C, F });
}

async function booking(ui) {
  ui.md`
#### Flight Booker
{mode} ~
{departure} ~ ~ ~
{return} ~ ~ ~
{book}
`;

  const mode = ui.radioGroup("mode", {
    options: [
      { value: "one_way", label: "One-Way Flight" },
      { value: "return", label: "Return Flight" },
    ],
    defaultVal: "one_way",
  });

  const isOneWay = mode.val === "one_way";

  // default departure date is 7 day in future
  const depDate = new Date();
  depDate.setDate(depDate.getDate() + 7);

  const dep = ui.date("departure", {
    label: "Departure",
    required: true,
    defaultVal: depDate,
    min: new Date(),
  });

  // user's departure date, or our default if user date is not valid.
  const userDepDate = dep.isReady ? dep.val : depDate;

  // default return date to 3 days after departure date
  const returnDate = new Date(userDepDate);
  returnDate.setDate(returnDate.getDate() + 3);

  const ret = ui.date("return", {
    label: "Return",
    defaultVal: returnDate,
    required: true,
    min: userDepDate, // return is always after departure
    disabled: isOneWay,
  });

  // book button, disabled unless date intpus are ready
  const book = ui.button("book", {
    label: "Book",
    disabled: !(dep.isReady && (isOneWay || ret.isReady)),
  });

  // show the confirmation
  if (book.didClick) {
    await ui.confirm({
      text: isOneWay
        ? `Book ${dep.val.toLocaleDateString()}?`
        : `Book ${dep.val.toLocaleDateString()} - ${ret.val.toLocaleDateString()}?`,
    });
  }
}

async function timer(ui) {
  ui.md`
#### Timer
{progress} ~ ~
{seconds}
{range} ~ ~
`;

  // initial state for state time and whether a timer is already scheduled
  let { start, pending } = ui.getState(() => ({
    start: Date.now(),
    pending: false,
  }));

  // duration slider.
  // note that it is created before the progress bar but placed
  // after thanks to the markdown above.
  const duration = ui.range("range", {
    label: "Duration",
    max: 60,
    defaultVal: 30,
    debounce: 0,
  });

  // compute elapsed time
  const elapsed = round(Math.min(duration.val, (Date.now() - start) / 1000), 1);

  // render progress bar with current elapsed time / duration
  ui.progress("progress", {
    label: "Elapsed",
    value: elapsed,
    max: duration.val,
  });

  ui.txt("seconds", `${elapsed.toFixed(1)}s / ${duration.val}`);

  // reset button
  const reset = ui.button("reset", { label: "Reset" });
  if (reset.didClick) {
    ui.setState({ start: Date.now() });
  }

  // schedule a 100ms timer while elapsed time < duration
  if (!pending && elapsed < duration.val) {
    ui.setState({ pending: true });
    setTimeout(() => ui.setState({ pending: false }), 100);
  }
}

async function crud(ui) {
  ui.md`
#### CRUD
{filter} ~ ~
{list} {fields} ~
`;

  // this is the data being edited
  const { list } = ui.getState(() => ({
    list: [
      { name: "Hans", surname: "Emil" },
      { name: "Max", surname: "Mustermann" },
      { name: "Roman", surname: "Tisch" },
    ],
  }));

  // input for filtering the data
  const filter = ui.string("filter", { label: "Filter prefix" });

  // render a table with the filter applied
  const table = ui.table(
    "list",
    filter.val
      ? list.filter((p) =>
          p.surname.toLowerCase().startsWith(filter.val.toLowerCase())
        )
      : list,
    {
      columns: {
        "*": { search: false },
      },
    }
  );

  // ui.record groups related fields into a unit
  const fields = ui.record("fields", {
    name: ui.string("name", { label: "Name", required: true }),
    surname: ui.string("surname", { label: "Surname", required: true }),
  });

  // table.selection is an array containing the selected table rows.
  // person will be set to the selected row, or null.
  const [person] = table.selection;

  // .didSelect is like an event.
  // populate fields with the currently selected row's data
  if (table.didSelect) {
    fields.setVal(person);
  }

  // "create" button and it's handler code
  if (
    ui.button("create", {
      label: "Create",
      disabled: !fields.isReady,
    }).didClick
  ) {
    fields.reset();
    ui.setState({ list: [...list, fields.val] });
  }

  // "update" button and it's handler code
  if (
    ui.button("update", {
      label: "Update",
      disabled: !person && !fields.isReady,
    }).didClick
  ) {
    const index = list.findIndex(
      (p) => p.name === person.name && p.surname === person.surname
    );
    list.splice(index, 1, fields.val);
    ui.setState({ list: [...list] });
  }

  // "delete" button and it's handler code
  if (
    ui.button("delete", {
      label: "Delete",
      disabled: !person,
    }).didClick
  ) {
    const index = list.findIndex(
      (p) => p.name === person.name && p.surname === person.surname
    );
    fields.reset();
    list.splice(index, 1);
    ui.setState({ list: [...list] });
  }
}

async function circles(ui) {
  ui.md`
#### Circle Draw
Click to place a circle.  SHIFT + click to select.
{canvas}
{radius} {done} ~
`;

  // initial state is
  // circles that have been drawn
  // selected circle
  // undo and redo are stacks with previous / next states copied into them
  const { circles, selected, undo, redo } = ui.getState(() => ({
    circles: [],
    selected: null,
    undo: [],
    redo: [],
  }));

  // if a circle is selected, render the radius control
  // and the "done" button to update the state.
  let radius;
  if (selected) {
    radius = ui.range("radius", {
      label: "Adjust Radius",
      min: 10,
      max: 100,
      defaultVal: selected.r,
      debounce: 0,
    });

    const done = ui.button("done", { label: "Done" });
    if (done.didClick) {
      ui.setState(({ circles, undo }) => {
        return {
          circles: circles.map((c) =>
            c === selected ? { ...c, r: radius.val } : c
          ),
          selected: null,
          undo: [...undo, { circles, selected: null }],
          redo: [],
        };
      });
    }
  }

  // render the circles into a canvas
  // canvas content is later rendered using ui.image
  const canvas = createCanvas(400, 300);
  const ctx = canvas.getContext("2d");

  circles.forEach((c) => {
    ctx.beginPath();
    if (c === selected) {
      // if the circle is selected, use the range slider
      // for it's radius and also fill it in
      ctx.arc(c.x, c.y, radius.val, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(0, 0,0, 0.5)";
      ctx.fill();
    } else {
      // else, just draw the circle
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  const image = ui.image("canvas", {
    size: "l",
    src: canvas.toDataURL(),
  });

  // if the image was clicked...
  if (image.didClick) {
    const xy = image.didClick;
    // if shift key is pressed, set the selection
    // to the nearest circle that contained the click
    if (xy.shiftKey) {
      const closest = circles
        .flatMap((c) => {
          const d = dist(c, xy);
          return d < c.r ? { d, c } : [];
        })
        .sort((a, b) => a.d - b.d)
        .map((a) => a.c)
        .shift();

      ui.setState((state) => ({ ...state, selected: closest }));
    } else if (selected) {
      // unselect the currently selected
      ui.setState((state) => ({ ...state, selected: null }));
    } else {
      // place a new circle
      ui.setState(({ circles, undo }) => ({
        circles: [...circles, { x: xy.x, y: xy.y, r: 50 }],
        selected: null,
        undo: [...undo, { circles, selected: null }],
        redo: [],
      }));
    }
  }

  // "undo" button pops the last state from the undo stack
  // and sets the current state to it and unshifts the current state
  // on to the redo stack
  if (ui.button("undo", { label: "Undo", disabled: !undo.length }).didClick) {
    ui.setState(({ circles, selected, undo, redo }) => {
      const curr = undo.pop();
      return {
        ...curr,
        undo: [...undo],
        redo: [{ circles, selected }, ...redo],
      };
    });
  }
  // "redo" button shifts from redo and pushes onto the undo stack.
  if (ui.button("redo", { label: "Redo", disabled: !redo.length }).didClick) {
    ui.setState(({ circles, selected, undo, redo }) => {
      const curr = redo.shift();
      return {
        ...curr,
        undo: [...undo, { circles, selected }],
        redo: [...redo],
      };
    });
  }
}
async function cells(ui) {
  ui.md`
    #### Cells (WIP)
    Cells can contain numbers (eg: 5.4) or simple formulas (eg: "=A1 + B1")
    `;

  // raw = { A1: "5", B1: "3", C1: "=A1+B1", ...}
  // computed = { A1: 5, B1: 3, C1: 8,... } result of formulas etc...
  const { computed, raw } = ui.getState(() => ({ computed: {}, raw: {} }));

  // { A1: "5", ... }
  // populated on each render
  const cells = {};

  // render a 10x10 grid of cells
  // markdown is used to layout the rows and cols
  // ie:
  // {A1} {B1} {C1} ...
  // {A2} {B2} {C2} ...
  // ...
  let md = "";
  for (let row = 1; row < 10; row++) {
    md += "\n";
    for (const col of "ABCDEFGHIJ") {
      const addr = col + row; // eg: D3
      const v = (computed[addr] || "") + "";
      // hack: using the field label to show the formula results
      cells[addr] = ui.string(addr, {
        label: v && v != raw[addr] ? v : undefined,
      }).val;
      md += `{${addr}} `;
    }
  }
  ui.md([md]);

  let changed = false;
  // compute the cell values
  for (const addr in cells) {
    let val;
    try {
      val = compute(addr, cells);
    } catch (e) {
      val = e;
    }
    if (computed[addr] != val) {
      changed = true;
      // set to val or null if null or undefined
      computed[addr] = val != null ? val : null;
    }
  }
  if (changed) {
    ui.setState({ computed, raw: cells });
  }
}

const TASKS = {
  Counter: counter,
  Temperature: temperature,
  Booking: booking,
  Timer: timer,
  Crud: crud,
  Circles: circles,
  Cells: cells,
};

sm.page("/seven-guis", async (ui) => {
  ui.md`
  # 7GUIs
  An implementation of [7GUIs](https://eugenkiss.github.io/7guis/) in [SkyMass](https://skymass.dev).  View source on [GitHub](https://github.com/skymasshq/skymass-demo/blob/main/seven_guis.mjs)
  `;

  const task = ui.nav("task_tab", { options: Object.keys(TASKS) });
  code(ui, task.val, TASKS[task.val]);
});

// Utility functions

function sq(a) {
  return a * a;
}

function dist(a, b) {
  return Math.sqrt(sq(a.x - b.x) + sq(a.y - b.y));
}

function round(n, p = 1) {
  const x = Math.pow(10, p);
  return Math.round(x * n) / x;
}

// used in Cells to compute a cell's value,
// including parsing formulas and following the refernces
// cell = A1
// cells { A1: 5, ... }
// visited { A1: true, ... }
function compute(cell, cells, visited = {}) {
  visited[cell] = true;
  const value = cells[cell];
  function val(x) {
    if (/^[A-J]+\d+/.test(x)) {
      if (visited[x]) throw "!CYCLIC";
      return compute(x, cells, visited);
    } else {
      const v = Number.parseFloat(x);
      if (Number.isNaN(v)) {
        throw "!NaN";
      }
      return v;
    }
  }
  if (!value) {
    return null;
  } else if (value.startsWith("=")) {
    const f = /([A-J]*\d+)\s*([+-/*])\s*([A-J]*\d+)/.exec(value);
    if (!f) throw "!FORMULA";
    const [all, a, op, b] = f;
    const av = val(a);
    const bv = val(b);
    if (Number.isNaN(av)) {
      throw `!BAD_${a}`;
    }
    if (Number.isNaN(bv)) {
      throw `!BAD_${b}`;
    }
    switch (op) {
      case "+":
        return av + bv;
      case "-":
        return av - bv;
      case "*":
        return av * bv;
      case "/":
        if (bv) {
          return av / bv;
        } else {
          throw "!DIV_BY_0";
        }
    }
  }
  return val(value);
}

// format js source code
function fmt(fn) {
  const str = fn.toString();
  const lines = str.split("\n").slice(1, -1);
  const first = lines[0];
  const leading_spaces = first.length - first.trimStart().length;
  // trim up to x leading spaces
  const re = new RegExp(`^\\s{0,${leading_spaces}}`);
  const code = lines.map((line) => line.replace(re, "")).join("\n");
  return code;
}

// run code as a region + render it's source code
function code(ui, name, code) {
  ui.region(name, code);
  const src = fmt(code);
  const sloc = src.split("\n").filter((line) => !/\s+\/\//.test(line)).length;
  ui.md`###### Source (${sloc} SLoC)`;
  ui.txt("source", md(["```\n" + src + "\n```"]));
}