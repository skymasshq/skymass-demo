import { SkyMass } from "@skymass/skymass";
import pgPromise from "pg-promise";

// open a db connection to Neon
const pgp = pgPromise({});
const db = pgp(process.env["NEON_DSN"]);

// create a SkyMass instance
const sm = new SkyMass({ key: process.env["SKYMASS_KEY"] });

// register the application
sm.page("/neon-todolist", async (ui) => {
  // This function is run on first app access and every time something
  // significant happens in the UI (for example when a button is pressed,
  // a table row is selected, ...)

  // SkyMass uses Markdown to emit and format text.
  // Here we emit a level 1 (#) header
  ui.md`# ☑️ Todo List`;

  // This app is configured at skymass.dev to require a login
  // so user will always be set to { email: ... }
  const { email } = ui.user();

  // A checkbox input to control whether we include completed todos
  const hideDone = ui.boolean("hide_done", { label: "Hide Completed Todos" });

  // SELECT user's todos from the database. Note that todos is a Promise.
  // SkyMass widgets handle literal values or Promises out of the box
  const todos = db.any(
    "SELECT id, title, due_by, done FROM todos WHERE created_by = $(email)" +
      (hideDone.val ? " AND NOT done" : ""),
    { email }
  );

  // SkyMass Markdown supports mentioning widgets using {widget_id} to
  // control their placement. {widgets} on the same line results in laying
  //  the out in a single row with equal with cols.  "~" means an empty column.
  // In this case, we are rendering {todos} followed by two empty cols
  // which means todos will occupy 1/3 of the available row width.
  ui.md`{todos} ~ ~`;

  // Render table with the items returned from the query
  // Note that 'todos', which contains the list of todos is a Promise.
  // The optional columns prop specifies col rendering options.
  const table = ui.table("todos", todos, {
    loading: "Loading Todos...",
    empty: "No Pending Todos.  Use 'New Todo' to add some.",
    columns: {
      "*": { search: false },
      id: { hidden: true, isId: true },
      title: { label: "Todo", format: "multiline" },
      due_by: { label: "Due By", format: "date_short" },
      done: { label: "Done" },
    },
  });

  // Table widgets have a .selection field containing an array of
  // currently selected rows.  Destructuring it into [todo] means
  // todo is the currently selected row or null if no row is selected.
  const [todo] = table.selection;

  // render a button to mark the selected todo as done/todo.
  const toggle = ui.button("toggle", {
    label: todo ? (todo.done ? "Mark as Todo" : "Mark as Done") : "Toggle",
    disabled: !todo,
  });
  // .didClick toggles true when the button is clicked causing
  // this code block to be entered once per button click
  if (toggle.didClick) {
    // note: we can await async operations
    await db.none("UPDATE todos SET done = NOT done WHERE id = $(id)", {
      id: todo.id,
    });
    ui.toast(todo.done ? "Marked as todo" : "Marked as done");
  }

  // similar to toggle above
  const del = ui.button("delete", {
    label: "Delete",
    disabled: !todo,
  });
  if (del.didClick) {
    // modal interactions, like ui.confirm, return Promises which we await!
    if (await ui.confirm({ text: "Are you sure?" })) {
      await db.none("DELETE FROM todos WHERE id = $(id)", {
        id: todo.id,
      });
      ui.toast("Deleted");
    }
  }

  const add = ui.button("add", { label: "New Todo" });
  if (add.didClick) {
    // Similar to ui.confirm, ui.modal returns a Promise that we await
    // until the modal is closed. Modals accept a function that controls
    //  what happens inside of them, similar to the top level app. This
    // function runs independently while the parent function is 'awaiting'
    // the completion of the modal.
    await ui.modal("add", async (ui) => {
      ui.md`#### New Todo`;

      // forms are used to group related inputs together.
      const newTodo = ui.form("todo", {
        fields: {
          title: ui.string("title", { placeholder: "Title", required: true }),
          due_by: ui.date("due_by", { required: true, min: new Date() }),
        },
        action: ui.button("add", { label: "Add" }),
      });

      // similar to button .didClick, .didSubmit toggles true when the form is submitted
      // newTodo.val will contain { title: ..., due_by: ...}
      if (newTodo.didSubmit) {
        await db.none(
          `
          INSERT INTO todos 
            (title, due_by, created_by) 
          VALUES 
            ($(title), $(due_by), $(email))`,
          { ...newTodo.val, email }
        );
        ui.toast("Added new todo");
        ui.close();
      }
    });
  }

  // link to this file
  ui.md`[View Source on GitHub](https://github.com/skymasshq/skymass-demo/blob/main/neon_todolist.mjs)`;
});
